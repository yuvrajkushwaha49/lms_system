const db = require('../config/db');

const resolveOrgId = (user) => user?.org_id || user?.business_id || null;

const canManageGallery = (user) => {
  const role = String(user?.role_name || '').toLowerCase();
  return ['ceo', 'admin', 'instructor'].includes(role);
};

const ensureGalleryFoldersTable = async () => {
  await db.query(
    `CREATE TABLE IF NOT EXISTS gallery_folders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      description VARCHAR(1000) DEFAULT '',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_gallery_folders_org (org_id, is_active, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
};

const ensureGalleryImagesTable = async () => {
  await db.query(
    `CREATE TABLE IF NOT EXISTS gallery_images (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      folder_id INT NOT NULL,
      title VARCHAR(255) DEFAULT '',
      caption VARCHAR(500) DEFAULT '',
      file_url VARCHAR(1000) NOT NULL,
      file_name VARCHAR(500) DEFAULT '',
      sort_order INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_gallery_images_folder (org_id, folder_id, is_active, sort_order, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
};

const ensureGalleryLikesTable = async () => {
  await db.query(
    `CREATE TABLE IF NOT EXISTS gallery_likes (
      org_id INT NOT NULL,
      target_type VARCHAR(20) NOT NULL,
      target_id INT NOT NULL,
      user_id INT NOT NULL,
      user_name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (org_id, target_type, target_id, user_id),
      INDEX idx_gallery_likes_target (org_id, target_type, target_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
};

const ensureGalleryCommentsTable = async () => {
  await db.query(
    `CREATE TABLE IF NOT EXISTS gallery_comments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      folder_id INT NOT NULL,
      image_id INT NULL DEFAULT NULL,
      user_id INT NOT NULL,
      user_name VARCHAR(255) NOT NULL,
      body VARCHAR(5000) NOT NULL,
      parent_id INT NULL DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_gallery_comments_folder (org_id, folder_id, image_id, created_at),
      INDEX idx_gallery_comments_parent (org_id, folder_id, parent_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
};

const ensureGalleryCommentLikesTable = async () => {
  await db.query(
    `CREATE TABLE IF NOT EXISTS gallery_comment_likes (
      org_id INT NOT NULL,
      comment_id INT NOT NULL,
      user_id INT NOT NULL,
      user_name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (org_id, comment_id, user_id),
      INDEX idx_gallery_comment_likes (org_id, comment_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
};

const ensureGalleryCommentReportsTable = async () => {
  await db.query(
    `CREATE TABLE IF NOT EXISTS gallery_comment_reports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      folder_id INT NOT NULL,
      image_id INT NULL DEFAULT NULL,
      comment_id INT NOT NULL,
      reporter_user_id INT NOT NULL,
      reporter_name VARCHAR(255) DEFAULT NULL,
      reason VARCHAR(255) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_gallery_comment_report (org_id, comment_id, reporter_user_id),
      INDEX idx_gallery_comment_reports_org (org_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
};

const ensureAllGalleryTables = async () => {
  await ensureGalleryFoldersTable();
  await ensureGalleryImagesTable();
  await ensureGalleryLikesTable();
  await ensureGalleryCommentsTable();
  await ensureGalleryCommentLikesTable();
  await ensureGalleryCommentReportsTable();
};

const countLikes = async (orgId, targetType, targetId) => {
  await ensureGalleryLikesTable();
  const [rows] = await db.query(
    `SELECT COUNT(*) AS c FROM gallery_likes WHERE org_id = ? AND target_type = ? AND target_id = ?`,
    [orgId, targetType, targetId],
  );
  return Number(rows[0]?.c || 0);
};

const userLikedTarget = async (orgId, targetType, targetId, userId) => {
  if (!orgId || !targetType || !targetId || !userId) return false;
  await ensureGalleryLikesTable();
  const [r] = await db.query(
    `SELECT 1 FROM gallery_likes WHERE org_id = ? AND target_type = ? AND target_id = ? AND user_id = ? LIMIT 1`,
    [orgId, targetType, targetId, userId],
  );
  return r.length > 0;
};

const mapFolderRow = async (row, opts = {}) => {
  const orgId = row.org_id;
  const id = Number(row.id);
  const likeTotal =
    row.like_total != null
      ? Number(row.like_total)
      : await countLikes(orgId, 'folder', id);
  const imageTotal = row.image_total != null ? Number(row.image_total) : 0;
  return {
    id,
    name: row.name || '',
    description: row.description || '',
    likes: likeTotal,
    imageCount: imageTotal,
    coverImageUrl: row.cover_file_url || '',
    likedByMe: Boolean(opts.likedByMe),
    isActive: Number(row.is_active ?? 1) === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const mapImageRow = async (row, opts = {}) => {
  const orgId = row.org_id;
  const id = Number(row.id);
  const likeTotal =
    row.like_total != null
      ? Number(row.like_total)
      : await countLikes(orgId, 'image', id);
  return {
    id,
    folderId: Number(row.folder_id),
    title: row.title || '',
    caption: row.caption || '',
    fileUrl: row.file_url || '',
    fileName: row.file_name || '',
    likes: likeTotal,
    likedByMe: Boolean(opts.likedByMe),
    isActive: Number(row.is_active ?? 1) === 1,
    createdAt: row.created_at,
  };
};

const mapCommentRow = (row, opts = {}) => ({
  id: Number(row.id),
  folderId: Number(row.folder_id),
  imageId: row.image_id != null ? Number(row.image_id) : null,
  userId: Number(row.user_id),
  userName: row.user_name || '',
  body: row.body || '',
  parentId: row.parent_id != null ? Number(row.parent_id) : null,
  likes: Number(row.like_total != null ? row.like_total : 0),
  likedByMe: Boolean(opts.likedByMe),
  createdAt: row.created_at,
});

const getFolderRow = async (orgId, folderId) => {
  await ensureAllGalleryTables();
  const [rows] = await db.query(
    `SELECT f.*,
      (SELECT COUNT(*) FROM gallery_likes l WHERE l.org_id = f.org_id AND l.target_type = 'folder' AND l.target_id = f.id) AS like_total,
      (SELECT COUNT(*) FROM gallery_images gi WHERE gi.org_id = f.org_id AND gi.folder_id = f.id AND gi.is_active = 1) AS image_total,
      (SELECT gi.file_url FROM gallery_images gi
       WHERE gi.org_id = f.org_id AND gi.folder_id = f.id AND gi.is_active = 1
       ORDER BY gi.sort_order ASC, gi.created_at ASC, gi.id ASC LIMIT 1) AS cover_file_url
     FROM gallery_folders f WHERE f.org_id = ? AND f.id = ? LIMIT 1`,
    [orgId, folderId],
  );
  return rows.length ? rows[0] : null;
};

const folderVisibleToUser = (row, user) => {
  if (!row) return false;
  if (Number(row.is_active ?? 1) !== 1 && !canManageGallery(user)) return false;
  return true;
};

const loadCommentsForTarget = async (orgId, folderId, imageId, userId) => {
  await ensureGalleryCommentsTable();
  await ensureGalleryCommentLikesTable();
  const imageClause = imageId == null ? 'AND c.image_id IS NULL' : 'AND c.image_id = ?';
  const params = imageId == null ? [orgId, folderId] : [orgId, folderId, imageId];
  const [rows] = await db.query(
    `SELECT c.id, c.org_id, c.folder_id, c.image_id, c.user_id, c.user_name, c.body, c.parent_id, c.created_at,
      (SELECT COUNT(*) FROM gallery_comment_likes cl WHERE cl.org_id = c.org_id AND cl.comment_id = c.id) AS like_total
     FROM gallery_comments c
     WHERE c.org_id = ? AND c.folder_id = ? ${imageClause}
     ORDER BY c.created_at ASC, c.id ASC`,
    params,
  );
  let likedIds = new Set();
  if (userId && rows.length) {
    const ids = rows.map((r) => r.id);
    const ph = ids.map(() => '?').join(',');
    const [likedRows] = await db.query(
      `SELECT comment_id FROM gallery_comment_likes WHERE org_id = ? AND user_id = ? AND comment_id IN (${ph})`,
      [orgId, userId, ...ids],
    );
    likedIds = new Set(likedRows.map((x) => Number(x.comment_id)));
  }
  return rows.map((r) => mapCommentRow(r, { likedByMe: likedIds.has(Number(r.id)) }));
};

const addTargetLike = async (req, res, targetType, targetId, verifyFn) => {
  try {
    await ensureAllGalleryTables();
    const orgId = resolveOrgId(req.user);
    const userId = Number(req.user?.id);
    if (!orgId || !userId || !targetId) {
      return res.status(400).json({ status: 'error', message: 'Invalid request.' });
    }
    const ok = await verifyFn(orgId, targetId);
    if (!ok) {
      return res.status(404).json({ status: 'error', message: 'Not found.' });
    }
    const userName = String(req.user?.name || req.user?.email || 'Member').trim().slice(0, 255) || 'Member';
    try {
      await db.query(
        `INSERT INTO gallery_likes (org_id, target_type, target_id, user_id, user_name) VALUES (?, ?, ?, ?, ?)`,
        [orgId, targetType, targetId, userId, userName],
      );
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY' || e.errno === 1062) {
        const likes = await countLikes(orgId, targetType, targetId);
        return res.json({
          status: 'success',
          data: { likes, likedByMe: true },
          alreadyLiked: true,
        });
      }
      throw e;
    }
    const likes = await countLikes(orgId, targetType, targetId);
    return res.json({
      status: 'success',
      data: { likes, likedByMe: true },
      alreadyLiked: false,
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to update like.' });
  }
};

const createComment = async (req, res, folderId, imageId) => {
  try {
    await ensureAllGalleryTables();
    const orgId = resolveOrgId(req.user);
    const bodyText = String(req.body?.body ?? req.body?.text ?? '').trim();
    const userId = Number(req.user?.id);
    if (!orgId || !folderId || !userId) {
      return res.status(400).json({ status: 'error', message: 'Invalid request.' });
    }
    if (!bodyText) {
      return res.status(400).json({ status: 'error', message: 'Comment cannot be empty.' });
    }
    if (bodyText.length > 5000) {
      return res.status(400).json({ status: 'error', message: 'Comment is too long.' });
    }
    const folder = await getFolderRow(orgId, folderId);
    if (!folder || !folderVisibleToUser(folder, req.user)) {
      return res.status(404).json({ status: 'error', message: 'Folder not found.' });
    }
    if (imageId != null) {
      const [irows] = await db.query(
        `SELECT id FROM gallery_images WHERE id = ? AND org_id = ? AND folder_id = ? AND is_active = 1 LIMIT 1`,
        [imageId, orgId, folderId],
      );
      if (!irows.length) {
        return res.status(404).json({ status: 'error', message: 'Image not found.' });
      }
    }
    let parentId = null;
    const rawParent = req.body?.parentId ?? req.body?.parent_id;
    if (rawParent != null && rawParent !== '') {
      parentId = Number(rawParent);
      if (!Number.isFinite(parentId) || parentId <= 0) {
        return res.status(400).json({ status: 'error', message: 'Invalid parent comment.' });
      }
      const imgClause = imageId == null ? 'AND image_id IS NULL' : 'AND image_id = ?';
      const pParams = imageId == null ? [parentId, orgId, folderId] : [parentId, orgId, folderId, imageId];
      const [prows] = await db.query(
        `SELECT id FROM gallery_comments WHERE id = ? AND org_id = ? AND folder_id = ? ${imgClause} LIMIT 1`,
        pParams,
      );
      if (!prows.length) {
        return res.status(400).json({ status: 'error', message: 'Parent comment not found.' });
      }
    }
    const userName = String(req.user?.name || req.user?.email || 'Member').trim().slice(0, 255) || 'Member';
    const [ins] = await db.query(
      `INSERT INTO gallery_comments (org_id, folder_id, image_id, user_id, user_name, body, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [orgId, folderId, imageId, userId, userName, bodyText, parentId],
    );
    const [crows] = await db.query(
      `SELECT c.id, c.org_id, c.folder_id, c.image_id, c.user_id, c.user_name, c.body, c.parent_id, c.created_at,
        (SELECT COUNT(*) FROM gallery_comment_likes cl WHERE cl.org_id = c.org_id AND cl.comment_id = c.id) AS like_total
       FROM gallery_comments c WHERE c.id = ? LIMIT 1`,
      [ins.insertId],
    );
    return res.json({
      status: 'success',
      data: { comment: mapCommentRow(crows[0], { likedByMe: false }) },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to post comment.' });
  }
};

const getGalleryFolders = async (req, res) => {
  try {
    await ensureAllGalleryTables();
    const orgId = resolveOrgId(req.user);
    const userId = Number(req.user?.id);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing.' });
    }
    const includeInactive = canManageGallery(req.user) && String(req.query.include_inactive || '') === '1';
    const activeClause = includeInactive ? '' : ' AND f.is_active = 1';
    const [rows] = await db.query(
      `SELECT f.*,
        (SELECT COUNT(*) FROM gallery_likes l WHERE l.org_id = f.org_id AND l.target_type = 'folder' AND l.target_id = f.id) AS like_total,
        (SELECT COUNT(*) FROM gallery_images gi WHERE gi.org_id = f.org_id AND gi.folder_id = f.id AND gi.is_active = 1) AS image_total,
        (SELECT gi.file_url FROM gallery_images gi
         WHERE gi.org_id = f.org_id AND gi.folder_id = f.id AND gi.is_active = 1
         ORDER BY gi.sort_order ASC, gi.created_at ASC, gi.id ASC LIMIT 1) AS cover_file_url
       FROM gallery_folders f
       WHERE f.org_id = ?${activeClause}
       ORDER BY f.created_at DESC, f.id DESC`,
      [orgId],
    );
    let likedSet = new Set();
    if (userId && rows.length) {
      const ids = rows.map((r) => r.id);
      const ph = ids.map(() => '?').join(',');
      const [likedRows] = await db.query(
        `SELECT target_id FROM gallery_likes WHERE org_id = ? AND target_type = 'folder' AND user_id = ? AND target_id IN (${ph})`,
        [orgId, userId, ...ids],
      );
      likedSet = new Set(likedRows.map((x) => Number(x.target_id)));
    }
    const data = await Promise.all(
      rows.map((r) => mapFolderRow(r, { likedByMe: likedSet.has(Number(r.id)) })),
    );
    return res.json({ status: 'success', data });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to load folders.' });
  }
};

const createGalleryFolder = async (req, res) => {
  try {
    await ensureAllGalleryTables();
    if (!canManageGallery(req.user)) {
      return res.status(403).json({ status: 'error', message: 'Access denied.' });
    }
    const orgId = resolveOrgId(req.user);
    const name = String(req.body?.name ?? '').trim();
    const description = String(req.body?.description ?? '').trim().slice(0, 1000);
    if (!orgId || !name) {
      return res.status(400).json({ status: 'error', message: 'Folder name is required.' });
    }
    const [ins] = await db.query(
      `INSERT INTO gallery_folders (org_id, name, description) VALUES (?, ?, ?)`,
      [orgId, name.slice(0, 255), description],
    );
    const row = await getFolderRow(orgId, ins.insertId);
    const data = await mapFolderRow(row, { likedByMe: false });
    return res.json({ status: 'success', data });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to create folder.' });
  }
};

const getGalleryFolder = async (req, res) => {
  try {
    await ensureAllGalleryTables();
    const orgId = resolveOrgId(req.user);
    const folderId = Number(req.params.folderId);
    const userId = Number(req.user?.id);
    if (!orgId || Number.isNaN(folderId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid request.' });
    }
    const row = await getFolderRow(orgId, folderId);
    if (!row || !folderVisibleToUser(row, req.user)) {
      return res.status(404).json({ status: 'error', message: 'Folder not found.' });
    }
    const likedByMe = userId ? await userLikedTarget(orgId, 'folder', folderId, userId) : false;
    const data = await mapFolderRow(row, { likedByMe });
    return res.json({ status: 'success', data });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to load folder.' });
  }
};

const deleteGalleryFolder = async (req, res) => {
  try {
    await ensureAllGalleryTables();
    if (!canManageGallery(req.user)) {
      return res.status(403).json({ status: 'error', message: 'Access denied.' });
    }
    const orgId = resolveOrgId(req.user);
    const folderId = Number(req.params.folderId);
    if (!orgId || Number.isNaN(folderId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid request.' });
    }
    const [result] = await db.query(
      `UPDATE gallery_folders SET is_active = 0 WHERE id = ? AND org_id = ?`,
      [folderId, orgId],
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Folder not found.' });
    }
    await db.query(
      `UPDATE gallery_images SET is_active = 0 WHERE folder_id = ? AND org_id = ?`,
      [folderId, orgId],
    );
    return res.json({ status: 'success', data: { id: folderId } });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to delete folder.' });
  }
};

const getGalleryFolderImages = async (req, res) => {
  try {
    await ensureAllGalleryTables();
    const orgId = resolveOrgId(req.user);
    const folderId = Number(req.params.folderId);
    const userId = Number(req.user?.id);
    if (!orgId || Number.isNaN(folderId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid request.' });
    }
    const folder = await getFolderRow(orgId, folderId);
    if (!folder || !folderVisibleToUser(folder, req.user)) {
      return res.status(404).json({ status: 'error', message: 'Folder not found.' });
    }
    const [rows] = await db.query(
      `SELECT gi.*,
        (SELECT COUNT(*) FROM gallery_likes l WHERE l.org_id = gi.org_id AND l.target_type = 'image' AND l.target_id = gi.id) AS like_total
       FROM gallery_images gi
       WHERE gi.org_id = ? AND gi.folder_id = ? AND gi.is_active = 1
       ORDER BY gi.sort_order ASC, gi.created_at ASC, gi.id ASC`,
      [orgId, folderId],
    );
    let likedSet = new Set();
    if (userId && rows.length) {
      const ids = rows.map((r) => r.id);
      const ph = ids.map(() => '?').join(',');
      const [likedRows] = await db.query(
        `SELECT target_id FROM gallery_likes WHERE org_id = ? AND target_type = 'image' AND user_id = ? AND target_id IN (${ph})`,
        [orgId, userId, ...ids],
      );
      likedSet = new Set(likedRows.map((x) => Number(x.target_id)));
    }
    const data = await Promise.all(
      rows.map((r) => mapImageRow(r, { likedByMe: likedSet.has(Number(r.id)) })),
    );
    return res.json({ status: 'success', data });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to load images.' });
  }
};

const uploadGalleryImages = async (req, res) => {
  try {
    await ensureAllGalleryTables();
    if (!canManageGallery(req.user)) {
      return res.status(403).json({ status: 'error', message: 'Access denied.' });
    }
    const orgId = resolveOrgId(req.user);
    const folderId = Number(req.params.folderId);
    if (!orgId || Number.isNaN(folderId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid request.' });
    }
    const folder = await getFolderRow(orgId, folderId);
    if (!folder) {
      return res.status(404).json({ status: 'error', message: 'Folder not found.' });
    }
    const files = Array.isArray(req.files) ? req.files : req.file ? [req.file] : [];
    if (!files.length) {
      return res.status(400).json({ status: 'error', message: 'No images uploaded.' });
    }
    const title = String(req.body?.title ?? '').trim().slice(0, 255);
    const caption = String(req.body?.caption ?? '').trim().slice(0, 500);
    const inserted = [];
    for (let i = 0; i < files.length; i += 1) {
      const f = files[i];
      const fileUrl = `/uploads/gallery/${f.filename}`;
      const fileName = f.originalname || f.filename;
      const [ins] = await db.query(
        `INSERT INTO gallery_images (org_id, folder_id, title, caption, file_url, file_name, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [orgId, folderId, title || fileName, caption, fileUrl, fileName, i],
      );
      const [rows] = await db.query(`SELECT * FROM gallery_images WHERE id = ? LIMIT 1`, [ins.insertId]);
      inserted.push(await mapImageRow(rows[0], { likedByMe: false }));
    }
    return res.json({ status: 'success', data: inserted });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to upload images.' });
  }
};

const deleteGalleryImage = async (req, res) => {
  try {
    await ensureAllGalleryTables();
    if (!canManageGallery(req.user)) {
      return res.status(403).json({ status: 'error', message: 'Access denied.' });
    }
    const orgId = resolveOrgId(req.user);
    const imageId = Number(req.params.imageId);
    if (!orgId || Number.isNaN(imageId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid request.' });
    }
    const [result] = await db.query(
      `UPDATE gallery_images SET is_active = 0 WHERE id = ? AND org_id = ?`,
      [imageId, orgId],
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Image not found.' });
    }
    return res.json({ status: 'success', data: { id: imageId } });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to delete image.' });
  }
};

const likeGalleryFolder = async (req, res) => {
  const orgId = resolveOrgId(req.user);
  const folderId = Number(req.params.folderId);
  return addTargetLike(req, res, 'folder', folderId, async (o, id) => {
    const row = await getFolderRow(o, id);
    return row && folderVisibleToUser(row, req.user);
  });
};

const likeGalleryImage = async (req, res) => {
  const orgId = resolveOrgId(req.user);
  const imageId = Number(req.params.imageId);
  return addTargetLike(req, res, 'image', imageId, async (o, id) => {
    const [rows] = await db.query(
      `SELECT gi.*, f.is_active AS folder_active FROM gallery_images gi
       JOIN gallery_folders f ON f.id = gi.folder_id AND f.org_id = gi.org_id
       WHERE gi.id = ? AND gi.org_id = ? AND gi.is_active = 1 LIMIT 1`,
      [id, o],
    );
    if (!rows.length) return false;
    const pseudoFolder = { is_active: rows[0].folder_active };
    return folderVisibleToUser(pseudoFolder, req.user);
  });
};

const getGalleryFolderComments = async (req, res) => {
  try {
    await ensureAllGalleryTables();
    const orgId = resolveOrgId(req.user);
    const folderId = Number(req.params.folderId);
    const userId = Number(req.user?.id);
    if (!orgId || Number.isNaN(folderId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid request.' });
    }
    const folder = await getFolderRow(orgId, folderId);
    if (!folder || !folderVisibleToUser(folder, req.user)) {
      return res.status(404).json({ status: 'error', message: 'Folder not found.' });
    }
    const data = await loadCommentsForTarget(orgId, folderId, null, userId);
    return res.json({ status: 'success', data });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to load comments.' });
  }
};

const createGalleryFolderComment = async (req, res) => {
  const folderId = Number(req.params.folderId);
  return createComment(req, res, folderId, null);
};

const getGalleryImageComments = async (req, res) => {
  try {
    await ensureAllGalleryTables();
    const orgId = resolveOrgId(req.user);
    const imageId = Number(req.params.imageId);
    const userId = Number(req.user?.id);
    if (!orgId || Number.isNaN(imageId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid request.' });
    }
    const [irows] = await db.query(
      `SELECT gi.*, f.is_active AS folder_active FROM gallery_images gi
       JOIN gallery_folders f ON f.id = gi.folder_id AND f.org_id = gi.org_id
       WHERE gi.id = ? AND gi.org_id = ? AND gi.is_active = 1 LIMIT 1`,
      [imageId, orgId],
    );
    if (!irows.length || !folderVisibleToUser({ is_active: irows[0].folder_active }, req.user)) {
      return res.status(404).json({ status: 'error', message: 'Image not found.' });
    }
    const folderId = Number(irows[0].folder_id);
    const data = await loadCommentsForTarget(orgId, folderId, imageId, userId);
    return res.json({ status: 'success', data });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to load comments.' });
  }
};

const createGalleryImageComment = async (req, res) => {
  try {
    await ensureAllGalleryTables();
    const orgId = resolveOrgId(req.user);
    const imageId = Number(req.params.imageId);
    const [irows] = await db.query(
      `SELECT folder_id FROM gallery_images WHERE id = ? AND org_id = ? AND is_active = 1 LIMIT 1`,
      [imageId, orgId],
    );
    if (!irows.length) {
      return res.status(404).json({ status: 'error', message: 'Image not found.' });
    }
    return createComment(req, res, Number(irows[0].folder_id), imageId);
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to post comment.' });
  }
};

const likeGalleryComment = async (req, res) => {
  try {
    await ensureAllGalleryTables();
    const orgId = resolveOrgId(req.user);
    const commentId = Number(req.params.commentId);
    const userId = Number(req.user?.id);
    if (!orgId || Number.isNaN(commentId) || !userId) {
      return res.status(400).json({ status: 'error', message: 'Invalid request.' });
    }
    const [crows] = await db.query(
      `SELECT c.*, f.is_active AS folder_active FROM gallery_comments c
       JOIN gallery_folders f ON f.id = c.folder_id AND f.org_id = c.org_id
       WHERE c.id = ? AND c.org_id = ? LIMIT 1`,
      [commentId, orgId],
    );
    if (!crows.length || !folderVisibleToUser({ is_active: crows[0].folder_active }, req.user)) {
      return res.status(404).json({ status: 'error', message: 'Comment not found.' });
    }
    const userName = String(req.user?.name || req.user?.email || 'Member').trim().slice(0, 255) || 'Member';
    try {
      await db.query(
        `INSERT INTO gallery_comment_likes (org_id, comment_id, user_id, user_name) VALUES (?, ?, ?, ?)`,
        [orgId, commentId, userId, userName],
      );
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY' || e.errno === 1062) {
        const [dup] = await db.query(
          `SELECT c.id, c.org_id, c.folder_id, c.image_id, c.user_id, c.user_name, c.body, c.parent_id, c.created_at,
            (SELECT COUNT(*) FROM gallery_comment_likes cl WHERE cl.org_id = c.org_id AND cl.comment_id = c.id) AS like_total
           FROM gallery_comments c WHERE c.id = ? LIMIT 1`,
          [commentId],
        );
        return res.json({
          status: 'success',
          data: mapCommentRow(dup[0], { likedByMe: true }),
          alreadyLiked: true,
        });
      }
      throw e;
    }
    const [fresh] = await db.query(
      `SELECT c.id, c.org_id, c.folder_id, c.image_id, c.user_id, c.user_name, c.body, c.parent_id, c.created_at,
        (SELECT COUNT(*) FROM gallery_comment_likes cl WHERE cl.org_id = c.org_id AND cl.comment_id = c.id) AS like_total
       FROM gallery_comments c WHERE c.id = ? LIMIT 1`,
      [commentId],
    );
    return res.json({
      status: 'success',
      data: mapCommentRow(fresh[0], { likedByMe: true }),
      alreadyLiked: false,
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to update comment like.' });
  }
};

const getCommentRow = async (orgId, commentId) => {
  await ensureGalleryCommentsTable();
  const [rows] = await db.query(
    `SELECT c.*, f.is_active AS folder_active FROM gallery_comments c
     JOIN gallery_folders f ON f.id = c.folder_id AND f.org_id = c.org_id
     WHERE c.id = ? AND c.org_id = ? LIMIT 1`,
    [commentId, orgId],
  );
  return rows.length ? rows[0] : null;
};

const updateGalleryComment = async (req, res) => {
  try {
    await ensureAllGalleryTables();
    const orgId = resolveOrgId(req.user);
    const commentId = Number(req.params.commentId);
    const userId = Number(req.user?.id);
    const bodyText = String(req.body?.body ?? req.body?.text ?? '').trim();
    if (!orgId || Number.isNaN(commentId) || !userId) {
      return res.status(400).json({ status: 'error', message: 'Invalid request.' });
    }
    if (!bodyText) {
      return res.status(400).json({ status: 'error', message: 'Comment cannot be empty.' });
    }
    if (bodyText.length > 5000) {
      return res.status(400).json({ status: 'error', message: 'Comment is too long.' });
    }
    const row = await getCommentRow(orgId, commentId);
    if (!row || !folderVisibleToUser({ is_active: row.folder_active }, req.user)) {
      return res.status(404).json({ status: 'error', message: 'Comment not found.' });
    }
    if (Number(row.user_id) !== userId && !canManageGallery(req.user)) {
      return res.status(403).json({ status: 'error', message: 'You can only edit your own comments.' });
    }
    await db.query(`UPDATE gallery_comments SET body = ? WHERE id = ? AND org_id = ?`, [
      bodyText,
      commentId,
      orgId,
    ]);
    const [fresh] = await db.query(
      `SELECT c.id, c.org_id, c.folder_id, c.image_id, c.user_id, c.user_name, c.body, c.parent_id, c.created_at,
        (SELECT COUNT(*) FROM gallery_comment_likes cl WHERE cl.org_id = c.org_id AND cl.comment_id = c.id) AS like_total
       FROM gallery_comments c WHERE c.id = ? LIMIT 1`,
      [commentId],
    );
    const likedByMe = await db
      .query(
        `SELECT 1 FROM gallery_comment_likes WHERE org_id = ? AND comment_id = ? AND user_id = ? LIMIT 1`,
        [orgId, commentId, userId],
      )
      .then(([r]) => r.length > 0);
    return res.json({
      status: 'success',
      data: mapCommentRow(fresh[0], { likedByMe }),
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to update comment.' });
  }
};

const createGalleryCommentReport = async (req, res) => {
  try {
    await ensureAllGalleryTables();
    const orgId = resolveOrgId(req.user);
    const userId = Number(req.user?.id);
    const commentId = Number(req.params.commentId);
    const reason = String(req.body?.reason ?? '').trim();
    if (!orgId || !userId || Number.isNaN(commentId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid report request.' });
    }
    if (!reason) {
      return res.status(400).json({ status: 'error', message: 'Report reason is required.' });
    }
    const row = await getCommentRow(orgId, commentId);
    if (!row || !folderVisibleToUser({ is_active: row.folder_active }, req.user)) {
      return res.status(404).json({ status: 'error', message: 'Comment not found.' });
    }
    const reporterName = String(req.user?.name || req.user?.email || 'Member').trim().slice(0, 255) || 'Member';
    await db.query(
      `INSERT INTO gallery_comment_reports (org_id, folder_id, image_id, comment_id, reporter_user_id, reporter_name, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         reason = VALUES(reason),
         reporter_name = VALUES(reporter_name),
         status = 'pending',
         updated_at = CURRENT_TIMESTAMP`,
      [orgId, row.folder_id, row.image_id, commentId, userId, reporterName, reason.slice(0, 255)],
    );
    return res.status(201).json({ status: 'success', message: 'Report submitted.' });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to submit report.' });
  }
};

module.exports = {
  getGalleryFolders,
  createGalleryFolder,
  getGalleryFolder,
  deleteGalleryFolder,
  getGalleryFolderImages,
  uploadGalleryImages,
  deleteGalleryImage,
  likeGalleryFolder,
  likeGalleryImage,
  getGalleryFolderComments,
  createGalleryFolderComment,
  getGalleryImageComments,
  createGalleryImageComment,
  likeGalleryComment,
  updateGalleryComment,
  createGalleryCommentReport,
};
