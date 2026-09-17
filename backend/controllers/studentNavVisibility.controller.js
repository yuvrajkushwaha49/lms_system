const db = require('../config/db');

const resolveOrgId = (user) => user?.org_id || user?.business_id || null;

const canManage = (user) => {
  const role = String(user?.role_name || '').toLowerCase();
  return ['ceo', 'admin', 'instructor', 'trainer'].includes(role);
};

/** Canonical keys — keep in sync with frontend/src/utils/studentNavVisibility.js */
const NAV_KEYS = [
  'feed',
  'sell_it_starter',
  'starter_start_here',
  'starter_live_workshops',
  'starter_sell_it_snacks',
  'starter_wall_of_wins',
  'starter_faqs',
  'welcome',
  'welcome_start_here',
  'welcome_meet_greet',
  'welcome_ask_ryan',
  'welcome_owning_manhattan',
  'welcome_community_input',
  'welcome_family_video',
  'community',
  'community_sell',
  'community_directory',
  'community_referral',
  'community_listings',
  'community_wall_of_wins',
  'monthly_challenges',
  'join_us_live',
  'learning_center',
  'learning_short_courses',
  'learning_signature_courses',
  'learning_documents',
  'learning_gallery',
  'links_contact',
  'logout',
  'top_home',
  'top_courses',
  'top_events',
  'top_owning_manhattan',
  'top_leaderboard',
];

const defaultVisibility = () =>
  NAV_KEYS.reduce((acc, key) => {
    acc[key] = true;
    return acc;
  }, {});

const ensureTable = async () => {
  await db.query(
    `CREATE TABLE IF NOT EXISTS org_student_nav_visibility (
      org_id INT NOT NULL PRIMARY KEY,
      visibility_json JSON NOT NULL,
      updated_by INT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
};

const parseVisibility = (raw) => {
  const base = defaultVisibility();
  if (!raw) return base;
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return base;
    }
  }
  if (!parsed || typeof parsed !== 'object') return base;
  NAV_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(parsed, key)) {
      base[key] = Boolean(parsed[key]);
    }
  });
  return base;
};

const getStudentNavVisibility = async (req, res) => {
  try {
    await ensureTable();
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }
    const [rows] = await db.query(
      'SELECT visibility_json, updated_at FROM org_student_nav_visibility WHERE org_id = ? LIMIT 1',
      [orgId],
    );
    const visibility = parseVisibility(rows[0]?.visibility_json);
    return res.json({
      status: 'success',
      data: {
        visibility,
        keys: NAV_KEYS,
        updated_at: rows[0]?.updated_at || null,
      },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Unable to load navbar settings.' });
  }
};

const upsertStudentNavVisibility = async (req, res) => {
  try {
    await ensureTable();
    if (!canManage(req.user)) {
      return res.status(403).json({ status: 'error', message: 'Only admin or trainer can update navbar visibility.' });
    }
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }

    const incoming = req.body?.visibility;
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      return res.status(400).json({ status: 'error', message: 'visibility object is required.' });
    }

    const visibility = parseVisibility(incoming);
    const json = JSON.stringify(visibility);

    await db.query(
      `INSERT INTO org_student_nav_visibility (org_id, visibility_json, updated_by)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         visibility_json = VALUES(visibility_json),
         updated_by = VALUES(updated_by)`,
      [orgId, json, req.user?.id || null],
    );

    const [rows] = await db.query(
      'SELECT visibility_json, updated_at FROM org_student_nav_visibility WHERE org_id = ? LIMIT 1',
      [orgId],
    );

    return res.json({
      status: 'success',
      data: {
        visibility: parseVisibility(rows[0]?.visibility_json),
        keys: NAV_KEYS,
        updated_at: rows[0]?.updated_at || null,
      },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Unable to save navbar settings.' });
  }
};

module.exports = {
  getStudentNavVisibility,
  upsertStudentNavVisibility,
  NAV_KEYS,
  defaultVisibility,
};
