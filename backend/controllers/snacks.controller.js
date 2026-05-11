const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const db = require('../config/db');

const SNACK_CATEGORIES = [
  'Ask Ryan Anything',
  'Workshop Replays',
  'One Minute With...',
  'Toolkit',
  'Course Clips',
];

const VIDEO_VARIANTS = [
  { resolution: '360p', height: 360 },
  { resolution: '720p', height: 720 },
  { resolution: '1080p', height: 1080 },
];

const resolveOrgId = (user) => user?.org_id || user?.business_id || null;

const ensureSnacksTable = async () => {
  await db.query(
    `CREATE TABLE IF NOT EXISTS sell_it_snacks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      category VARCHAR(80) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT DEFAULT NULL,
      video_url VARCHAR(1024) NOT NULL,
      thumbnail_url VARCHAR(1024) DEFAULT NULL,
      video_name VARCHAR(255) DEFAULT NULL,
      thumbnail_name VARCHAR(255) DEFAULT NULL,
      created_by INT DEFAULT NULL,
      processing_status ENUM('ready', 'processing', 'failed') NOT NULL DEFAULT 'ready',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_sell_it_snacks_org_category (org_id, category, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  await db.query(
    "ALTER TABLE sell_it_snacks ADD COLUMN IF NOT EXISTS processing_status ENUM('ready', 'processing', 'failed') NOT NULL DEFAULT 'ready'",
  );
  await db.query(
    `CREATE TABLE IF NOT EXISTS sell_it_snack_video_variants (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      snack_id INT NOT NULL,
      resolution VARCHAR(20) NOT NULL,
      media_url VARCHAR(1024) DEFAULT NULL,
      status ENUM('pending', 'processing', 'ready', 'failed') NOT NULL DEFAULT 'pending',
      error_message TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_sell_it_snack_variant (snack_id, resolution),
      INDEX idx_sell_it_snack_variants_snack (org_id, snack_id),
      CONSTRAINT fk_sell_it_snack_variants_snack FOREIGN KEY (snack_id) REFERENCES sell_it_snacks(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  await db.query(
    `CREATE TABLE IF NOT EXISTS sell_it_snack_likes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      snack_id INT NOT NULL,
      user_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_sell_it_snack_like (org_id, snack_id, user_id),
      INDEX idx_sell_it_snack_likes_snack (org_id, snack_id),
      CONSTRAINT fk_sell_it_snack_likes_snack FOREIGN KEY (snack_id) REFERENCES sell_it_snacks(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  await db.query(
    `CREATE TABLE IF NOT EXISTS sell_it_snack_comments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      snack_id INT NOT NULL,
      user_id INT NOT NULL,
      user_name VARCHAR(255) DEFAULT NULL,
      comment_text TEXT NOT NULL,
      is_blocked TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_sell_it_snack_comments_snack (org_id, snack_id, created_at),
      CONSTRAINT fk_sell_it_snack_comments_snack FOREIGN KEY (snack_id) REFERENCES sell_it_snacks(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  await db.query(
    'ALTER TABLE sell_it_snack_comments ADD COLUMN IF NOT EXISTS is_blocked TINYINT(1) NOT NULL DEFAULT 0',
  );
  await db.query(
    'ALTER TABLE sell_it_snack_comments ADD COLUMN IF NOT EXISTS parent_comment_id INT DEFAULT NULL',
  );
  await db.query(
    `CREATE TABLE IF NOT EXISTS sell_it_snack_comment_reactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      snack_id INT NOT NULL,
      comment_id INT NOT NULL,
      user_id INT NOT NULL,
      reaction ENUM('like', 'dislike') NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_sell_it_snack_comment_reaction (org_id, snack_id, comment_id, user_id),
      INDEX idx_sell_it_snack_comment_reactions_comment (org_id, snack_id, comment_id),
      CONSTRAINT fk_sell_it_snack_comment_reactions_snack FOREIGN KEY (snack_id) REFERENCES sell_it_snacks(id) ON DELETE CASCADE,
      CONSTRAINT fk_sell_it_snack_comment_reactions_comment FOREIGN KEY (comment_id) REFERENCES sell_it_snack_comments(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  await db.query(
    `CREATE TABLE IF NOT EXISTS sell_it_snack_comment_reports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      snack_id INT NOT NULL,
      comment_id INT NOT NULL,
      reporter_user_id INT NOT NULL,
      reporter_name VARCHAR(255) DEFAULT NULL,
      reason VARCHAR(255) NOT NULL,
      status ENUM('pending', 'reviewed', 'resolved') NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_snack_comment_report (org_id, snack_id, comment_id, reporter_user_id),
      INDEX idx_snack_comment_reports_org (org_id, created_at),
      CONSTRAINT fk_snack_comment_reports_snack FOREIGN KEY (snack_id) REFERENCES sell_it_snacks(id) ON DELETE CASCADE,
      CONSTRAINT fk_snack_comment_reports_comment FOREIGN KEY (comment_id) REFERENCES sell_it_snack_comments(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
};

const validateSnackOwnership = async ({ orgId, snackId }) => {
  const [rows] = await db.query(
    'SELECT id FROM sell_it_snacks WHERE id = ? AND org_id = ? LIMIT 1',
    [snackId, orgId],
  );
  return rows.length > 0;
};

const canModerateSnackComments = (user) => {
  const r = String(user?.role_name || '').toLowerCase();
  return ['ceo', 'admin', 'instructor', 'trainer'].includes(r);
};

const canModifySnackComment = (user, commentAuthorId) => {
  const uid = Number(user?.id);
  const aid = Number(commentAuthorId);
  return (!Number.isNaN(uid) && uid === aid) || canModerateSnackComments(user);
};

const collectDescendantSnackCommentIds = async (orgId, snackId, rootId) => {
  const collected = [];
  let frontier = [rootId];
  while (frontier.length) {
    const ph = frontier.map(() => '?').join(', ');
    const [rows] = await db.query(
      `SELECT id FROM sell_it_snack_comments WHERE org_id = ? AND snack_id = ? AND parent_comment_id IN (${ph})`,
      [orgId, snackId, ...frontier],
    );
    if (!rows.length) break;
    const ids = rows.map((r) => r.id);
    collected.push(...ids);
    frontier = ids;
  }
  return collected;
};

const toUploadUrl = (req, filename) =>
  `${req.protocol}://${req.get('host')}/uploads/snacks-media/${String(filename).replace(/\\/g, '/')}`;

const runFfmpegVariant = (inputPath, outputPath, height) =>
  new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-i',
      inputPath,
      '-vf',
      `scale=-2:${height}`,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '23',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      outputPath,
    ];
    const ffmpeg = spawn(ffmpegPath, args);
    let stderr = '';
    ffmpeg.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    ffmpeg.on('error', reject);
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr || `FFmpeg exited with code ${code}`));
    });
  });

