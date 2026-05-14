const db = require('../config/db');

const STEP_KEYS = ['profile', 'introduce', 'notifications', 'app', 'event', 'course'];

const resolveOrgId = (user) => user?.org_id || user?.business_id || null;

const ensureTable = async () => {
  await db.query(
    `CREATE TABLE IF NOT EXISTS start_here_step_likes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      step_key VARCHAR(32) NOT NULL,
      user_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_start_here_step_like (org_id, step_key, user_id),
      INDEX idx_start_here_step_counts (org_id, step_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
};

const emptyStepsPayload = () => {
  const steps = {};
  STEP_KEYS.forEach((k) => {
    steps[k] = { likes_count: 0, liked_by_me: false, recent_likers: [] };
  });
  return steps;
};

const getStepStats = async (req, res) => {
  try {
    await ensureTable();
    const orgId = resolveOrgId(req.user);
    const userId = Number(req.user?.id);
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid user context.' });
    }
    const steps = emptyStepsPayload();
    if (!orgId) {
      return res.json({ status: 'success', data: { steps } });
    }

    const placeholders = STEP_KEYS.map(() => '?').join(',');
    const [countRows] = await db.query(
      `SELECT step_key, COUNT(*) AS cnt
       FROM start_here_step_likes
       WHERE org_id = ? AND step_key IN (${placeholders})
       GROUP BY step_key`,
      [orgId, ...STEP_KEYS],
    );
    countRows.forEach((row) => {
      const key = String(row.step_key || '');
      if (steps[key]) {
        steps[key].likes_count = Number(row.cnt || 0);
      }
    });

    const [myRows] = await db.query(
      `SELECT step_key FROM start_here_step_likes WHERE org_id = ? AND user_id = ? AND step_key IN (${placeholders})`,
      [orgId, userId, ...STEP_KEYS],
    );
    myRows.forEach((row) => {
      const key = String(row.step_key || '');
      if (steps[key]) {
        steps[key].liked_by_me = true;
      }
    });

    await Promise.all(
      STEP_KEYS.map(async (key) => {
        const [likerRows] = await db.query(
          `SELECT l.user_id AS id, u.name
           FROM start_here_step_likes l
           INNER JOIN users u ON u.id = l.user_id
           WHERE l.org_id = ? AND l.step_key = ?
           ORDER BY l.created_at DESC
           LIMIT 3`,
          [orgId, key],
        );
        steps[key].recent_likers = likerRows.map((r) => ({
          id: Number(r.id),
          name: String(r.name || '').trim() || 'Member',
        }));
      }),
    );

    return res.json({ status: 'success', data: { steps } });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Unable to load step stats.' });
  }
};

const toggleStepLike = async (req, res) => {
  try {
    await ensureTable();
    const orgId = resolveOrgId(req.user);
    const userId = Number(req.user?.id);
    const stepKey = String(req.params.stepKey || '')
      .trim()
      .toLowerCase();

    if (!STEP_KEYS.includes(stepKey)) {
      return res.status(400).json({ status: 'error', message: 'Invalid step.' });
    }
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid user context.' });
    }

    const [existing] = await db.query(
      'SELECT id FROM start_here_step_likes WHERE org_id = ? AND step_key = ? AND user_id = ? LIMIT 1',
      [orgId, stepKey, userId],
    );

    if (existing.length) {
      await db.query('DELETE FROM start_here_step_likes WHERE org_id = ? AND step_key = ? AND user_id = ? LIMIT 1', [
        orgId,
        stepKey,
        userId,
      ]);
    } else {
      await db.query(
        'INSERT INTO start_here_step_likes (org_id, step_key, user_id) VALUES (?, ?, ?)',
        [orgId, stepKey, userId],
      );
    }

    const [countRows] = await db.query(
      'SELECT COUNT(*) AS cnt FROM start_here_step_likes WHERE org_id = ? AND step_key = ?',
      [orgId, stepKey],
    );
    const [likedRows] = await db.query(
      'SELECT id FROM start_here_step_likes WHERE org_id = ? AND step_key = ? AND user_id = ? LIMIT 1',
      [orgId, stepKey, userId],
    );

    return res.json({
      status: 'success',
      data: {
        step_key: stepKey,
        likes_count: Number(countRows[0]?.cnt || 0),
        liked_by_me: Boolean(likedRows.length),
      },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Unable to update like.' });
  }
};

module.exports = {
  STEP_KEYS,
  getStepStats,
  toggleStepLike,
};
