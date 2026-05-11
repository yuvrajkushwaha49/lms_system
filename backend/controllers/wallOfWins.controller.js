const path = require('path');
const fs = require('fs');
const db = require('../config/db');

const resolveOrgId = (user) => user?.org_id || user?.business_id || null;

const canModerateWallOfWins = (user) => {
  const r = String(user?.role_name || '').toLowerCase();
  return ['ceo', 'admin', 'instructor', 'trainer'].includes(r);
};

/** Only CEO / Admin may upload. Instructors/trainers may block or delete from Feed Management. */
const canUploadWallOfWins = (user) => {
  const r = String(user?.role_name || '').toLowerCase();
  return ['ceo', 'admin'].includes(r);
};

const canDeleteWallEntry = (user) => canModerateWallOfWins(user);

const ensureWallOfWinsTable = async () => {
  await db.query(
    `CREATE TABLE IF NOT EXISTS wall_of_wins_entries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      user_id INT NOT NULL,
      user_name VARCHAR(255) DEFAULT NULL,
      title VARCHAR(255) DEFAULT NULL,
      image_url VARCHAR(1024) NOT NULL,
      image_name VARCHAR(255) DEFAULT NULL,
      image_mime VARCHAR(255) DEFAULT NULL,
      image_size INT DEFAULT NULL,
      is_blocked TINYINT(1) NOT NULL DEFAULT 0,
      blocked_at TIMESTAMP NULL DEFAULT NULL,
      blocked_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_wall_of_wins_org_created (org_id, created_at),
      INDEX idx_wall_of_wins_user (org_id, user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  await db.query(
    'ALTER TABLE wall_of_wins_entries ADD COLUMN IF NOT EXISTS title VARCHAR(255) DEFAULT NULL',
  );
  await db.query(
    'ALTER TABLE wall_of_wins_entries ADD COLUMN IF NOT EXISTS is_blocked TINYINT(1) NOT NULL DEFAULT 0',
  );
  await db.query(
    'ALTER TABLE wall_of_wins_entries ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP NULL DEFAULT NULL',
  );
  await db.query(
    'ALTER TABLE wall_of_wins_entries ADD COLUMN IF NOT EXISTS blocked_by INT DEFAULT NULL',
  );
  await db.query(
    `CREATE TABLE IF NOT EXISTS wall_of_wins_likes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      entry_id INT NOT NULL,
      user_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_wall_of_wins_like (org_id, entry_id, user_id),
      INDEX idx_wall_of_wins_likes_entry (org_id, entry_id),
      CONSTRAINT fk_wall_of_wins_likes_entry FOREIGN KEY (entry_id) REFERENCES wall_of_wins_entries(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  await db.query(
    `CREATE TABLE IF NOT EXISTS wall_of_wins_comments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      entry_id INT NOT NULL,
      user_id INT NOT NULL,
      user_name VARCHAR(255) DEFAULT NULL,
      comment_text TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_wall_of_wins_comments_entry (org_id, entry_id, created_at),
      CONSTRAINT fk_wall_of_wins_comments_entry FOREIGN KEY (entry_id) REFERENCES wall_of_wins_entries(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
};

const resolveStoredImagePath = (imageUrl = '') => {
  let pathname = String(imageUrl || '');
  try {
    pathname = new URL(pathname).pathname;
  } catch {
    pathname = pathname.split('?')[0];
  }
  const marker = '/uploads/wall-of-wins/';
  const idx = pathname.indexOf(marker);
  if (idx === -1) return null;
  const relative = decodeURIComponent(pathname.slice(idx + marker.length));
  const root = path.join(__dirname, '..', 'uploads', 'wall-of-wins');
  const absolutePath = path.resolve(root, relative);
  const rootWithSep = `${path.resolve(root)}${path.sep}`;
  if (absolutePath !== path.resolve(root) && !absolutePath.startsWith(rootWithSep)) return null;
  return absolutePath;
};

const serializeEntry = (row) => ({
  id: row.id,
  user_id: row.user_id,
  user_name: row.user_name,
  title: row.title || '',
  image_url: row.image_url,
  image_name: row.image_name,
  image_mime: row.image_mime,
  image_size: row.image_size,
  likes_count: Number(row.likes_count || 0),
  comments_count: Number(row.comments_count || 0),
  is_liked: Boolean(row.is_liked),
  is_blocked: Boolean(row.is_blocked),
  created_at: row.created_at,
});

const listWallOfWins = async (req, res) => {
  try {
    await ensureWallOfWinsTable();
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }
    const requestedLimit = Number(req.query.limit || 18);
    const requestedOffset = Number(req.query.offset || 0);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 50) : 18;
    const offset = Number.isFinite(requestedOffset) ? Math.max(Math.floor(requestedOffset), 0) : 0;

    const includeBlocked = canModerateWallOfWins(req.user) && String(req.query.include_blocked || '') === '1';
    const blockedFilter = includeBlocked ? '' : ' AND COALESCE(e.is_blocked, 0) = 0';
    const userId = Number(req.user?.id) || 0;

    const [rows] = await db.query(
      `SELECT e.*,
        COALESCE(l.likes_count, 0) AS likes_count,
        COALESCE(c.comments_count, 0) AS comments_count,
        CASE WHEN ul.id IS NULL THEN 0 ELSE 1 END AS is_liked
       FROM wall_of_wins_entries e
       LEFT JOIN (
         SELECT org_id, entry_id, COUNT(*) AS likes_count
         FROM wall_of_wins_likes
         GROUP BY org_id, entry_id
       ) l ON l.org_id = e.org_id AND l.entry_id = e.id
       LEFT JOIN (
         SELECT org_id, entry_id, COUNT(*) AS comments_count
         FROM wall_of_wins_comments
         GROUP BY org_id, entry_id
       ) c ON c.org_id = e.org_id AND c.entry_id = e.id
       LEFT JOIN wall_of_wins_likes ul
         ON ul.org_id = e.org_id AND ul.entry_id = e.id AND ul.user_id = ?
       WHERE e.org_id = ?${blockedFilter}
       ORDER BY e.created_at DESC, e.id DESC
       LIMIT ${limit + 1} OFFSET ${offset}`,
      [userId, orgId],
    );
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return res.json({
      status: 'success',
      data: page.map((row) => serializeEntry(row)),
      pagination: {
        limit,
        offset,
        next_offset: offset + page.length,
        has_more: hasMore,
      },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to load Wall of Wins.' });
  }
};

const getWallWin = async (req, res) => {
  try {
    await ensureWallOfWinsTable();
    const orgId = resolveOrgId(req.user);
    const entryId = Number(req.params.entryId);
    if (!orgId || Number.isNaN(entryId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid id.' });
    }
    const includeBlocked = canModerateWallOfWins(req.user) && String(req.query.include_blocked || '') === '1';
    const blockedFilter = includeBlocked ? '' : ' AND COALESCE(is_blocked, 0) = 0';
    const userId = Number(req.user?.id) || 0;
    const [rows] = await db.query(
      `SELECT e.*,
        COALESCE(l.likes_count, 0) AS likes_count,
        COALESCE(c.comments_count, 0) AS comments_count,
        CASE WHEN ul.id IS NULL THEN 0 ELSE 1 END AS is_liked
       FROM wall_of_wins_entries e
       LEFT JOIN (
         SELECT org_id, entry_id, COUNT(*) AS likes_count
         FROM wall_of_wins_likes
         GROUP BY org_id, entry_id
       ) l ON l.org_id = e.org_id AND l.entry_id = e.id
       LEFT JOIN (
         SELECT org_id, entry_id, COUNT(*) AS comments_count
         FROM wall_of_wins_comments
         GROUP BY org_id, entry_id
       ) c ON c.org_id = e.org_id AND c.entry_id = e.id
       LEFT JOIN wall_of_wins_likes ul
         ON ul.org_id = e.org_id AND ul.entry_id = e.id AND ul.user_id = ?
       WHERE e.id = ? AND e.org_id = ?${blockedFilter}
       LIMIT 1`,
      [userId, entryId, orgId],
    );
    if (!rows.length) {
      return res.status(404).json({ status: 'error', message: 'Wall of Wins entry not found.' });
    }
    return res.json({ status: 'success', data: serializeEntry(rows[0]) });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to fetch wall entry.' });
  }
};

const toggleWallWinLike = async (req, res) => {
  try {
    await ensureWallOfWinsTable();
    const orgId = resolveOrgId(req.user);
    const userId = Number(req.user?.id);
    const entryId = Number(req.params.entryId);
    if (!orgId || !userId || Number.isNaN(entryId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid like request.' });
    }
    const [entryRows] = await db.query(
      'SELECT id, is_blocked FROM wall_of_wins_entries WHERE id = ? AND org_id = ? LIMIT 1',
      [entryId, orgId],
    );
    if (!entryRows.length) {
      return res.status(404).json({ status: 'error', message: 'Entry not found.' });
    }
    if (Number(entryRows[0].is_blocked) === 1 && !canModerateWallOfWins(req.user)) {
      return res.status(403).json({ status: 'error', message: 'Entry is blocked.' });
    }
    const [existingRows] = await db.query(
      'SELECT id FROM wall_of_wins_likes WHERE org_id = ? AND entry_id = ? AND user_id = ? LIMIT 1',
      [orgId, entryId, userId],
    );
    const isLiked = existingRows.length === 0;
    if (existingRows.length) {
      await db.query('DELETE FROM wall_of_wins_likes WHERE id = ? LIMIT 1', [existingRows[0].id]);
    } else {
      await db.query('INSERT INTO wall_of_wins_likes (org_id, entry_id, user_id) VALUES (?, ?, ?)', [
        orgId,
        entryId,
        userId,
      ]);
    }
    const [countRows] = await db.query(
      'SELECT COUNT(*) AS likeCount FROM wall_of_wins_likes WHERE org_id = ? AND entry_id = ?',
      [orgId, entryId],
    );
    return res.json({
      status: 'success',
      data: { entry_id: entryId, is_liked: isLiked, likes_count: Number(countRows[0]?.likeCount || 0) },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to update like.' });
  }
};

const getWallWinComments = async (req, res) => {
  try {
    await ensureWallOfWinsTable();
    const orgId = resolveOrgId(req.user);
    const entryId = Number(req.params.entryId);
    if (!orgId || Number.isNaN(entryId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid id.' });
    }
    const [entryRows] = await db.query(
      'SELECT id, is_blocked FROM wall_of_wins_entries WHERE id = ? AND org_id = ? LIMIT 1',
      [entryId, orgId],
    );
    if (!entryRows.length) return res.status(404).json({ status: 'error', message: 'Entry not found.' });
    if (Number(entryRows[0].is_blocked) === 1 && !canModerateWallOfWins(req.user)) {
      return res.status(403).json({ status: 'error', message: 'Entry is blocked.' });
    }
    const [rows] = await db.query(
      `SELECT id, entry_id, user_id, user_name, comment_text, created_at
       FROM wall_of_wins_comments
       WHERE org_id = ? AND entry_id = ?
       ORDER BY created_at ASC, id ASC`,
      [orgId, entryId],
    );
    return res.json({
      status: 'success',
      data: rows,
      comments_count: rows.length,
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to fetch comments.' });
  }
};

const createWallWinComment = async (req, res) => {
  try {
    await ensureWallOfWinsTable();
    const orgId = resolveOrgId(req.user);
    const userId = Number(req.user?.id);
    const entryId = Number(req.params.entryId);
    if (!orgId || !userId || Number.isNaN(entryId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid comment request.' });
    }
    const text = String(req.body?.comment_text || '').trim();
    if (!text) return res.status(400).json({ status: 'error', message: 'Comment text is required.' });
    const [entryRows] = await db.query(
      'SELECT id, is_blocked FROM wall_of_wins_entries WHERE id = ? AND org_id = ? LIMIT 1',
      [entryId, orgId],
    );
    if (!entryRows.length) return res.status(404).json({ status: 'error', message: 'Entry not found.' });
    if (Number(entryRows[0].is_blocked) === 1 && !canModerateWallOfWins(req.user)) {
      return res.status(403).json({ status: 'error', message: 'Entry is blocked.' });
    }
    const [result] = await db.query(
      `INSERT INTO wall_of_wins_comments (org_id, entry_id, user_id, user_name, comment_text)
       VALUES (?, ?, ?, ?, ?)`,
      [orgId, entryId, userId, req.user?.name || null, text],
    );
    const [rows] = await db.query(
      'SELECT id, entry_id, user_id, user_name, comment_text, created_at FROM wall_of_wins_comments WHERE id = ? LIMIT 1',
      [result.insertId],
    );
    const [countRows] = await db.query(
      'SELECT COUNT(*) AS commentCount FROM wall_of_wins_comments WHERE org_id = ? AND entry_id = ?',
      [orgId, entryId],
    );
    return res.status(201).json({
      status: 'success',
      data: {
        comment: rows[0],
        comments_count: Number(countRows[0]?.commentCount || 0),
      },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to add comment.' });
  }
};

const getWallWinSuggestions = async (req, res) => {
  try {
    await ensureWallOfWinsTable();
    const orgId = resolveOrgId(req.user);
    const entryId = Number(req.params.entryId);
    if (!orgId || Number.isNaN(entryId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid id.' });
    }
    const requestedLimit = Number(req.query.limit || 8);
    const requestedOffset = Number(req.query.offset || 0);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 20) : 8;
    const offset = Number.isFinite(requestedOffset) ? Math.max(Math.floor(requestedOffset), 0) : 0;
    const includeBlocked = canModerateWallOfWins(req.user) && String(req.query.include_blocked || '') === '1';
    const blockedFilter = includeBlocked ? '' : ' AND COALESCE(is_blocked, 0) = 0';
    const [rows] = await db.query(
      `SELECT * FROM wall_of_wins_entries
       WHERE org_id = ? AND id <> ?${blockedFilter}
       ORDER BY created_at DESC, id DESC
       LIMIT ${limit + 1} OFFSET ${offset}`,
      [orgId, entryId],
    );
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return res.json({
      status: 'success',
      data: page.map((row) => serializeEntry(row)),
      pagination: {
        limit,
        offset,
        next_offset: offset + page.length,
        has_more: hasMore,
      },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to load suggestions.' });
  }
};

const createWallWin = async (req, res) => {
  try {
    await ensureWallOfWinsTable();
    const orgId = resolveOrgId(req.user);
    const userId = Number(req.user?.id);
    if (!orgId || !userId) {
      return res.status(400).json({ status: 'error', message: 'Invalid session.' });
    }

    if (!canUploadWallOfWins(req.user)) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {
          /* ignore */
        }
      }
      return res.status(403).json({
        status: 'error',
        message: 'Only CEO or Admin accounts can upload to Wall of Wins.',
      });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ status: 'error', message: 'Please upload an image.' });
    }
    const title = String(req.body?.title || '').trim();
    if (!title) {
      if (file.path && fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
        } catch {
          /* ignore */
        }
      }
      return res.status(400).json({ status: 'error', message: 'Title is required.' });
    }
    const mime = String(file.mimetype || '');
    if (!mime.startsWith('image/')) {
      if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(400).json({ status: 'error', message: 'Only image files are allowed on Wall of Wins.' });
    }

    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/wall-of-wins/${file.filename}`;

    const [result] = await db.query(
      `INSERT INTO wall_of_wins_entries
      (org_id, user_id, user_name, title, image_url, image_name, image_mime, image_size)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orgId,
        userId,
        req.user?.name || null,
        title.slice(0, 255),
        imageUrl,
        file.originalname || null,
        file.mimetype || null,
        file.size || null,
      ],
    );

    const [createdRows] = await db.query(
      'SELECT * FROM wall_of_wins_entries WHERE id = ? AND org_id = ? LIMIT 1',
      [result.insertId, orgId],
    );

    return res.status(201).json({
      status: 'success',
      data: serializeEntry(createdRows[0]),
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to upload.' });
  }
};

const deleteWallWin = async (req, res) => {
  try {
    await ensureWallOfWinsTable();
    const orgId = resolveOrgId(req.user);
    const userId = Number(req.user?.id);
    const entryId = Number(req.params.entryId);
    if (!orgId || !userId || Number.isNaN(entryId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid request.' });
    }

    const [rows] = await db.query(
      'SELECT * FROM wall_of_wins_entries WHERE id = ? AND org_id = ? LIMIT 1',
      [entryId, orgId],
    );
    if (!rows.length) {
      return res.status(404).json({ status: 'error', message: 'Entry not found.' });
    }
    if (!canDeleteWallEntry(req.user)) {
      return res.status(403).json({ status: 'error', message: 'You cannot remove this entry.' });
    }

    const diskPath = resolveStoredImagePath(rows[0].image_url);
    await db.query('DELETE FROM wall_of_wins_entries WHERE id = ? AND org_id = ? LIMIT 1', [entryId, orgId]);
    if (diskPath && fs.existsSync(diskPath)) {
      try {
        fs.unlinkSync(diskPath);
      } catch {
        /* ignore */
      }
    }

    return res.json({ status: 'success', message: 'Removed.' });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to delete.' });
  }
};

const toggleWallWinBlock = async (req, res) => {
  try {
    await ensureWallOfWinsTable();
    const orgId = resolveOrgId(req.user);
    const entryId = Number(req.params.entryId);
    const moderatorId = Number(req.user?.id);
    if (!orgId || Number.isNaN(entryId) || !canModerateWallOfWins(req.user)) {
      return res.status(403).json({ status: 'error', message: 'Not allowed.' });
    }

    const blocked = Boolean(req.body?.blocked);
    const [rows] = await db.query(
      'SELECT id FROM wall_of_wins_entries WHERE id = ? AND org_id = ? LIMIT 1',
      [entryId, orgId],
    );
    if (!rows.length) {
      return res.status(404).json({ status: 'error', message: 'Entry not found.' });
    }

    if (blocked) {
      await db.query(
        `UPDATE wall_of_wins_entries
         SET is_blocked = 1, blocked_at = CURRENT_TIMESTAMP, blocked_by = ?
         WHERE id = ? AND org_id = ?`,
        [moderatorId, entryId, orgId],
      );
    } else {
      await db.query(
        `UPDATE wall_of_wins_entries
         SET is_blocked = 0, blocked_at = NULL, blocked_by = NULL
         WHERE id = ? AND org_id = ?`,
        [entryId, orgId],
      );
    }

    return res.json({ status: 'success', data: { id: entryId, is_blocked: blocked } });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to update.' });
  }
};

module.exports = {
  listWallOfWins,
  getWallWin,
  getWallWinSuggestions,
  toggleWallWinLike,
  getWallWinComments,
  createWallWinComment,
  createWallWin,
  deleteWallWin,
  toggleWallWinBlock,
};