const updateSnackProcessingStatus = async (snackId) => {
  const [rows] = await db.query(
    `SELECT
      SUM(CASE WHEN status IN ('pending', 'processing') THEN 1 ELSE 0 END) AS processing_count,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count
     FROM sell_it_snack_video_variants
     WHERE snack_id = ?`,
    [snackId],
  );
  const processingCount = Number(rows[0]?.processing_count || 0);
  const failedCount = Number(rows[0]?.failed_count || 0);
  if (processingCount === 0) {
    await db.query(
      'UPDATE sell_it_snacks SET processing_status = ? WHERE id = ?',
      [failedCount > 0 ? 'failed' : 'ready', snackId],
    );
  }
};

const processSnackVideoVariants = async ({ req, orgId, snackId, inputPath }) => {
  if (!ffmpegPath) {
    await db.query(
      "UPDATE sell_it_snack_video_variants SET status = 'failed', error_message = ? WHERE snack_id = ?",
      ['FFmpeg binary is not available.', snackId],
    );
    await updateSnackProcessingStatus(snackId);
    return;
  }

  const variantDir = path.join(__dirname, '..', 'uploads', 'snacks-media', 'video-variants', String(snackId));
  fs.mkdirSync(variantDir, { recursive: true });

  await Promise.all(
    VIDEO_VARIANTS.map(async (variant) => {
      const outputFilename = `${variant.resolution}.mp4`;
      const outputPath = path.join(variantDir, outputFilename);
      const mediaUrl = toUploadUrl(req, `video-variants/${snackId}/${outputFilename}`);
      try {
        await db.query(
          "UPDATE sell_it_snack_video_variants SET status = 'processing', error_message = NULL WHERE snack_id = ? AND resolution = ?",
          [snackId, variant.resolution],
        );
        await runFfmpegVariant(inputPath, outputPath, variant.height);
        await db.query(
          "UPDATE sell_it_snack_video_variants SET status = 'ready', media_url = ?, error_message = NULL WHERE snack_id = ? AND resolution = ?",
          [mediaUrl, snackId, variant.resolution],
        );
      } catch (error) {
        await db.query(
          "UPDATE sell_it_snack_video_variants SET status = 'failed', error_message = ? WHERE snack_id = ? AND resolution = ?",
          [String(error.message || error).slice(0, 1000), snackId, variant.resolution],
        );
      }
    }),
  );
  await updateSnackProcessingStatus(snackId);
};

