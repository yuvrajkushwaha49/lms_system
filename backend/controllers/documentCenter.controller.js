const fs = require('fs').promises;
const path = require('path');
const db = require('../config/db');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'document-center');

const resolveOrgId = (user) => user?.org_id || user?.business_id || null;

const canManageDocuments = (user) => {
  const role = String(user?.role_name || '').toLowerCase();
  return ['ceo', 'admin', 'instructor'].includes(role);
};

const ensureDocumentCenterCommentsTable = async () => {
  await db.query(
    `CREATE TABLE IF NOT EXISTS document_center_item_comments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      item_id INT NOT NULL,
      user_id INT NOT NULL,
      user_name VARCHAR(255) NOT NULL,
      body VARCHAR(5000) NOT NULL,
      parent_id INT NULL DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_dc_item_comments (org_id, item_id, created_at),
      INDEX idx_dc_comment_parent (org_id, item_id, parent_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  try {
    const [cols] = await db.query(
      `SELECT 1 AS ok FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'document_center_item_comments' AND COLUMN_NAME = 'parent_id' LIMIT 1`,
    );
    if (!cols.length) {
      await db.query(
        `ALTER TABLE document_center_item_comments ADD COLUMN parent_id INT NULL DEFAULT NULL AFTER body`,
      );
      try {
        await db.query(
          `ALTER TABLE document_center_item_comments ADD INDEX idx_dc_comment_parent (org_id, item_id, parent_id)`,
        );
      } catch (e) {
        if (e.code !== 'ER_DUP_KEYNAME') throw e;
      }
    }
  } catch (e) {
    if (e.code !== 'ER_DUP_FIELDNAME') throw e;
  }
};

const ensureDocumentCenterLikesTable = async () => {
  await db.query(
    `CREATE TABLE IF NOT EXISTS document_center_item_likes (
      org_id INT NOT NULL,
      item_id INT NOT NULL,
      user_id INT NOT NULL,
      user_name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (org_id, item_id, user_id),
      INDEX idx_dc_likes_item_time (org_id, item_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
};

const ensureDocumentCenterCommentLikesTable = async () => {
  await db.query(
    `CREATE TABLE IF NOT EXISTS document_center_comment_likes (
      org_id INT NOT NULL,
      item_id INT NOT NULL,
      comment_id INT NOT NULL,
      user_id INT NOT NULL,
      user_name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (org_id, item_id, comment_id, user_id),
      INDEX idx_dc_comment_likes_comment (org_id, item_id, comment_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
};

const ensureDocumentCenterItemsTable = async () => {
  await db.query(
    `CREATE TABLE IF NOT EXISTS document_center_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      title VARCHAR(500) NOT NULL,
      subtitle VARCHAR(300) DEFAULT '',
      category VARCHAR(120) DEFAULT '',
      series_label VARCHAR(200) DEFAULT '',
      header_tone VARCHAR(20) NOT NULL DEFAULT 'blue',
      card_label VARCHAR(200) DEFAULT '',
      file_url VARCHAR(1000) DEFAULT '',
      file_name VARCHAR(500) DEFAULT '',
      likes_count INT NOT NULL DEFAULT 0,
      comments_count INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_dc_org_active (org_id, is_active, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
};

const mapRow = (row, opts = {}) => ({
  id: Number(row.id),
  title: row.title || '',
  subtitle: row.subtitle || '',
  category: row.category || '',
  seriesLabel: row.series_label || '',
  headerTone: String(row.header_tone || 'blue').toLowerCase() === 'navy' ? 'navy' : 'blue',
  cardLabel: row.card_label || '',
  fileUrl: row.file_url || '',
  fileName: row.file_name || '',
  likes: Number(row.like_total != null ? row.like_total : row.likes_count || 0),
  comments: Number(row.comment_total != null ? row.comment_total : row.comments_count || 0),
  likedByMe: Boolean(opts.likedByMe),
  isActive: Number(row.is_active ?? 1) === 1,
  createdAt: row.created_at,
});

const userLikedItem = async (orgId, itemId, userId) => {
  if (!orgId || !itemId || !userId) return false;
  await ensureDocumentCenterLikesTable();
  const [r] = await db.query(
    `SELECT 1 FROM document_center_item_likes WHERE org_id = ? AND item_id = ? AND user_id = ? LIMIT 1`,
    [orgId, itemId, userId],
  );
  return r.length > 0;
};

const syncEngagementCounts = async (orgId, itemId) => {
  await ensureDocumentCenterLikesTable();
  await ensureDocumentCenterCommentsTable();
  await db.query(
    `UPDATE document_center_items SET
       likes_count = (SELECT COUNT(*) FROM document_center_item_likes WHERE org_id = ? AND item_id = ?),
       comments_count = (SELECT COUNT(*) FROM document_center_item_comments WHERE org_id = ? AND item_id = ?)
     WHERE id = ? AND org_id = ?`,
    [orgId, itemId, orgId, itemId, itemId, orgId],
  );
};

const getItemRow = async (orgId, id) => {
  await ensureDocumentCenterLikesTable();
  await ensureDocumentCenterCommentsTable();
  const [rows] = await db.query(
    `SELECT i.*,
      (SELECT COUNT(*) FROM document_center_item_likes l WHERE l.org_id = i.org_id AND l.item_id = i.id) AS like_total,
      (SELECT COUNT(*) FROM document_center_item_comments c WHERE c.org_id = i.org_id AND c.item_id = i.id) AS comment_total
     FROM document_center_items i WHERE i.org_id = ? AND i.id = ? LIMIT 1`,
    [orgId, id],
  );
  return rows.length ? rows[0] : null;
};

const mapCommentRow = (row, opts = {}) => ({
  id: Number(row.id),
  userId: Number(row.user_id),
  userName: row.user_name || '',
  body: row.body || '',
  parentId: row.parent_id != null ? Number(row.parent_id) : null,
  likes: Number(row.like_total != null ? row.like_total : row.likes_count || 0),
  likedByMe: Boolean(opts.likedByMe),
  createdAt: row.created_at,
});

const itemVisibleToUser = (row, user) => {
  if (!row) return false;
  const isActive = Number(row.is_active ?? 1) === 1;
  if (!isActive && !canManageDocuments(user)) return false;
  return true;
};

const listDocumentCenterFiles = async (req, res) => {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const names = await fs.readdir(UPLOAD_DIR);
    const files = [];
    for (const name of names) {
      const fp = path.join(UPLOAD_DIR, name);
      const st = await fs.lstat(fp);
      if (!st.isFile()) continue;
      files.push({
        name,
        url: `/uploads/document-center/${name}`,
        size: st.size,
        mtime: st.mtime.toISOString(),
      });
    }
    files.sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
    return res.json({ status: 'success', data: { files } });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to list files.' });
  }
};

const uploadDocumentCenterFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: 'error', message: 'File is required.' });
    }
    const url = `/uploads/document-center/${req.file.filename}`;
    return res.json({
      status: 'success',
      data: {
        url,
        name: req.file.filename,
        originalName: req.file.originalname || req.file.filename,
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to upload.' });
  }
};

const getDocumentCenterItem = async (req, res) => {
  try {
    await ensureDocumentCenterItemsTable();
    const orgId = resolveOrgId(req.user);
    const id = Number(req.params.id);
    if (!orgId || Number.isNaN(id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid request.' });
    }
    const row = await getItemRow(orgId, id);
    if (!row || !itemVisibleToUser(row, req.user)) {
      return res.status(404).json({ status: 'error', message: 'Document not found.' });
    }
    const uid = Number(req.user?.id);
    const likedByMe = uid ? await userLikedItem(orgId, id, uid) : false;
    return res.json({ status: 'success', data: mapRow(row, { likedByMe }) });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to load document.' });
  }
};

const getDocumentCenterLikes = async (req, res) => {
  try {
    await ensureDocumentCenterItemsTable();
    await ensureDocumentCenterLikesTable();
    const orgId = resolveOrgId(req.user);
    const id = Number(req.params.id);
    if (!orgId || Number.isNaN(id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid request.' });
    }
    const row = await getItemRow(orgId, id);
    if (!row || !itemVisibleToUser(row, req.user)) {
      return res.status(404).json({ status: 'error', message: 'Document not found.' });
    }
    const [likesRows] = await db.query(
      `SELECT user_id, user_name, created_at FROM document_center_item_likes
       WHERE org_id = ? AND item_id = ? ORDER BY created_at DESC LIMIT 50`,
      [orgId, id],
    );
    const data = likesRows.map((lr) => ({
      userId: Number(lr.user_id),
      userName: lr.user_name || '',
      createdAt: lr.created_at,
    }));
    return res.json({ status: 'success', data });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to load likes.' });
  }
};

const getDocumentCenterComments = async (req, res) => {
  try {
    await ensureDocumentCenterItemsTable();
    await ensureDocumentCenterCommentsTable();
    await ensureDocumentCenterCommentLikesTable();
    const orgId = resolveOrgId(req.user);
    const id = Number(req.params.id);
    const userId = Number(req.user?.id);
    if (!orgId || Number.isNaN(id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid request.' });
    }
    const row = await getItemRow(orgId, id);
    if (!row || !itemVisibleToUser(row, req.user)) {
      return res.status(404).json({ status: 'error', message: 'Document not found.' });
    }
    const [rows] = await db.query(
      `SELECT c.id, c.user_id, c.user_name, c.body, c.parent_id, c.created_at,
        (SELECT COUNT(*) FROM document_center_comment_likes cl
         WHERE cl.org_id = c.org_id AND cl.item_id = c.item_id AND cl.comment_id = c.id) AS like_total
       FROM document_center_item_comments c
       WHERE c.org_id = ? AND c.item_id = ? ORDER BY c.created_at ASC, c.id ASC`,
      [orgId, id],
    );
    let likedCommentIds = new Set();
    if (userId && rows.length) {
      const commentIds = rows.map((r) => r.id);
      const ph = commentIds.map(() => '?').join(',');
      const [likedRows] = await db.query(
        `SELECT comment_id FROM document_center_comment_likes
         WHERE org_id = ? AND item_id = ? AND user_id = ? AND comment_id IN (${ph})`,
        [orgId, id, userId, ...commentIds],
      );
      likedCommentIds = new Set(likedRows.map((x) => Number(x.comment_id)));
    }
    return res.json({
      status: 'success',
      data: rows.map((r) => mapCommentRow(r, { likedByMe: likedCommentIds.has(Number(r.id)) })),
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to load comments.' });
  }
};

const createDocumentCenterComment = async (req, res) => {
  try {
    await ensureDocumentCenterItemsTable();
    await ensureDocumentCenterCommentsTable();
    const orgId = resolveOrgId(req.user);
    const id = Number(req.params.id);
    const bodyText = String(req.body?.body ?? req.body?.text ?? '').trim();
    if (!orgId || Number.isNaN(id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid request.' });
    }
    if (!bodyText) {
      return res.status(400).json({ status: 'error', message: 'Comment cannot be empty.' });
    }
    if (bodyText.length > 5000) {
      return res.status(400).json({ status: 'error', message: 'Comment is too long.' });
    }
    const itemRow = await getItemRow(orgId, id);
    if (!itemRow || !itemVisibleToUser(itemRow, req.user)) {
      return res.status(404).json({ status: 'error', message: 'Document not found.' });
    }
    const userId = Number(req.user?.id);
    if (!userId) {
      return res.status(400).json({ status: 'error', message: 'User context missing.' });
    }
    const userName = String(req.user?.name || req.user?.email || 'Member').trim().slice(0, 255) || 'Member';
    let parentId = null;
    const rawParent = req.body?.parentId ?? req.body?.parent_id;
    if (rawParent != null && rawParent !== '') {
      parentId = Number(rawParent);
      if (!Number.isFinite(parentId) || parentId <= 0) {
        return res.status(400).json({ status: 'error', message: 'Invalid parent comment.' });
      }
      const [prows] = await db.query(
        `SELECT id FROM document_center_item_comments WHERE id = ? AND org_id = ? AND item_id = ? LIMIT 1`,
        [parentId, orgId, id],
      );
      if (!prows.length) {
        return res.status(400).json({ status: 'error', message: 'Parent comment not found.' });
      }
    }
    const [ins] = await db.query(
      `INSERT INTO document_center_item_comments (org_id, item_id, user_id, user_name, body, parent_id) VALUES (?, ?, ?, ?, ?, ?)`,
      [orgId, id, userId, userName, bodyText, parentId],
    );
    await syncEngagementCounts(orgId, id);
    const [crows] = await db.query(
      `SELECT c.id, c.user_id, c.user_name, c.body, c.parent_id, c.created_at,
        (SELECT COUNT(*) FROM document_center_comment_likes cl
         WHERE cl.org_id = c.org_id AND cl.item_id = c.item_id AND cl.comment_id = c.id) AS like_total
       FROM document_center_item_comments c WHERE c.id = ? LIMIT 1`,
      [ins.insertId],
    );
    const freshItem = await getItemRow(orgId, id);
    const likedByMe = await userLikedItem(orgId, id, userId);
    return res.json({
      status: 'success',
      data: {
        comment: mapCommentRow(crows[0], { likedByMe: false }),
        item: mapRow(freshItem, { likedByMe }),
      },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to post comment.' });
  }
};

const getDocumentCenterItems = async (req, res) => {
  try {
    await ensureDocumentCenterItemsTable();
    await ensureDocumentCenterLikesTable();
    await ensureDocumentCenterCommentsTable();
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }
    const includeInactive =
      canManageDocuments(req.user) && String(req.query.include_inactive || '') === '1';
    const activeClause = includeInactive ? '' : ' AND is_active = 1';
    const [rows] = await db.query(
      `SELECT i.id, i.org_id, i.title, i.subtitle, i.category, i.series_label, i.header_tone, i.card_label, i.file_url, i.file_name,
              i.likes_count, i.comments_count, i.is_active, i.created_at, i.updated_at,
              (SELECT COUNT(*) FROM document_center_item_likes l WHERE l.org_id = i.org_id AND l.item_id = i.id) AS like_total,
              (SELECT COUNT(*) FROM document_center_item_comments c WHERE c.org_id = i.org_id AND c.item_id = i.id) AS comment_total
       FROM document_center_items i
       WHERE i.org_id = ?${activeClause}
       ORDER BY i.created_at DESC, i.id DESC`,
      [orgId],
    );
    const uid = Number(req.user?.id);
    let likedSet = new Set();
    if (uid && rows.length) {
      const ids = rows.map((r) => r.id);
      const ph = ids.map(() => '?').join(',');
      const [likedRows] = await db.query(
        `SELECT item_id FROM document_center_item_likes WHERE org_id = ? AND user_id = ? AND item_id IN (${ph})`,
        [orgId, uid, ...ids],
      );
      likedSet = new Set(likedRows.map((x) => Number(x.item_id)));
    }
    return res.json({
      status: 'success',
      data: rows.map((r) => mapRow(r, { likedByMe: likedSet.has(Number(r.id)) })),
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to load documents.' });
  }
};

const createDocumentCenterItem = async (req, res) => {
  try {
    await ensureDocumentCenterItemsTable();
    if (!canManageDocuments(req.user)) {
      return res.status(403).json({ status: 'error', message: 'Access denied.' });
    }
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }
    const title = String(req.body?.title || '').trim();
    if (!title) {
      return res.status(400).json({ status: 'error', message: 'Title is required.' });
    }
    const subtitle = String(req.body?.subtitle || '').trim();
    const category = String(req.body?.category || '').trim();
    const seriesLabel = String((req.body?.series_label ?? req.body?.seriesLabel) || '').trim();
    const cardLabel = String((req.body?.card_label ?? req.body?.cardLabel) || '').trim();
    const headerTone =
      String((req.body?.header_tone ?? req.body?.headerTone) || 'blue').toLowerCase() === 'navy' ? 'navy' : 'blue';
    const fileUrl = String((req.body?.file_url ?? req.body?.fileUrl) || '').trim();
    const fileName = String((req.body?.file_name ?? req.body?.fileName) || '').trim();

    const [result] = await db.query(
      `INSERT INTO document_center_items
       (org_id, title, subtitle, category, series_label, header_tone, card_label, file_url, file_name, likes_count, comments_count, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 1)`,
      [orgId, title, subtitle, category, seriesLabel, headerTone, cardLabel, fileUrl, fileName],
    );
    const row = await getItemRow(orgId, result.insertId);
    const uid = Number(req.user?.id);
    const likedByMe = uid ? await userLikedItem(orgId, result.insertId, uid) : false;
    return res.json({ status: 'success', data: mapRow(row, { likedByMe }) });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to create document.' });
  }
};

const updateDocumentCenterItem = async (req, res) => {
  try {
    await ensureDocumentCenterItemsTable();
    if (!canManageDocuments(req.user)) {
      return res.status(403).json({ status: 'error', message: 'Access denied.' });
    }
    const orgId = resolveOrgId(req.user);
    const id = Number(req.params.id);
    if (!orgId || Number.isNaN(id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid request.' });
    }
    const existing = await getItemRow(orgId, id);
    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Document not found.' });
    }
    const b = req.body || {};
    const title = b.title !== undefined ? String(b.title).trim() : String(existing.title || '').trim();
    if (!title) {
      return res.status(400).json({ status: 'error', message: 'Title is required.' });
    }
    const subtitle = b.subtitle !== undefined ? String(b.subtitle).trim() : String(existing.subtitle || '').trim();
    const category = b.category !== undefined ? String(b.category).trim() : String(existing.category || '').trim();
    const seriesLabel =
      b.series_label !== undefined || b.seriesLabel !== undefined
        ? String(b.series_label ?? b.seriesLabel).trim()
        : String(existing.series_label || '').trim();
    const cardLabel =
      b.card_label !== undefined || b.cardLabel !== undefined
        ? String(b.card_label ?? b.cardLabel).trim()
        : String(existing.card_label || '').trim();
    const headerToneRaw = b.header_tone ?? b.headerTone ?? existing.header_tone ?? 'blue';
    const headerTone = String(headerToneRaw).toLowerCase() === 'navy' ? 'navy' : 'blue';
    const fileUrl =
      b.file_url !== undefined || b.fileUrl !== undefined
        ? String(b.file_url ?? b.fileUrl).trim()
        : String(existing.file_url || '').trim();
    const fileName =
      b.file_name !== undefined || b.fileName !== undefined
        ? String(b.file_name ?? b.fileName).trim()
        : String(existing.file_name || '').trim();
    let isActive = Number(existing.is_active) === 1 ? 1 : 0;
    if (b.is_active !== undefined || b.isActive !== undefined) {
      isActive = Number(b.is_active ?? b.isActive) === 1 ? 1 : 0;
    }

    await db.query(
      `UPDATE document_center_items SET
         title = ?, subtitle = ?, category = ?, series_label = ?, header_tone = ?, card_label = ?, file_url = ?, file_name = ?, is_active = ?
       WHERE id = ? AND org_id = ?`,
      [title, subtitle, category, seriesLabel, headerTone, cardLabel, fileUrl, fileName, isActive, id, orgId],
    );
    const row = await getItemRow(orgId, id);
    const uid = Number(req.user?.id);
    const likedByMe = uid ? await userLikedItem(orgId, id, uid) : false;
    return res.json({ status: 'success', data: mapRow(row, { likedByMe }) });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to update document.' });
  }
};

const deleteDocumentCenterItem = async (req, res) => {
  try {
    await ensureDocumentCenterItemsTable();
    if (!canManageDocuments(req.user)) {
      return res.status(403).json({ status: 'error', message: 'Access denied.' });
    }
    const orgId = resolveOrgId(req.user);
    const id = Number(req.params.id);
    if (!orgId || Number.isNaN(id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid request.' });
    }
    const [result] = await db.query('UPDATE document_center_items SET is_active = 0 WHERE id = ? AND org_id = ?', [
      id,
      orgId,
    ]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Document not found.' });
    }
    return res.json({ status: 'success', data: { id } });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to delete document.' });
  }
};

const addDocumentCenterLike = async (req, res) => {
  try {
    await ensureDocumentCenterItemsTable();
    await ensureDocumentCenterLikesTable();
    const orgId = resolveOrgId(req.user);
    const id = Number(req.params.id);
    const userId = Number(req.user?.id);
    if (!orgId || Number.isNaN(id) || !userId) {
      return res.status(400).json({ status: 'error', message: 'Invalid request.' });
    }
    const row = await getItemRow(orgId, id);
    if (!row || !itemVisibleToUser(row, req.user)) {
      return res.status(404).json({ status: 'error', message: 'Document not found.' });
    }
    const userName = String(req.user?.name || req.user?.email || 'Member').trim().slice(0, 255) || 'Member';
    try {
      await db.query(
        `INSERT INTO document_center_item_likes (org_id, item_id, user_id, user_name) VALUES (?, ?, ?, ?)`,
        [orgId, id, userId, userName],
      );
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY' || e.errno === 1062) {
        const fresh = await getItemRow(orgId, id);
        return res.json({
          status: 'success',
          data: mapRow(fresh, { likedByMe: true }),
          alreadyLiked: true,
        });
      }
      throw e;
    }
    await syncEngagementCounts(orgId, id);
    const fresh = await getItemRow(orgId, id);
    return res.json({
      status: 'success',
      data: mapRow(fresh, { likedByMe: true }),
      alreadyLiked: false,
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to update like.' });
  }
};

const addDocumentCenterCommentLike = async (req, res) => {
  try {
    await ensureDocumentCenterItemsTable();
    await ensureDocumentCenterCommentsTable();
    await ensureDocumentCenterCommentLikesTable();
    const orgId = resolveOrgId(req.user);
    const itemId = Number(req.params.id);
    const commentId = Number(req.params.commentId);
    const userId = Number(req.user?.id);
    if (!orgId || Number.isNaN(itemId) || Number.isNaN(commentId) || !userId) {
      return res.status(400).json({ status: 'error', message: 'Invalid request.' });
    }
    const itemRow = await getItemRow(orgId, itemId);
    if (!itemRow || !itemVisibleToUser(itemRow, req.user)) {
      return res.status(404).json({ status: 'error', message: 'Document not found.' });
    }
    const [crows] = await db.query(
      `SELECT id FROM document_center_item_comments WHERE id = ? AND org_id = ? AND item_id = ? LIMIT 1`,
      [commentId, orgId, itemId],
    );
    if (!crows.length) {
      return res.status(404).json({ status: 'error', message: 'Comment not found.' });
    }
    const userName = String(req.user?.name || req.user?.email || 'Member').trim().slice(0, 255) || 'Member';
    try {
      await db.query(
        `INSERT INTO document_center_comment_likes (org_id, item_id, comment_id, user_id, user_name) VALUES (?, ?, ?, ?, ?)`,
        [orgId, itemId, commentId, userId, userName],
      );
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY' || e.errno === 1062) {
        const [dupRows] = await db.query(
          `SELECT c.id, c.user_id, c.user_name, c.body, c.parent_id, c.created_at,
            (SELECT COUNT(*) FROM document_center_comment_likes cl
             WHERE cl.org_id = c.org_id AND cl.item_id = c.item_id AND cl.comment_id = c.id) AS like_total
           FROM document_center_item_comments c WHERE c.id = ? LIMIT 1`,
          [commentId],
        );
        return res.json({
          status: 'success',
          data: mapCommentRow(dupRows[0], { likedByMe: true }),
          alreadyLiked: true,
        });
      }
      throw e;
    }
    const [freshRows] = await db.query(
      `SELECT c.id, c.user_id, c.user_name, c.body, c.parent_id, c.created_at,
        (SELECT COUNT(*) FROM document_center_comment_likes cl
         WHERE cl.org_id = c.org_id AND cl.item_id = c.item_id AND cl.comment_id = c.id) AS like_total
       FROM document_center_item_comments c WHERE c.id = ? LIMIT 1`,
      [commentId],
    );
    return res.json({
      status: 'success',
      data: mapCommentRow(freshRows[0], { likedByMe: true }),
      alreadyLiked: false,
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to update comment like.' });
  }
};

const incrementDocumentCenterComment = async (req, res) => {
  try {
    await ensureDocumentCenterItemsTable();
    await ensureDocumentCenterLikesTable();
    await ensureDocumentCenterCommentsTable();
    const orgId = resolveOrgId(req.user);
    const id = Number(req.params.id);
    const userId = Number(req.user?.id);
    if (!orgId || Number.isNaN(id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid request.' });
    }
    const row = await getItemRow(orgId, id);
    if (!row || !itemVisibleToUser(row, req.user)) {
      return res.status(404).json({ status: 'error', message: 'Document not found.' });
    }
    await syncEngagementCounts(orgId, id);
    const fresh = await getItemRow(orgId, id);
    const likedByMe = userId ? await userLikedItem(orgId, id, userId) : false;
    return res.json({ status: 'success', data: mapRow(fresh, { likedByMe }) });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to refresh comment count.' });
  }
};

module.exports = {
  listDocumentCenterFiles,
  uploadDocumentCenterFile,
  getDocumentCenterItem,
  getDocumentCenterItems,
  getDocumentCenterComments,
  getDocumentCenterLikes,
  createDocumentCenterComment,
  createDocumentCenterItem,
  updateDocumentCenterItem,
  deleteDocumentCenterItem,
  addDocumentCenterLike,
  addDocumentCenterCommentLike,
  incrementDocumentCenterComment,
};
