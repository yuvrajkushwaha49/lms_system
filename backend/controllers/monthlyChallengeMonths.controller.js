const db = require('../config/db');
const { fetchOrgCoursesForOrg } = require('./courses.controller');

const resolveOrgId = (user) => user?.org_id || user?.business_id || null;

const canManage = (user) => {
  const role = String(user?.role_name || '').toLowerCase();
  return ['ceo', 'admin', 'instructor', 'trainer'].includes(role);
};

const ensureTable = async () => {
  await db.query(
    `CREATE TABLE IF NOT EXISTS org_monthly_challenge_labels (
      org_id INT NOT NULL,
      month_key CHAR(7) NOT NULL COMMENT 'YYYY-MM',
      display_name VARCHAR(255) NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (org_id, month_key),
      INDEX idx_org_monthly_challenge (org_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
};

const validateMonthKey = (raw) => {
  const s = String(raw || '').trim();
  if (!/^\d{4}-\d{2}$/.test(s)) return null;
  const [, mm] = s.split('-');
  const m = Number(mm);
  if (m < 1 || m > 12) return null;
  return s;
};

const mapRow = (row) => ({
  month_key: row?.month_key || '',
  display_name: row?.display_name || '',
  updated_at: row?.updated_at || null,
});

/**
 * For each calendar month that has at least one course upload in this org,
 * insert a label row if missing. Default display_name is calendar style (e.g. "May 2025"), same as student UI fallback.
 * Runs on every labels fetch so new upload months appear without manual setup; admins can rename anytime.
 */
const seedMissingMonthsFromCourses = async (orgId) => {
  await db.query(
    `INSERT INTO org_monthly_challenge_labels (org_id, month_key, display_name)
     SELECT grp.org_id, grp.month_key, grp.display_name
     FROM (
       SELECT
         c.org_id,
         DATE_FORMAT(c.created_at, '%Y-%m') AS month_key,
         DATE_FORMAT(MIN(c.created_at), '%M %Y') AS display_name
       FROM courses c
       WHERE c.org_id = ? AND c.created_at IS NOT NULL
       GROUP BY c.org_id, DATE_FORMAT(c.created_at, '%Y-%m')
     ) AS grp
     WHERE NOT EXISTS (
       SELECT 1 FROM org_monthly_challenge_labels l
       WHERE l.org_id = grp.org_id AND l.month_key = grp.month_key
     )`,
    [orgId],
  );
};

/** Any authenticated user in the org — used by students and admins. */
const listLabels = async (req, res) => {
  try {
    await ensureTable();
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }
    await seedMissingMonthsFromCourses(orgId);
    const [rows] = await db.query(
      'SELECT month_key, display_name, updated_at FROM org_monthly_challenge_labels WHERE org_id = ? ORDER BY month_key DESC',
      [orgId],
    );
    return res.json({ status: 'success', data: (rows || []).map(mapRow) });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Unable to load monthly challenge names.' });
  }
};

const upsertLabel = async (req, res) => {
  try {
    await ensureTable();
    if (!canManage(req.user)) {
      return res.status(403).json({ status: 'error', message: 'Only admin or trainer can update monthly challenge names.' });
    }
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }
    const monthKey = validateMonthKey(req.body?.month_key);
    const displayName = String(req.body?.display_name || '').trim().slice(0, 255);
    if (!monthKey) {
      return res.status(400).json({ status: 'error', message: 'month_key must be YYYY-MM (e.g. 2025-05).' });
    }
    if (!displayName) {
      return res.status(400).json({ status: 'error', message: 'display_name is required.' });
    }
    await db.query(
      `INSERT INTO org_monthly_challenge_labels (org_id, month_key, display_name)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)`,
      [orgId, monthKey, displayName],
    );
    const [rows] = await db.query(
      'SELECT month_key, display_name, updated_at FROM org_monthly_challenge_labels WHERE org_id = ? AND month_key = ? LIMIT 1',
      [orgId, monthKey],
    );
    return res.json({ status: 'success', data: mapRow(rows[0] || {}) });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Unable to save monthly challenge name.' });
  }
};

const deleteLabel = async (req, res) => {
  try {
    await ensureTable();
    if (!canManage(req.user)) {
      return res.status(403).json({ status: 'error', message: 'Only admin or trainer can reset monthly challenge names.' });
    }
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }
    const monthKey = validateMonthKey(req.params.monthKey);
    if (!monthKey) {
      return res.status(400).json({ status: 'error', message: 'Invalid month key.' });
    }
    const defaultSql = `DATE_FORMAT(STR_TO_DATE(CONCAT(month_key, '-01'), '%Y-%m-%d'), '%M %Y')`;
    const [upd] = await db.query(
      `UPDATE org_monthly_challenge_labels SET display_name = ${defaultSql} WHERE org_id = ? AND month_key = ?`,
      [orgId, monthKey],
    );
    if (!upd.affectedRows) {
      return res.status(404).json({ status: 'error', message: 'No label row for that month. It will appear automatically when courses exist for that month.' });
    }
    const [rows] = await db.query(
      'SELECT month_key, display_name, updated_at FROM org_monthly_challenge_labels WHERE org_id = ? AND month_key = ? LIMIT 1',
      [orgId, monthKey],
    );
    return res.json({ status: 'success', data: mapRow(rows[0] || {}) });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Unable to reset monthly challenge name.' });
  }
};

const ensurePlacementsTable = async () => {
  await db.query(
    `CREATE TABLE IF NOT EXISTS org_monthly_challenge_course_placements (
      org_id INT NOT NULL,
      month_key CHAR(7) NOT NULL,
      course_id INT NOT NULL,
      week_index TINYINT NOT NULL COMMENT '0=hidden from this month, 1-5=week bucket',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (org_id, month_key, course_id),
      INDEX idx_mcm_cp_org_month (org_id, month_key),
      CONSTRAINT fk_mcm_cp_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
};

const monthKeyFromCreatedAt = (createdAt) => {
  const d = createdAt ? new Date(createdAt) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const weekBucketInMonth = (createdAt) => {
  const d = createdAt ? new Date(createdAt) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return Math.min(5, Math.ceil(d.getDate() / 7));
};

const sortCoursesByCreatedDesc = (a, b) => {
  const ta = new Date(a.created_at).getTime() || 0;
  const tb = new Date(b.created_at).getTime() || 0;
  return tb - ta;
};

const buildChallengeWeeksAndHidden = ({ courses, placementRows, monthKey }) => {
  const pmap = new Map((placementRows || []).map((r) => [Number(r.course_id), Number(r.week_index)]));
  const weeks = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  const hidden = [];

  for (const course of courses) {
    const cid = Number(course.id);
    const natMonth = monthKeyFromCreatedAt(course.created_at);
    const natWeek = weekBucketInMonth(course.created_at);
    const p = pmap.has(cid) ? pmap.get(cid) : undefined;

    if (p === undefined) {
      if (natMonth === monthKey && natWeek != null) {
        weeks[natWeek].push({
          ...course,
          monthly_challenge: { source: 'natural', week: natWeek },
        });
      }
      continue;
    }

    if (p === 0) {
      hidden.push({
        course,
        natural_month: natMonth,
        natural_week: natWeek,
      });
      continue;
    }

    if (p >= 1 && p <= 5) {
      weeks[p].push({
        ...course,
        monthly_challenge: { source: 'placement', week: p },
      });
    }
  }

  [1, 2, 3, 4, 5].forEach((w) => {
    weeks[w].sort(sortCoursesByCreatedDesc);
  });

  return { weeks, hidden };
};

const loadDisplayNameForMonth = async (orgId, monthKey) => {
  const [rows] = await db.query(
    'SELECT display_name FROM org_monthly_challenge_labels WHERE org_id = ? AND month_key = ? LIMIT 1',
    [orgId, monthKey],
  );
  return rows?.[0]?.display_name ? String(rows[0].display_name) : '';
};

const getMonthSchedule = async (req, res) => {
  try {
    await ensureTable();
    await ensurePlacementsTable();
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }
    const monthKey = validateMonthKey(req.params.monthKey);
    if (!monthKey) {
      return res.status(400).json({ status: 'error', message: 'Invalid month key.' });
    }
    await seedMissingMonthsFromCourses(orgId);
    const courses = await fetchOrgCoursesForOrg(orgId);
    const [placementRows] = await db.query(
      'SELECT course_id, week_index FROM org_monthly_challenge_course_placements WHERE org_id = ? AND month_key = ?',
      [orgId, monthKey],
    );
    const { weeks } = buildChallengeWeeksAndHidden({ courses, placementRows, monthKey });
    return res.json({
      status: 'success',
      data: {
        month_key: monthKey,
        weeks,
      },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Unable to load schedule.' });
  }
};

const getAdminMonthDetail = async (req, res) => {
  try {
    await ensureTable();
    await ensurePlacementsTable();
    if (!canManage(req.user)) {
      return res.status(403).json({ status: 'error', message: 'Only admin or trainer can manage placements.' });
    }
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }
    const monthKey = validateMonthKey(req.params.monthKey);
    if (!monthKey) {
      return res.status(400).json({ status: 'error', message: 'Invalid month key.' });
    }
    await seedMissingMonthsFromCourses(orgId);
    const courses = await fetchOrgCoursesForOrg(orgId);
    const [placementRows] = await db.query(
      'SELECT course_id, week_index FROM org_monthly_challenge_course_placements WHERE org_id = ? AND month_key = ?',
      [orgId, monthKey],
    );
    const { weeks, hidden } = buildChallengeWeeksAndHidden({ courses, placementRows, monthKey });
    const visibleIds = new Set();
    [1, 2, 3, 4, 5].forEach((w) => {
      weeks[w].forEach((c) => visibleIds.add(Number(c.id)));
    });
    const placedIds = new Set((placementRows || []).map((r) => Number(r.course_id)));
    const add_pool = courses
      .filter((c) => {
        const id = Number(c.id);
        return !visibleIds.has(id) && !placedIds.has(id);
      })
      .map((c) => ({ id: c.id, title: c.title || 'Untitled' }))
      .sort((a, b) => String(a.title).localeCompare(String(b.title)));

    const display_name = (await loadDisplayNameForMonth(orgId, monthKey)) || '';

    return res.json({
      status: 'success',
      data: {
        month_key: monthKey,
        display_name,
        weeks,
        hidden,
        add_pool,
      },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Unable to load admin detail.' });
  }
};

const putCoursePlacement = async (req, res) => {
  try {
    await ensurePlacementsTable();
    if (!canManage(req.user)) {
      return res.status(403).json({ status: 'error', message: 'Only admin or trainer can update placements.' });
    }
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }
    const monthKey = validateMonthKey(req.params.monthKey);
    if (!monthKey) {
      return res.status(400).json({ status: 'error', message: 'Invalid month key.' });
    }
    const courseId = Number(req.params.courseId);
    if (!Number.isFinite(courseId) || courseId <= 0) {
      return res.status(400).json({ status: 'error', message: 'Invalid course id.' });
    }
    const weekIndex = Number(req.body?.week_index);
    if (![0, 1, 2, 3, 4, 5].includes(weekIndex)) {
      return res.status(400).json({ status: 'error', message: 'week_index must be 0 (hide) or 1–5.' });
    }
    const [courseRows] = await db.query(
      'SELECT id FROM courses WHERE id = ? AND org_id = ? LIMIT 1',
      [courseId, orgId],
    );
    if (!courseRows.length) {
      return res.status(404).json({ status: 'error', message: 'Course not found in your organization.' });
    }
    await db.query(
      `INSERT INTO org_monthly_challenge_course_placements (org_id, month_key, course_id, week_index)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE week_index = VALUES(week_index)`,
      [orgId, monthKey, courseId, weekIndex],
    );
    return res.json({ status: 'success', data: { month_key: monthKey, course_id: courseId, week_index: weekIndex } });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Unable to save placement.' });
  }
};

const deleteCoursePlacement = async (req, res) => {
  try {
    await ensurePlacementsTable();
    if (!canManage(req.user)) {
      return res.status(403).json({ status: 'error', message: 'Only admin or trainer can clear placements.' });
    }
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }
    const monthKey = validateMonthKey(req.params.monthKey);
    if (!monthKey) {
      return res.status(400).json({ status: 'error', message: 'Invalid month key.' });
    }
    const courseId = Number(req.params.courseId);
    if (!Number.isFinite(courseId) || courseId <= 0) {
      return res.status(400).json({ status: 'error', message: 'Invalid course id.' });
    }
    await db.query(
      'DELETE FROM org_monthly_challenge_course_placements WHERE org_id = ? AND month_key = ? AND course_id = ?',
      [orgId, monthKey, courseId],
    );
    return res.json({ status: 'success', data: { month_key: monthKey, course_id: courseId, cleared: true } });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Unable to clear placement.' });
  }
};

module.exports = {
  listLabels,
  upsertLabel,
  deleteLabel,
  getMonthSchedule,
  getAdminMonthDetail,
  putCoursePlacement,
  deleteCoursePlacement,
};