const serializeSnack = (snack) => ({
  id: snack.id,
  category: snack.category,
  title: snack.title,
  description: snack.description,
  video_url: snack.video_url,
  thumbnail_url: snack.thumbnail_url,
  video_name: snack.video_name,
  thumbnail_name: snack.thumbnail_name,
  processing_status: snack.processing_status || 'ready',
  likes_count: Number(snack.likes_count || 0),
  comments_count: Number(snack.comments_count || 0),
  video_variants: (snack.video_variants || []).map((variant) => ({
    id: variant.id,
    resolution: variant.resolution,
    media_url: variant.media_url,
    status: variant.status,
    error_message: variant.error_message,
  })),
  created_at: snack.created_at,
});

const attachSnackVariants = async (orgId, snacks) => {
  const snackIds = snacks.map((snack) => snack.id);
  const placeholders = snackIds.map(() => '?').join(', ');
  const [variantRows] = snackIds.length
    ? await db.query(
      `SELECT id, snack_id, resolution, media_url, status, error_message
       FROM sell_it_snack_video_variants
       WHERE org_id = ? AND snack_id IN (${placeholders})
       ORDER BY FIELD(resolution, '360p', '720p', '1080p'), id ASC`,
      [orgId, ...snackIds],
    )
    : [[]];
  return snacks.map((snack) => ({
    ...snack,
    video_variants: variantRows.filter((variant) => Number(variant.snack_id) === Number(snack.id)),
  }));
};

const attachSnackCounts = async (orgId, snacks) => {
  if (!snacks.length) return snacks;
  const ids = snacks.map((s) => s.id);
  const placeholders = ids.map(() => '?').join(', ');
  const [likeRows] = await db.query(
    `SELECT snack_id, COUNT(*) AS c
     FROM sell_it_snack_likes
     WHERE org_id = ? AND snack_id IN (${placeholders})
     GROUP BY snack_id`,
    [orgId, ...ids],
  );
  const [commentRows] = await db.query(
    `SELECT snack_id, COUNT(*) AS c
     FROM sell_it_snack_comments
     WHERE org_id = ? AND snack_id IN (${placeholders}) AND is_blocked = 0
     GROUP BY snack_id`,
    [orgId, ...ids],
  );
  const likeMap = Object.fromEntries(likeRows.map((row) => [String(row.snack_id), Number(row.c)]));
  const commentMap = Object.fromEntries(commentRows.map((row) => [String(row.snack_id), Number(row.c)]));
  return snacks.map((snack) => ({
    ...snack,
    likes_count: likeMap[String(snack.id)] || 0,
    comments_count: commentMap[String(snack.id)] || 0,
  }));
};

const loadSnackEngagement = async ({ orgId, snackId, userId }) => {
  const [likeRows] = await db.query(
    `SELECT COUNT(*) AS like_count,
            SUM(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS liked_by_me
     FROM sell_it_snack_likes
     WHERE org_id = ? AND snack_id = ?`,
    [userId, orgId, snackId],
  );
  const likeCount = Number(likeRows[0]?.like_count || 0);
  const liked = Number(likeRows[0]?.liked_by_me || 0) > 0;

  return { liked, like_count: likeCount };
};

const fetchSnackCommentReactionMap = async ({ orgId, snackId, userId, commentIds }) => {
  const reactionMap = {};
  if (!commentIds.length) return reactionMap;
  const ph = commentIds.map(() => '?').join(', ');
  const [reactionRows] = await db.query(
    `SELECT comment_id,
            SUM(CASE WHEN reaction = 'like' THEN 1 ELSE 0 END) AS likes_count,
            SUM(CASE WHEN reaction = 'dislike' THEN 1 ELSE 0 END) AS dislikes_count,
            MAX(CASE WHEN user_id = ? THEN reaction ELSE NULL END) AS my_reaction
     FROM sell_it_snack_comment_reactions
     WHERE org_id = ? AND snack_id = ? AND comment_id IN (${ph})
     GROUP BY comment_id`,
    [userId, orgId, snackId, ...commentIds],
  );
  reactionRows.forEach((row) => {
    reactionMap[String(row.comment_id)] = {
      likes_count: Number(row.likes_count || 0),
      dislikes_count: Number(row.dislikes_count || 0),
      my_reaction: row.my_reaction || null,
    };
  });
  return reactionMap;
};

const mapSnackCommentRow = (row, reactionMap) => {
  const commentReaction = reactionMap[String(row.id)] || {
    likes_count: 0,
    dislikes_count: 0,
    my_reaction: null,
  };
  return {
    id: row.id,
    parent_comment_id: row.parent_comment_id != null ? Number(row.parent_comment_id) : null,
    snack_id: row.snack_id,
    user_id: row.user_id,
    user_name: row.user_name,
    text: row.comment_text,
    createdAt: row.created_at,
    likesCount: commentReaction.likes_count,
    dislikesCount: commentReaction.dislikes_count,
    myReaction: commentReaction.my_reaction,
    replies: [],
  };
};

const getSnacks = async (req, res) => {
  try {
    await ensureSnacksTable();
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }
    const category = String(req.query.category || '').trim();
    const categoryFilter = category && category !== 'All' ? ' AND category = ?' : '';
    const params = categoryFilter ? [orgId, category] : [orgId];
    const [rows] = await db.query(
      `SELECT *
       FROM sell_it_snacks
       WHERE org_id = ?${categoryFilter}
       ORDER BY created_at DESC, id DESC`,
      params,
    );
    const snacks = await attachSnackVariants(orgId, rows);
    const snacksWithCounts = await attachSnackCounts(orgId, snacks);
    return res.json({ status: 'success', data: snacksWithCounts.map(serializeSnack), categories: SNACK_CATEGORIES });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to fetch Sell It Snacks.' });
  }
};

const getSnack = async (req, res) => {
  try {
    await ensureSnacksTable();
    const orgId = resolveOrgId(req.user);
    const snackId = Number(req.params.snackId);
    if (!orgId || Number.isNaN(snackId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid snack request.' });
    }
    const [rows] = await db.query(
      'SELECT * FROM sell_it_snacks WHERE id = ? AND org_id = ? LIMIT 1',
      [snackId, orgId],
    );
    if (!rows.length) {
      return res.status(404).json({ status: 'error', message: 'Sell It Snack not found.' });
    }
    const [snack] = await attachSnackVariants(orgId, rows);
    const [snackWithCounts] = await attachSnackCounts(orgId, [snack]);
    const serialized = serializeSnack(snackWithCounts);
    const userId = Number(req.user?.id);
    const engagement = Number.isNaN(userId)
      ? { liked: false, like_count: serialized.likes_count }
      : await loadSnackEngagement({ orgId, snackId, userId });
    return res.json({
      status: 'success',
      data: {
        ...serialized,
        engagement,
      },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to fetch Sell It Snack.' });
  }
};

const getSnackComments = async (req, res) => {
  try {
    await ensureSnacksTable();
    const orgId = resolveOrgId(req.user);
    const snackId = Number(req.params.snackId);
    const userId = Number(req.user?.id);
    if (!orgId || Number.isNaN(snackId) || Number.isNaN(userId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid request.' });
    }
    const ok = await validateSnackOwnership({ orgId, snackId });
    if (!ok) {
      return res.status(404).json({ status: 'error', message: 'Sell It Snack not found.' });
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 15, 1), 50);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total FROM sell_it_snack_comments
       WHERE org_id = ? AND snack_id = ? AND is_blocked = 0 AND parent_comment_id IS NULL`,
      [orgId, snackId],
    );
    const totalRoot = Number(countRow?.total || 0);

    const [roots] = await db.query(
      `SELECT c.id, c.snack_id, c.user_id, COALESCE(NULLIF(TRIM(c.user_name), ''), u.name) AS user_name,
              c.comment_text, c.created_at, c.parent_comment_id
       FROM sell_it_snack_comments c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.org_id = ? AND c.snack_id = ? AND c.is_blocked = 0 AND c.parent_comment_id IS NULL
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      [orgId, snackId, limit, offset],
    );

    const rootIds = roots.map((r) => r.id);
    const replyRows = [];
    if (rootIds.length) {
      let frontier = [...rootIds];
      for (let depth = 0; depth < 64 && frontier.length; depth += 1) {
        const ph = frontier.map(() => '?').join(', ');
        const [batch] = await db.query(
          `SELECT c.id, c.snack_id, c.user_id, COALESCE(NULLIF(TRIM(c.user_name), ''), u.name) AS user_name,
                  c.comment_text, c.created_at, c.parent_comment_id
           FROM sell_it_snack_comments c
           LEFT JOIN users u ON u.id = c.user_id
           WHERE c.org_id = ? AND c.snack_id = ? AND c.is_blocked = 0 AND c.parent_comment_id IN (${ph})
           ORDER BY c.created_at ASC`,
          [orgId, snackId, ...frontier],
        );
        if (!batch.length) break;
        replyRows.push(...batch);
        frontier = batch.map((r) => r.id);
      }
    }

    replyRows.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    const allIds = [...rootIds, ...replyRows.map((r) => r.id)];
    const reactionMap = await fetchSnackCommentReactionMap({ orgId, snackId, userId, commentIds: allIds });

    const repliesByParent = {};
    replyRows.forEach((row) => {
      const key = String(row.parent_comment_id);
      if (!repliesByParent[key]) repliesByParent[key] = [];
      repliesByParent[key].push(mapSnackCommentRow(row, reactionMap));
    });

    const attachNestedReplies = (nodeId) => {
      const kids = repliesByParent[String(nodeId)] || [];
      return kids.map((child) => ({
        ...child,
        replies: attachNestedReplies(child.id),
      }));
    };

    const comments = roots.map((row) => {
      const mapped = mapSnackCommentRow(row, reactionMap);
      mapped.replies = attachNestedReplies(row.id);
      return mapped;
    });

    return res.json({
      status: 'success',
      data: {
        comments,
        total_root: totalRoot,
        limit,
        offset,
        has_more: offset + roots.length < totalRoot,
      },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to fetch comments.' });
  }
};

const getSnackSuggestions = async (req, res) => {
  try {
    await ensureSnacksTable();
    const orgId = resolveOrgId(req.user);
    const snackId = Number(req.params.snackId);
    if (!orgId || Number.isNaN(snackId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid request.' });
    }
    const ok = await validateSnackOwnership({ orgId, snackId });
    if (!ok) {
      return res.status(404).json({ status: 'error', message: 'Sell It Snack not found.' });
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 8, 1), 30);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const [[current]] = await db.query(
      'SELECT category FROM sell_it_snacks WHERE id = ? AND org_id = ? LIMIT 1',
      [snackId, orgId],
    );
    const category = current?.category || '';

    const [rows] = await db.query(
      `SELECT *
       FROM sell_it_snacks
       WHERE org_id = ? AND id != ?
       ORDER BY (CASE WHEN category <=> ? THEN 0 ELSE 1 END), created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [orgId, snackId, category, limit, offset],
    );

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total FROM sell_it_snacks WHERE org_id = ? AND id != ?`,
      [orgId, snackId],
    );
    const total = Number(countRow?.total || 0);

    const snacks = await attachSnackVariants(orgId, rows);
    const snacksWithCounts = await attachSnackCounts(orgId, snacks);

    return res.json({
      status: 'success',
      data: snacksWithCounts.map(serializeSnack),
      limit,
      offset,
      has_more: offset + rows.length < total,
      total,
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to fetch suggestions.' });
  }
};

const createSnack = async (req, res) => {
  try {
    await ensureSnacksTable();
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }
    const category = String(req.body.category || '').trim();
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    const videoFile = Array.isArray(req.files?.video) ? req.files.video[0] : null;
    const thumbnailFile = Array.isArray(req.files?.thumbnail) ? req.files.thumbnail[0] : null;
    if (!SNACK_CATEGORIES.includes(category)) {
      return res.status(400).json({ status: 'error', message: 'Invalid snack category.' });
    }
    if (!title || !videoFile) {
      return res.status(400).json({ status: 'error', message: 'Title and video are required.' });
    }

    const [result] = await db.query(
      `INSERT INTO sell_it_snacks
       (org_id, category, title, description, video_url, thumbnail_url, video_name, thumbnail_name, created_by, processing_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orgId,
        category,
        title,
        description || null,
        toUploadUrl(req, videoFile.filename),
        thumbnailFile ? toUploadUrl(req, thumbnailFile.filename) : null,
        videoFile.originalname || null,
        thumbnailFile?.originalname || null,
        req.user?.id || null,
        'processing',
      ],
    );
    const snackId = result.insertId;
    const variantRows = VIDEO_VARIANTS.map((variant) => [
      orgId,
      snackId,
      variant.resolution,
      'pending',
    ]);
    await db.query(
      `INSERT INTO sell_it_snack_video_variants
       (org_id, snack_id, resolution, status)
       VALUES ?
       ON DUPLICATE KEY UPDATE status = VALUES(status), media_url = NULL, error_message = NULL`,
      [variantRows],
    );
    processSnackVideoVariants({
      req,
      orgId,
      snackId,
      inputPath: videoFile.path,
    }).catch((error) => {
      console.error('sell it snack video processing error:', error);
    });
    const [freshRows] = await db.query('SELECT * FROM sell_it_snacks WHERE id = ? AND org_id = ? LIMIT 1', [
      snackId,
      orgId,
    ]);
    const [withVariants] = await attachSnackVariants(orgId, freshRows);
    const [withCounts] = await attachSnackCounts(orgId, [withVariants]);
    return res.status(201).json({
      status: 'success',
      data: serializeSnack(withCounts),
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to create Sell It Snack.' });
  }
};

const toggleSnackLike = async (req, res) => {
  try {
    await ensureSnacksTable();
    const snackId = Number(req.params.snackId);
    const userId = Number(req.user?.id);
    if (Number.isNaN(snackId) || Number.isNaN(userId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid id.' });
    }
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }
    const ok = await validateSnackOwnership({ orgId, snackId });
    if (!ok) {
      return res.status(404).json({ status: 'error', message: 'Sell It Snack not found.' });
    }

    const [existing] = await db.query(
      'SELECT id FROM sell_it_snack_likes WHERE org_id = ? AND snack_id = ? AND user_id = ? LIMIT 1',
      [orgId, snackId, userId],
    );
    let liked = false;
    if (existing.length) {
      await db.query(
        'DELETE FROM sell_it_snack_likes WHERE org_id = ? AND snack_id = ? AND user_id = ?',
        [orgId, snackId, userId],
      );
      liked = false;
    } else {
      await db.query(
        'INSERT INTO sell_it_snack_likes (org_id, snack_id, user_id) VALUES (?, ?, ?)',
        [orgId, snackId, userId],
      );
      liked = true;
    }

    const [countRows] = await db.query(
      'SELECT COUNT(*) AS likeCount FROM sell_it_snack_likes WHERE org_id = ? AND snack_id = ?',
      [orgId, snackId],
    );
    return res.json({
      status: 'success',
      data: {
        snack_id: snackId,
        liked,
        like_count: Number(countRows[0]?.likeCount || 0),
      },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to toggle like.' });
  }
};

const createSnackComment = async (req, res) => {
  try {
    await ensureSnacksTable();
    const snackId = Number(req.params.snackId);
    const userId = Number(req.user?.id);
    if (Number.isNaN(snackId) || Number.isNaN(userId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid id.' });
    }
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }
    const commentText = String(req.body?.comment_text || '').trim();
    if (!commentText) {
      return res.status(400).json({ status: 'error', message: 'Comment text is required.' });
    }

    const ok = await validateSnackOwnership({ orgId, snackId });
    if (!ok) {
      return res.status(404).json({ status: 'error', message: 'Sell It Snack not found.' });
    }

    let parentCommentId =
      req.body.parent_comment_id != null && req.body.parent_comment_id !== ''
        ? Number(req.body.parent_comment_id)
        : null;
    if (parentCommentId !== null && Number.isNaN(parentCommentId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid parent comment.' });
    }
    if (parentCommentId) {
      const [parentRows] = await db.query(
        `SELECT id FROM sell_it_snack_comments
         WHERE id = ? AND org_id = ? AND snack_id = ? AND is_blocked = 0
         LIMIT 1`,
        [parentCommentId, orgId, snackId],
      );
      if (!parentRows.length) {
        return res.status(400).json({ status: 'error', message: 'Parent comment not found.' });
      }
    }

    let userName = req.user?.name || null;
    if (!userName) {
      const [userRows] = await db.query(
        'SELECT name FROM users WHERE id = ? LIMIT 1',
        [userId],
      );
      userName = userRows[0]?.name || null;
    }
    const [insertResult] = await db.query(
      `INSERT INTO sell_it_snack_comments (org_id, snack_id, user_id, user_name, comment_text, parent_comment_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [orgId, snackId, userId, userName, commentText, parentCommentId],
    );

    const [rows] = await db.query(
      `SELECT id, snack_id, user_id, user_name, comment_text, created_at, parent_comment_id
       FROM sell_it_snack_comments WHERE id = ? LIMIT 1`,
      [insertResult.insertId],
    );
    return res.json({ status: 'success', data: rows[0] || null });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to add comment.' });
  }
};

const toggleSnackCommentReaction = async (req, res) => {
  try {
    await ensureSnacksTable();
    const snackId = Number(req.params.snackId);
    const commentId = Number(req.params.commentId);
    const userId = Number(req.user?.id);
    if (Number.isNaN(snackId) || Number.isNaN(commentId) || Number.isNaN(userId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid id.' });
    }
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }
    const reaction = String(req.body?.reaction || '').toLowerCase();
    if (!['like', 'dislike'].includes(reaction)) {
      return res.status(400).json({ status: 'error', message: 'reaction must be like or dislike.' });
    }

    const ok = await validateSnackOwnership({ orgId, snackId });
    if (!ok) {
      return res.status(404).json({ status: 'error', message: 'Sell It Snack not found.' });
    }

    const [commentRows] = await db.query(
      'SELECT id FROM sell_it_snack_comments WHERE id = ? AND org_id = ? AND snack_id = ? AND is_blocked = 0 LIMIT 1',
      [commentId, orgId, snackId],
    );
    if (!commentRows.length) {
      return res.status(404).json({ status: 'error', message: 'Comment not found.' });
    }

    const [existingRows] = await db.query(
      'SELECT id, reaction FROM sell_it_snack_comment_reactions WHERE org_id = ? AND snack_id = ? AND comment_id = ? AND user_id = ? LIMIT 1',
      [orgId, snackId, commentId, userId],
    );

    let myReaction = reaction;
    if (existingRows.length && String(existingRows[0].reaction) === reaction) {
      await db.query(
        'DELETE FROM sell_it_snack_comment_reactions WHERE id = ? LIMIT 1',
        [existingRows[0].id],
      );
      myReaction = null;
    } else if (existingRows.length) {
      await db.query(
        'UPDATE sell_it_snack_comment_reactions SET reaction = ? WHERE id = ?',
        [reaction, existingRows[0].id],
      );
    } else {
      await db.query(
        `INSERT INTO sell_it_snack_comment_reactions
         (org_id, snack_id, comment_id, user_id, reaction)
         VALUES (?, ?, ?, ?, ?)`,
        [orgId, snackId, commentId, userId, reaction],
      );
    }

    const [countsRows] = await db.query(
      `SELECT
         SUM(CASE WHEN reaction = 'like' THEN 1 ELSE 0 END) AS likes_count,
         SUM(CASE WHEN reaction = 'dislike' THEN 1 ELSE 0 END) AS dislikes_count
       FROM sell_it_snack_comment_reactions
       WHERE org_id = ? AND snack_id = ? AND comment_id = ?`,
      [orgId, snackId, commentId],
    );
    return res.json({
      status: 'success',
      data: {
        comment_id: commentId,
        my_reaction: myReaction,
        likes_count: Number(countsRows[0]?.likes_count || 0),
        dislikes_count: Number(countsRows[0]?.dislikes_count || 0),
      },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to react to comment.' });
  }
};

const updateSnackComment = async (req, res) => {
  try {
    await ensureSnacksTable();
    const snackId = Number(req.params.snackId);
    const commentId = Number(req.params.commentId);
    const userId = Number(req.user?.id);
    if (Number.isNaN(snackId) || Number.isNaN(commentId) || Number.isNaN(userId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid id.' });
    }
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }
    const commentText = String(req.body?.comment_text || '').trim();
    if (!commentText) {
      return res.status(400).json({ status: 'error', message: 'Comment text is required.' });
    }
    const ok = await validateSnackOwnership({ orgId, snackId });
    if (!ok) {
      return res.status(404).json({ status: 'error', message: 'Sell It Snack not found.' });
    }

    const [rows] = await db.query(
      `SELECT user_id, is_blocked FROM sell_it_snack_comments WHERE id = ? AND org_id = ? AND snack_id = ? LIMIT 1`,
      [commentId, orgId, snackId],
    );
    if (!rows.length) {
      return res.status(404).json({ status: 'error', message: 'Comment not found.' });
    }
    if (Number(rows[0].is_blocked) === 1 && !canModerateSnackComments(req.user)) {
      return res.status(403).json({ status: 'error', message: 'Comment is blocked.' });
    }
    if (!canModifySnackComment(req.user, rows[0].user_id)) {
      return res.status(403).json({ status: 'error', message: 'You cannot edit this comment.' });
    }

    await db.query(
      `UPDATE sell_it_snack_comments SET comment_text = ? WHERE id = ? AND org_id = ? AND snack_id = ?`,
      [commentText, commentId, orgId, snackId],
    );

    return res.json({
      status: 'success',
      data: { id: commentId, comment_text: commentText },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to update comment.' });
  }
};

const createSnackCommentReport = async (req, res) => {
  try {
    await ensureSnacksTable();
    const orgId = resolveOrgId(req.user);
    const userId = Number(req.user?.id);
    const snackId = Number(req.params.snackId);
    const commentId = Number(req.params.commentId);
    const reason = String(req.body.reason || '').trim();
    if (!orgId || !userId || Number.isNaN(snackId) || Number.isNaN(commentId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid report request.' });
    }
    if (!reason) {
      return res.status(400).json({ status: 'error', message: 'Report reason is required.' });
    }

    const ok = await validateSnackOwnership({ orgId, snackId });
    if (!ok) {
      return res.status(404).json({ status: 'error', message: 'Sell It Snack not found.' });
    }

    const [commentRows] = await db.query(
      'SELECT id FROM sell_it_snack_comments WHERE id = ? AND org_id = ? AND snack_id = ? LIMIT 1',
      [commentId, orgId, snackId],
    );
    if (!commentRows.length) {
      return res.status(404).json({ status: 'error', message: 'Comment not found.' });
    }

    await db.query(
      `INSERT INTO sell_it_snack_comment_reports (org_id, snack_id, comment_id, reporter_user_id, reporter_name, reason)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         reason = VALUES(reason),
         reporter_name = VALUES(reporter_name),
         status = 'pending',
         updated_at = CURRENT_TIMESTAMP`,
      [orgId, snackId, commentId, userId, req.user?.name || null, reason.slice(0, 255)],
    );

    return res.status(201).json({ status: 'success', message: 'Report submitted.' });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to submit report.' });
  }
};

const listSnackCommentReports = async (req, res) => {
  try {
    await ensureSnacksTable();
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }
    const [rows] = await db.query(
      `SELECT r.*,
        s.title AS snack_title,
        c.user_name AS comment_author_name,
        c.comment_text AS comment_text
       FROM sell_it_snack_comment_reports r
       INNER JOIN sell_it_snacks s ON s.id = r.snack_id AND s.org_id = r.org_id
       INNER JOIN sell_it_snack_comments c ON c.id = r.comment_id AND c.org_id = r.org_id AND c.snack_id = r.snack_id
       WHERE r.org_id = ?
       ORDER BY r.created_at DESC, r.id DESC
       LIMIT 200`,
      [orgId],
    );

    const data = rows.map((row) => ({
      id: row.id,
      snack_id: row.snack_id,
      comment_id: row.comment_id,
      reporter_user_id: row.reporter_user_id,
      reporter_name: row.reporter_name,
      reason: row.reason,
      status: row.status || 'pending',
      created_at: row.created_at,
      snack_title: row.snack_title,
      comment_author_name: row.comment_author_name,
      comment_preview: String(row.comment_text || '').slice(0, 200),
    }));

    return res.json({
      status: 'success',
      data,
      summary: {
        pending: rows.filter((report) => report.status === 'pending').length,
        reviewed: rows.filter((report) => report.status === 'reviewed').length,
        resolved: rows.filter((report) => report.status === 'resolved').length,
        total: rows.length,
      },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to fetch comment reports.' });
  }
};

const deleteSnackComment = async (req, res) => {
  try {
    await ensureSnacksTable();
    const snackId = Number(req.params.snackId);
    const commentId = Number(req.params.commentId);
    const userId = Number(req.user?.id);
    if (Number.isNaN(snackId) || Number.isNaN(commentId) || Number.isNaN(userId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid id.' });
    }
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }
    const ok = await validateSnackOwnership({ orgId, snackId });
    if (!ok) {
      return res.status(404).json({ status: 'error', message: 'Sell It Snack not found.' });
    }

    const [rows] = await db.query(
      `SELECT user_id, is_blocked FROM sell_it_snack_comments WHERE id = ? AND org_id = ? AND snack_id = ? LIMIT 1`,
      [commentId, orgId, snackId],
    );
    if (!rows.length) {
      return res.status(404).json({ status: 'error', message: 'Comment not found.' });
    }
    if (Number(rows[0].is_blocked) === 1 && !canModerateSnackComments(req.user)) {
      return res.status(403).json({ status: 'error', message: 'Comment is blocked.' });
    }
    if (!canModifySnackComment(req.user, rows[0].user_id)) {
      return res.status(403).json({ status: 'error', message: 'You cannot delete this comment.' });
    }

    const descendants = await collectDescendantSnackCommentIds(orgId, snackId, commentId);
    const allIds = [commentId, ...descendants];
    const ph = allIds.map(() => '?').join(', ');
    await db.query(
      `DELETE FROM sell_it_snack_comments WHERE org_id = ? AND snack_id = ? AND id IN (${ph})`,
      [orgId, snackId, ...allIds],
    );

    return res.json({
      status: 'success',
      data: { deleted_count: allIds.length },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to delete comment.' });
  }
};

module.exports = {
  SNACK_CATEGORIES,
  getSnacks,
  getSnack,
  getSnackComments,
  getSnackSuggestions,
  createSnack,
  toggleSnackLike,
  createSnackComment,
  updateSnackComment,
  deleteSnackComment,
  toggleSnackCommentReaction,
  createSnackCommentReport,
  listSnackCommentReports,
};
