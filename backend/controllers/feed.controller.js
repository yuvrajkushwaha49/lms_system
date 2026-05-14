const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const VIDEO_VARIANTS = [
  { resolution: '360p', height: 360 },
  { resolution: '720p', height: 720 },
  { resolution: '1080p', height: 1080 },
];
const FEED_MEDIA_TOKEN_SCOPE = 'feed-media';
const FEED_MEDIA_TOKEN_EXPIRES_IN = process.env.FEED_MEDIA_TOKEN_EXPIRES_IN || '10m';
const FEED_MEDIA_ROOT = path.join(__dirname, '..', 'uploads', 'feed-media');

const resolveOrgId = (user) => user?.org_id || user?.business_id || null;

const canModerateFeedComments = (user) => {
  const r = String(user?.role_name || '').toLowerCase();
  return ['ceo', 'admin', 'instructor', 'trainer'].includes(r);
};

const canModifyFeedComment = (user, commentAuthorId) => {
  const uid = Number(user?.id);
  const aid = Number(commentAuthorId);
  return (!Number.isNaN(uid) && uid === aid) || canModerateFeedComments(user);
};

const collectDescendantFeedCommentIds = async (orgId, postId, rootId) => {
  const collected = [];
  let frontier = [rootId];
  while (frontier.length) {
    const ph = frontier.map(() => '?').join(', ');
    const [rows] = await db.query(
      `SELECT id FROM member_feed_comments WHERE org_id = ? AND post_id = ? AND parent_comment_id IN (${ph})`,
      [orgId, postId, ...frontier],
    );
    if (!rows.length) break;
    const ids = rows.map((r) => r.id);
    collected.push(...ids);
    frontier = ids;
  }
  return collected;
};

const resolveMediaType = (mimetype = '') => {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  return 'document';
};

const toPublicUploadUrl = (req, relativePath) =>
  `${req.protocol}://${req.get('host')}/uploads/${relativePath.replace(/\\/g, '/')}`;

const getMediaTokenSecret = () => process.env.MEDIA_URL_SECRET || process.env.JWT_SECRET;

const getBearerToken = (req) => {
  const authorization = String(req.headers.authorization || '');
  if (!authorization) return '';
  return authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : authorization.trim();
};

const createFeedMediaToken = ({ orgId, kind, id }) => {
  const secret = getMediaTokenSecret();
  if (!secret) {
    throw new Error('Media URL secret is not configured.');
  }
  return jwt.sign(
    {
      scope: FEED_MEDIA_TOKEN_SCOPE,
      org_id: String(orgId),
      kind,
      id: String(id),
    },
    secret,
    { expiresIn: FEED_MEDIA_TOKEN_EXPIRES_IN },
  );
};

const verifyFeedMediaToken = ({ token, kind, id }) => {
  const secret = getMediaTokenSecret();
  if (!secret) {
    throw new Error('Media URL secret is not configured.');
  }
  const payload = jwt.verify(token, secret);
  if (
    payload?.scope !== FEED_MEDIA_TOKEN_SCOPE ||
    payload?.kind !== kind ||
    String(payload?.id) !== String(id)
  ) {
    return null;
  }
  return payload;
};

const buildFeedMediaUrl = (req, kind, id, orgId) => {
  if (!id || !orgId) return null;
  const token = createFeedMediaToken({ orgId, kind, id });
  const routeByKind = {
    attachment: `/api/feed/media/${id}`,
    variant: `/api/feed/media/variants/${id}`,
    post: `/api/feed/media/posts/${id}`,
  };
  return `${req.protocol}://${req.get('host')}${routeByKind[kind]}?token=${encodeURIComponent(token)}`;
};

const resolveFeedMediaFilePath = (mediaUrl = '') => {
  let pathname = String(mediaUrl || '');
  try {
    pathname = new URL(pathname).pathname;
  } catch {
    pathname = pathname.split('?')[0];
  }

  const marker = '/uploads/feed-media/';
  const markerIndex = pathname.indexOf(marker);
  if (markerIndex === -1) return null;

  const relativePath = decodeURIComponent(pathname.slice(markerIndex + marker.length));
  const absolutePath = path.resolve(FEED_MEDIA_ROOT, relativePath);
  const rootWithSeparator = `${path.resolve(FEED_MEDIA_ROOT)}${path.sep}`;
  if (absolutePath !== path.resolve(FEED_MEDIA_ROOT) && !absolutePath.startsWith(rootWithSeparator)) {
    return null;
  }
  return absolutePath;
};

const streamFileWithRange = (req, res, filePath, mimeType, fileName) => {
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ status: 'error', message: 'Media file not found.' });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
  const headers = {
    'Accept-Ranges': 'bytes',
    'Content-Type': mimeType || 'application/octet-stream',
    'Content-Disposition': `inline${fileName ? `; filename="${String(fileName).replace(/"/g, '')}"` : ''}`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  };

  if (range) {
    const [startPart, endPart] = range.replace(/bytes=/, '').split('-');
    const start = Number.parseInt(startPart, 10);
    const end = endPart ? Number.parseInt(endPart, 10) : fileSize - 1;
    if (Number.isNaN(start) || Number.isNaN(end) || start >= fileSize || end >= fileSize || start > end) {
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      return res.sendStatus(416);
    }
    res.writeHead(206, {
      ...headers,
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Content-Length': end - start + 1,
    });
    return fs.createReadStream(filePath, { start, end }).pipe(res);
  }

  res.writeHead(200, {
    ...headers,
    'Content-Length': fileSize,
  });
  return fs.createReadStream(filePath).pipe(res);
};

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

const updatePostProcessingStatus = async (postId) => {
  const [variantRows] = await db.query(
    `SELECT
      SUM(CASE WHEN status IN ('pending', 'processing') THEN 1 ELSE 0 END) AS processing_count,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count
     FROM member_feed_video_variants
     WHERE post_id = ?`,
    [postId],
  );
  const processingCount = Number(variantRows[0]?.processing_count || 0);
  const failedCount = Number(variantRows[0]?.failed_count || 0);
  if (processingCount === 0) {
    await db.query(
      "UPDATE member_feed_posts SET processing_status = ? WHERE id = ?",
      [failedCount > 0 ? 'failed' : 'ready', postId],
    );
  }
};

const processVideoAttachmentVariants = async ({ req, orgId, postId, attachmentId, inputPath }) => {
  if (!ffmpegPath) {
    await db.query(
      "UPDATE member_feed_video_variants SET status = 'failed', error_message = ? WHERE attachment_id = ?",
      ['FFmpeg binary is not available.', attachmentId],
    );
    await updatePostProcessingStatus(postId);
    return;
  }

  const variantDir = path.join(__dirname, '..', 'uploads', 'feed-media', 'video-variants', String(attachmentId));
  fs.mkdirSync(variantDir, { recursive: true });

  await Promise.all(
    VIDEO_VARIANTS.map(async (variant) => {
      const outputFilename = `${variant.resolution}.mp4`;
      const outputPath = path.join(variantDir, outputFilename);
      const mediaUrl = toPublicUploadUrl(req, `feed-media/video-variants/${attachmentId}/${outputFilename}`);
      try {
        await db.query(
          "UPDATE member_feed_video_variants SET status = 'processing', error_message = NULL WHERE attachment_id = ? AND resolution = ?",
          [attachmentId, variant.resolution],
        );
        await runFfmpegVariant(inputPath, outputPath, variant.height);
        await db.query(
          "UPDATE member_feed_video_variants SET status = 'ready', media_url = ?, error_message = NULL WHERE attachment_id = ? AND resolution = ?",
          [mediaUrl, attachmentId, variant.resolution],
        );
      } catch (error) {
        await db.query(
          "UPDATE member_feed_video_variants SET status = 'failed', error_message = ? WHERE attachment_id = ? AND resolution = ?",
          [String(error.message || error).slice(0, 1000), attachmentId, variant.resolution],
        );
      }
    }),
  );
  await updatePostProcessingStatus(postId);
};

const ensureFeedTables = async () => {
  await db.query(
    `CREATE TABLE IF NOT EXISTS member_feed_posts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      user_id INT NOT NULL,
      user_name VARCHAR(255) DEFAULT NULL,
      heading VARCHAR(255) NOT NULL,
      sub_heading VARCHAR(500) DEFAULT NULL,
      content TEXT DEFAULT NULL,
      media_url VARCHAR(1024) DEFAULT NULL,
      media_type VARCHAR(40) DEFAULT NULL,
      media_name VARCHAR(255) DEFAULT NULL,
      media_mime VARCHAR(255) DEFAULT NULL,
      media_size INT DEFAULT NULL,
      processing_status ENUM('ready', 'processing', 'failed') NOT NULL DEFAULT 'ready',
      is_blocked TINYINT(1) NOT NULL DEFAULT 0,
      blocked_at TIMESTAMP NULL DEFAULT NULL,
      blocked_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_member_feed_posts_org_created (org_id, created_at),
      INDEX idx_member_feed_posts_user (org_id, user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  await db.query(
    "ALTER TABLE member_feed_posts ADD COLUMN IF NOT EXISTS processing_status ENUM('ready', 'processing', 'failed') NOT NULL DEFAULT 'ready'",
  );
  await db.query(
    'ALTER TABLE member_feed_posts ADD COLUMN IF NOT EXISTS is_blocked TINYINT(1) NOT NULL DEFAULT 0',
  );
  await db.query(
    'ALTER TABLE member_feed_posts ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP NULL DEFAULT NULL',
  );
  await db.query(
    'ALTER TABLE member_feed_posts ADD COLUMN IF NOT EXISTS blocked_by INT DEFAULT NULL',
  );
  await db.query(
    "ALTER TABLE member_feed_posts ADD COLUMN IF NOT EXISTS posting_space VARCHAR(64) NOT NULL DEFAULT 'sell-it-community'",
  );

  await db.query(
    `CREATE TABLE IF NOT EXISTS member_feed_likes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      post_id INT NOT NULL,
      user_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_member_feed_like (org_id, post_id, user_id),
      INDEX idx_member_feed_likes_post (org_id, post_id),
      CONSTRAINT fk_member_feed_likes_post FOREIGN KEY (post_id) REFERENCES member_feed_posts(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );

  await db.query(
    `CREATE TABLE IF NOT EXISTS member_feed_post_attachments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      post_id INT NOT NULL,
      media_url VARCHAR(1024) NOT NULL,
      media_type VARCHAR(40) DEFAULT NULL,
      media_name VARCHAR(255) DEFAULT NULL,
      media_mime VARCHAR(255) DEFAULT NULL,
      media_size INT DEFAULT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_member_feed_attachments_post (org_id, post_id, sort_order),
      CONSTRAINT fk_member_feed_attachments_post FOREIGN KEY (post_id) REFERENCES member_feed_posts(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );

  await db.query(
    `CREATE TABLE IF NOT EXISTS member_feed_video_variants (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      post_id INT NOT NULL,
      attachment_id INT NOT NULL,
      resolution VARCHAR(20) NOT NULL,
      media_url VARCHAR(1024) DEFAULT NULL,
      status ENUM('pending', 'processing', 'ready', 'failed') NOT NULL DEFAULT 'pending',
      error_message TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_feed_video_variant (attachment_id, resolution),
      INDEX idx_feed_video_variants_attachment (org_id, post_id, attachment_id),
      CONSTRAINT fk_feed_video_variants_attachment FOREIGN KEY (attachment_id) REFERENCES member_feed_post_attachments(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );

  await db.query(
    `CREATE TABLE IF NOT EXISTS member_feed_comments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      post_id INT NOT NULL,
      user_id INT NOT NULL,
      user_name VARCHAR(255) DEFAULT NULL,
      comment_text TEXT NOT NULL,
      parent_comment_id INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_member_feed_comments_post (org_id, post_id, created_at),
      INDEX idx_member_feed_comments_parent (org_id, post_id, parent_comment_id),
      CONSTRAINT fk_member_feed_comments_post FOREIGN KEY (post_id) REFERENCES member_feed_posts(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  await db.query(
    'ALTER TABLE member_feed_comments ADD COLUMN IF NOT EXISTS parent_comment_id INT DEFAULT NULL',
  );

  await db.query(
    `CREATE TABLE IF NOT EXISTS member_feed_comment_reactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      post_id INT NOT NULL,
      comment_id INT NOT NULL,
      user_id INT NOT NULL,
      reaction ENUM('like', 'dislike') NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_member_feed_comment_reaction (org_id, comment_id, user_id),
      INDEX idx_member_feed_comment_reactions_comment (org_id, post_id, comment_id),
      CONSTRAINT fk_member_feed_comment_reactions_post FOREIGN KEY (post_id) REFERENCES member_feed_posts(id) ON DELETE CASCADE,
      CONSTRAINT fk_member_feed_comment_reactions_comment FOREIGN KEY (comment_id) REFERENCES member_feed_comments(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );

  await db.query(
    `CREATE TABLE IF NOT EXISTS member_feed_reports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      post_id INT NOT NULL,
      reporter_user_id INT NOT NULL,
      reporter_name VARCHAR(255) DEFAULT NULL,
      reason VARCHAR(255) NOT NULL,
      status ENUM('pending', 'reviewed', 'resolved') NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_member_feed_report (org_id, post_id, reporter_user_id),
      INDEX idx_member_feed_reports_org_created (org_id, created_at),
      INDEX idx_member_feed_reports_post (org_id, post_id),
      CONSTRAINT fk_member_feed_reports_post FOREIGN KEY (post_id) REFERENCES member_feed_posts(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );

  await db.query(
    `CREATE TABLE IF NOT EXISTS member_feed_comment_reports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      post_id INT NOT NULL,
      comment_id INT NOT NULL,
      reporter_user_id INT NOT NULL,
      reporter_name VARCHAR(255) DEFAULT NULL,
      reason VARCHAR(255) NOT NULL,
      status ENUM('pending', 'reviewed', 'resolved') NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_member_feed_comment_report (org_id, post_id, comment_id, reporter_user_id),
      INDEX idx_member_feed_comment_reports_org (org_id, created_at),
      CONSTRAINT fk_member_feed_comment_reports_post FOREIGN KEY (post_id) REFERENCES member_feed_posts(id) ON DELETE CASCADE,
      CONSTRAINT fk_member_feed_comment_reports_comment FOREIGN KEY (comment_id) REFERENCES member_feed_comments(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
};

const serializeComment = (comment) => ({
  id: comment.id,
  post_id: comment.post_id,
  parent_comment_id: comment.parent_comment_id || null,
  user_id: comment.user_id,
  user_name: comment.user_name,
  comment_text: comment.comment_text,
  created_at: comment.created_at,
  likes_count: Number(comment.likes_count || 0),
  dislikes_count: Number(comment.dislikes_count || 0),
  current_user_reaction: comment.current_user_reaction || null,
});

const serializeReport = (report, attachments = []) => ({
  id: report.id,
  post_id: report.post_id,
  reporter_user_id: report.reporter_user_id,
  reporter_name: report.reporter_name,
  reason: report.reason,
  status: report.status || 'pending',
  created_at: report.created_at,
  updated_at: report.updated_at,
  post_heading: report.post_heading,
  post_sub_heading: report.post_sub_heading,
  post_content: report.post_content,
  post_user_name: report.post_user_name,
  post_created_at: report.post_created_at,
  post_is_blocked: Boolean(report.post_is_blocked),
  post_blocked_at: report.post_blocked_at,
  post_attachments: attachments,
});

const serializeVariant = (variant, req, orgId) => ({
  id: variant.id,
  resolution: variant.resolution,
  media_url: variant.status === 'ready' && variant.media_url
    ? buildFeedMediaUrl(req, 'variant', variant.id, orgId)
    : null,
  status: variant.status,
  error_message: variant.error_message,
});

const serializeAttachment = (attachment, req, orgId) => ({
  id: attachment.id,
  media_url: attachment.media_url ? buildFeedMediaUrl(req, 'attachment', attachment.id, orgId) : null,
  media_type: attachment.media_type,
  media_name: attachment.media_name,
  media_mime: attachment.media_mime,
  media_size: attachment.media_size,
  sort_order: attachment.sort_order,
  video_variants: (attachment.video_variants || []).map((variant) => serializeVariant(variant, req, orgId)),
});

const FEED_POSTING_SPACES = new Set([
  'meet-greet',
  'sell-it-community',
  'referral-partners',
  'community-listings',
  'workshop-replays',
  'sell-it-short-courses',
]);

const serializePost = (post, comments = [], req = null) => {
  const orgId = post.org_id;
  const attachments = (post.attachments || []).map((attachment) => serializeAttachment(attachment, req, orgId));
  const signedPostMediaUrl = post.media_url ? buildFeedMediaUrl(req, 'post', post.id, orgId) : null;

  return {
    id: post.id,
    user_id: post.user_id,
    user_name: post.user_name,
    heading: post.heading,
    sub_heading: post.sub_heading,
    content: post.content,
    media_url: attachments[0]?.media_url || signedPostMediaUrl,
    media_type: post.media_type,
    media_name: post.media_name,
    media_mime: post.media_mime,
    media_size: post.media_size,
    processing_status: post.processing_status || 'ready',
    is_blocked: Boolean(post.is_blocked),
    blocked_at: post.blocked_at || null,
    block_reason: post.block_reason || null,
    created_at: post.created_at,
    updated_at: post.updated_at,
    likes_count: Number(post.likes_count || 0),
    comments_count: Number(post.comments_count || 0),
    is_liked: Boolean(post.is_liked),
    posting_space: post.posting_space || 'sell-it-community',
    attachments,
    comments,
  };
};

const getVerifiedMediaPayload = (req, res, kind, id) => {
  const token = String(req.query.token || '');
  if (token) {
    try {
      const payload = verifyFeedMediaToken({ token, kind, id });
      if (!payload) {
        res.status(403).json({ status: 'error', message: 'Invalid media token.' });
        return null;
      }
      return payload;
    } catch {
      res.status(401).json({ status: 'error', message: 'Invalid or expired media token.' });
      return null;
    }
  }

  try {
    const bearerToken = getBearerToken(req);
    const decoded = bearerToken ? jwt.verify(bearerToken, process.env.JWT_SECRET) : null;
    const orgId = resolveOrgId(decoded);
    if (!orgId) {
      res.status(401).json({ status: 'error', message: 'Media token is required.' });
      return null;
    }
    return { org_id: String(orgId), kind, id: String(id) };
  } catch {
    res.status(401).json({ status: 'error', message: 'Invalid media authorization.' });
    return null;
  }
};

const streamFeedAttachmentMedia = async (req, res) => {
  try {
    const attachmentId = Number(req.params.attachmentId);
    if (Number.isNaN(attachmentId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid attachment id.' });
    }
    const payload = getVerifiedMediaPayload(req, res, 'attachment', attachmentId);
    if (!payload) return null;

    const [rows] = await db.query(
      `SELECT media_url, media_mime, media_name
       FROM member_feed_post_attachments
       WHERE id = ? AND org_id = ?
       LIMIT 1`,
      [attachmentId, payload.org_id],
    );
    if (!rows.length) {
      return res.status(404).json({ status: 'error', message: 'Media not found.' });
    }

    return streamFileWithRange(
      req,
      res,
      resolveFeedMediaFilePath(rows[0].media_url),
      rows[0].media_mime,
      rows[0].media_name,
    );
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to stream media.' });
  }
};

const streamFeedVariantMedia = async (req, res) => {
  try {
    const variantId = Number(req.params.variantId);
    if (Number.isNaN(variantId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid variant id.' });
    }
    const payload = getVerifiedMediaPayload(req, res, 'variant', variantId);
    if (!payload) return null;

    const [rows] = await db.query(
      `SELECT v.media_url, v.status, a.media_mime, a.media_name
       FROM member_feed_video_variants v
       INNER JOIN member_feed_post_attachments a
         ON a.id = v.attachment_id AND a.org_id = v.org_id
       WHERE v.id = ? AND v.org_id = ?
       LIMIT 1`,
      [variantId, payload.org_id],
    );
    if (!rows.length || rows[0].status !== 'ready' || !rows[0].media_url) {
      return res.status(404).json({ status: 'error', message: 'Media variant not found.' });
    }

    return streamFileWithRange(
      req,
      res,
      resolveFeedMediaFilePath(rows[0].media_url),
      'video/mp4',
      rows[0].media_name,
    );
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to stream media variant.' });
  }
};

const streamFeedPostMedia = async (req, res) => {
  try {
    const postId = Number(req.params.postId);
    if (Number.isNaN(postId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid post id.' });
    }
    const payload = getVerifiedMediaPayload(req, res, 'post', postId);
    if (!payload) return null;

    const [rows] = await db.query(
      `SELECT media_url, media_mime, media_name
       FROM member_feed_posts
       WHERE id = ? AND org_id = ?
       LIMIT 1`,
      [postId, payload.org_id],
    );
    if (!rows.length || !rows[0].media_url) {
      return res.status(404).json({ status: 'error', message: 'Media not found.' });
    }

    return streamFileWithRange(
      req,
      res,
      resolveFeedMediaFilePath(rows[0].media_url),
      rows[0].media_mime,
      rows[0].media_name,
    );
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to stream post media.' });
  }
};

const getFeedPosts = async (req, res) => {
  try {
    await ensureFeedTables();
    const orgId = resolveOrgId(req.user);
    const userId = Number(req.user?.id);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }
    const requestedLimit = Number(req.query.limit || 7);
    const requestedOffset = Number(req.query.offset || 0);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 25) : 7;
    const offset = Number.isFinite(requestedOffset) ? Math.max(Math.floor(requestedOffset), 0) : 0;
    const showOnlyMine = String(req.query.mine || '') === '1' && Boolean(userId);
    const ownerFilterSql = showOnlyMine ? ' AND p.user_id = ?' : '';
    const ownerFilterParams = showOnlyMine ? [userId] : [];
    const blockedFilterSql = showOnlyMine ? '' : ' AND COALESCE(p.is_blocked, 0) = 0';

    const requestedSpace = String(req.query.space || '').trim();
    const applySpaceFilter = Boolean(requestedSpace && FEED_POSTING_SPACES.has(requestedSpace));
    const spaceSql = applySpaceFilter ? ' AND p.posting_space = ?' : '';

    const feedQueryParams = [userId || 0, orgId];
    if (applySpaceFilter) feedQueryParams.push(requestedSpace);
    feedQueryParams.push(...ownerFilterParams);

    const [posts] = await db.query(
      `SELECT p.*,
        COALESCE(l.like_count, 0) AS likes_count,
        COALESCE(c.comment_count, 0) AS comments_count,
        br.reason AS block_reason,
        CASE WHEN ul.id IS NULL THEN 0 ELSE 1 END AS is_liked
       FROM member_feed_posts p
       LEFT JOIN (
         SELECT org_id, post_id, COUNT(*) AS like_count
         FROM member_feed_likes
         GROUP BY org_id, post_id
       ) l ON l.org_id = p.org_id AND l.post_id = p.id
       LEFT JOIN (
         SELECT org_id, post_id, COUNT(*) AS comment_count
         FROM member_feed_comments
         GROUP BY org_id, post_id
       ) c ON c.org_id = p.org_id AND c.post_id = p.id
       LEFT JOIN (
         SELECT r.org_id, r.post_id, r.reason
         FROM member_feed_reports r
         INNER JOIN (
           SELECT org_id, post_id, MAX(id) AS latest_report_id
           FROM member_feed_reports
           GROUP BY org_id, post_id
         ) latest ON latest.org_id = r.org_id AND latest.latest_report_id = r.id
       ) br ON br.org_id = p.org_id AND br.post_id = p.id
       LEFT JOIN member_feed_likes ul
         ON ul.org_id = p.org_id AND ul.post_id = p.id AND ul.user_id = ?
       WHERE p.org_id = ?${spaceSql} AND p.processing_status = 'ready'${blockedFilterSql}${ownerFilterSql}
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT ${limit + 1} OFFSET ${offset}`,
      feedQueryParams,
    );
    const hasMore = posts.length > limit;
    const pagePosts = hasMore ? posts.slice(0, limit) : posts;

    const [processingPosts] = userId
      ? await db.query(
        `SELECT p.*, 0 AS likes_count, 0 AS comments_count, 0 AS is_liked
         FROM member_feed_posts p
         WHERE p.org_id = ? AND p.user_id = ? AND p.processing_status IN ('processing', 'failed') AND COALESCE(p.is_blocked, 0) = 0${applySpaceFilter ? ' AND p.posting_space = ?' : ''}
         ORDER BY p.created_at DESC, p.id DESC
         LIMIT 5`,
        applySpaceFilter ? [orgId, userId, requestedSpace] : [orgId, userId],
      )
      : [[]];

    const allPosts = [...pagePosts, ...processingPosts];
    const allPostIds = allPosts.map((post) => post.id);
    const allPlaceholders = allPostIds.map(() => '?').join(', ');
    const [attachmentRows] = allPostIds.length
      ? await db.query(
        `SELECT id, post_id, media_url, media_type, media_name, media_mime, media_size, sort_order
         FROM member_feed_post_attachments
         WHERE org_id = ? AND post_id IN (${allPlaceholders})
         ORDER BY sort_order ASC, id ASC`,
        [orgId, ...allPostIds],
      )
      : [[]];
    const [variantRows] = allPostIds.length
      ? await db.query(
        `SELECT id, attachment_id, resolution, media_url, status, error_message
         FROM member_feed_video_variants
         WHERE org_id = ? AND post_id IN (${allPlaceholders})
         ORDER BY FIELD(resolution, '360p', '720p', '1080p'), id ASC`,
        [orgId, ...allPostIds],
      )
      : [[]];

    const postIds = pagePosts.map((post) => post.id);
    const placeholders = postIds.map(() => '?').join(', ');
    const [commentRows] = postIds.length
      ? await db.query(
        `SELECT c.id, c.post_id, c.parent_comment_id, c.user_id, c.user_name, c.comment_text, c.created_at,
          COALESCE(r.likes_count, 0) AS likes_count,
          COALESCE(r.dislikes_count, 0) AS dislikes_count,
          ur.reaction AS current_user_reaction
         FROM member_feed_comments c
         LEFT JOIN (
           SELECT org_id, comment_id,
             SUM(CASE WHEN reaction = 'like' THEN 1 ELSE 0 END) AS likes_count,
             SUM(CASE WHEN reaction = 'dislike' THEN 1 ELSE 0 END) AS dislikes_count
           FROM member_feed_comment_reactions
           GROUP BY org_id, comment_id
         ) r ON r.org_id = c.org_id AND r.comment_id = c.id
         LEFT JOIN member_feed_comment_reactions ur
           ON ur.org_id = c.org_id AND ur.comment_id = c.id AND ur.user_id = ?
         WHERE c.org_id = ? AND c.post_id IN (${placeholders})
         ORDER BY c.created_at ASC, c.id ASC`,
        [userId || 0, orgId, ...postIds],
      )
      : [[]];

    const commentsByPostId = commentRows.reduce((acc, comment) => {
      const key = String(comment.post_id);
      acc[key] = acc[key] || [];
      acc[key].push(serializeComment(comment));
      return acc;
    }, {});

    const attachmentsByPostId = attachmentRows.reduce((acc, attachment) => {
      const key = String(attachment.post_id);
      acc[key] = acc[key] || [];
      const variants = variantRows
        .filter((variant) => Number(variant.attachment_id) === Number(attachment.id))
        .map((variant) => ({
          id: variant.id,
          resolution: variant.resolution,
          media_url: variant.media_url,
          status: variant.status,
          error_message: variant.error_message,
        }));
      acc[key].push({
        id: attachment.id,
        media_url: attachment.media_url,
        media_type: attachment.media_type,
        media_name: attachment.media_name,
        media_mime: attachment.media_mime,
        media_size: attachment.media_size,
        sort_order: attachment.sort_order,
        video_variants: variants,
      });
      return acc;
    }, {});

    return res.json({
      status: 'success',
      data: pagePosts.map((post) =>
        serializePost(
          { ...post, attachments: attachmentsByPostId[String(post.id)] || [] },
          commentsByPostId[String(post.id)] || [],
          req,
        ),
      ),
      processing_posts: processingPosts.map((post) =>
        serializePost({ ...post, attachments: attachmentsByPostId[String(post.id)] || [] }, [], req),
      ),
      pagination: {
        limit,
        offset,
        next_offset: offset + pagePosts.length,
        has_more: hasMore,
      },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to fetch feed posts.' });
  }
};

const createFeedPost = async (req, res) => {
  try {
    await ensureFeedTables();
    const orgId = resolveOrgId(req.user);
    const userId = Number(req.user?.id);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }
    if (!userId) {
      return res.status(400).json({ status: 'error', message: 'User context missing in token.' });
    }

    const heading = String(req.body.heading || '').trim();
    const subHeading = String(req.body.sub_heading || req.body.subHeading || '').trim();
    const content = String(req.body.content || '').trim();
    if (!heading) {
      return res.status(400).json({ status: 'error', message: 'Heading is required.' });
    }

    let postingSpace = String(req.body.posting_space || req.body.postingSpace || '').trim();
    if (!FEED_POSTING_SPACES.has(postingSpace)) {
      postingSpace = 'sell-it-community';
    }

    const files = Array.isArray(req.files) ? req.files : (req.file ? [req.file] : []);
    const hasVideoUpload = files.some((uploadedFile) => resolveMediaType(uploadedFile.mimetype || '') === 'video');
    const file = files[0] || null;
    const mediaUrl = file ? `${req.protocol}://${req.get('host')}/uploads/feed-media/${file.filename}` : null;
    const mediaType = file ? resolveMediaType(file.mimetype || '') : null;

    const [result] = await db.query(
      `INSERT INTO member_feed_posts
      (org_id, user_id, user_name, heading, sub_heading, content, media_url, media_type, media_name, media_mime, media_size, processing_status, posting_space)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orgId,
        userId,
        req.user?.name || null,
        heading,
        subHeading || null,
        content || null,
        mediaUrl,
        mediaType,
        file?.originalname || null,
        file?.mimetype || null,
        file?.size || null,
        hasVideoUpload ? 'processing' : 'ready',
        postingSpace,
      ],
    );

    const [createdRows] = await db.query('SELECT * FROM member_feed_posts WHERE id = ? AND org_id = ? LIMIT 1', [
      result.insertId,
      orgId,
    ]);

    const attachments = [];
    for (const [index, uploadedFile] of files.entries()) {
      const attachmentMediaType = resolveMediaType(uploadedFile.mimetype || '');
      const attachmentUrl = `${req.protocol}://${req.get('host')}/uploads/feed-media/${uploadedFile.filename}`;
      const [attachmentResult] = await db.query(
        `INSERT INTO member_feed_post_attachments
        (org_id, post_id, media_url, media_type, media_name, media_mime, media_size, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orgId,
          result.insertId,
          attachmentUrl,
          attachmentMediaType,
          uploadedFile.originalname || null,
          uploadedFile.mimetype || null,
          uploadedFile.size || null,
          index,
        ],
      );
      const attachmentId = attachmentResult.insertId;
      const attachment = {
        id: attachmentId,
        media_url: attachmentUrl,
        media_type: attachmentMediaType,
        media_name: uploadedFile.originalname || null,
        media_mime: uploadedFile.mimetype || null,
        media_size: uploadedFile.size || null,
        sort_order: index,
        video_variants: [],
      };

      if (attachmentMediaType === 'video') {
        const variantRows = VIDEO_VARIANTS.map((variant) => [
          orgId,
          result.insertId,
          attachmentId,
          variant.resolution,
          'pending',
        ]);
        await db.query(
          `INSERT INTO member_feed_video_variants
          (org_id, post_id, attachment_id, resolution, status)
          VALUES ?
          ON DUPLICATE KEY UPDATE status = VALUES(status), media_url = NULL, error_message = NULL`,
          [variantRows],
        );
        attachment.video_variants = VIDEO_VARIANTS.map((variant) => ({
          resolution: variant.resolution,
          media_url: null,
          status: 'pending',
          error_message: null,
        }));
        processVideoAttachmentVariants({
          req,
          orgId,
          postId: result.insertId,
          attachmentId,
          inputPath: uploadedFile.path,
        }).catch((error) => {
          console.error('feed video processing error:', error);
        });
      }

      attachments.push(attachment);
    }

    return res.status(201).json({
      status: 'success',
      data: serializePost({ ...createdRows[0], attachments, likes_count: 0, comments_count: 0, is_liked: 0 }, [], req),
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to create feed post.' });
  }
};

const toggleFeedPostLike = async (req, res) => {
  try {
    await ensureFeedTables();
    const orgId = resolveOrgId(req.user);
    const userId = Number(req.user?.id);
    const postId = Number(req.params.postId);
    if (!orgId || !userId || Number.isNaN(postId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid like request.' });
    }

    const [postRows] = await db.query('SELECT id FROM member_feed_posts WHERE id = ? AND org_id = ? LIMIT 1', [
      postId,
      orgId,
    ]);
    if (!postRows.length) {
      return res.status(404).json({ status: 'error', message: 'Feed post not found.' });
    }

    const [existingRows] = await db.query(
      'SELECT id FROM member_feed_likes WHERE org_id = ? AND post_id = ? AND user_id = ? LIMIT 1',
      [orgId, postId, userId],
    );
    const isLiked = existingRows.length === 0;
    if (existingRows.length) {
      await db.query('DELETE FROM member_feed_likes WHERE id = ? LIMIT 1', [existingRows[0].id]);
    } else {
      await db.query('INSERT INTO member_feed_likes (org_id, post_id, user_id) VALUES (?, ?, ?)', [
        orgId,
        postId,
        userId,
      ]);
    }

    const [countRows] = await db.query(
      'SELECT COUNT(*) AS likeCount FROM member_feed_likes WHERE org_id = ? AND post_id = ?',
      [orgId, postId],
    );

    return res.json({
      status: 'success',
      data: {
        post_id: postId,
        is_liked: isLiked,
        likes_count: Number(countRows[0]?.likeCount || 0),
      },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to update like.' });
  }
};

const createFeedPostComment = async (req, res) => {
  try {
    await ensureFeedTables();
    const orgId = resolveOrgId(req.user);
    const userId = Number(req.user?.id);
    const postId = Number(req.params.postId);
    const parentCommentId = req.body.parent_comment_id ? Number(req.body.parent_comment_id) : null;
    const commentText = String(req.body.comment_text || req.body.commentText || '').trim();
    if (!orgId || !userId || Number.isNaN(postId) || (parentCommentId && Number.isNaN(parentCommentId))) {
      return res.status(400).json({ status: 'error', message: 'Invalid comment request.' });
    }
    if (!commentText) {
      return res.status(400).json({ status: 'error', message: 'Comment is required.' });
    }

    const [postRows] = await db.query('SELECT id FROM member_feed_posts WHERE id = ? AND org_id = ? LIMIT 1', [
      postId,
      orgId,
    ]);
    if (!postRows.length) {
      return res.status(404).json({ status: 'error', message: 'Feed post not found.' });
    }
    if (parentCommentId) {
      const [parentRows] = await db.query(
        'SELECT id FROM member_feed_comments WHERE id = ? AND org_id = ? AND post_id = ? LIMIT 1',
        [parentCommentId, orgId, postId],
      );
      if (!parentRows.length) {
        return res.status(404).json({ status: 'error', message: 'Parent comment not found.' });
      }
    }

    const [result] = await db.query(
      'INSERT INTO member_feed_comments (org_id, post_id, parent_comment_id, user_id, user_name, comment_text) VALUES (?, ?, ?, ?, ?, ?)',
      [orgId, postId, parentCommentId, userId, req.user?.name || null, commentText],
    );
    const [createdRows] = await db.query(
      'SELECT id, post_id, parent_comment_id, user_id, user_name, comment_text, created_at FROM member_feed_comments WHERE id = ? LIMIT 1',
      [result.insertId],
    );
    const [countRows] = await db.query(
      'SELECT COUNT(*) AS commentCount FROM member_feed_comments WHERE org_id = ? AND post_id = ?',
      [orgId, postId],
    );

    return res.status(201).json({
      status: 'success',
      data: {
        comment: serializeComment(createdRows[0]),
        comments_count: Number(countRows[0]?.commentCount || 0),
      },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to add comment.' });
  }
};

const toggleFeedPostCommentReaction = async (req, res) => {
  try {
    await ensureFeedTables();
    const orgId = resolveOrgId(req.user);
    const userId = Number(req.user?.id);
    const postId = Number(req.params.postId);
    const commentId = Number(req.params.commentId);
    const reaction = String(req.body.reaction || '').trim().toLowerCase();
    if (!orgId || !userId || Number.isNaN(postId) || Number.isNaN(commentId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid reaction request.' });
    }
    if (!['like', 'dislike'].includes(reaction)) {
      return res.status(400).json({ status: 'error', message: 'Reaction must be like or dislike.' });
    }

    const [commentRows] = await db.query(
      'SELECT id FROM member_feed_comments WHERE id = ? AND org_id = ? AND post_id = ? LIMIT 1',
      [commentId, orgId, postId],
    );
    if (!commentRows.length) {
      return res.status(404).json({ status: 'error', message: 'Comment not found.' });
    }

    const [existingRows] = await db.query(
      'SELECT id, reaction FROM member_feed_comment_reactions WHERE org_id = ? AND comment_id = ? AND user_id = ? LIMIT 1',
      [orgId, commentId, userId],
    );

    let currentUserReaction = reaction;
    if (existingRows.length && existingRows[0].reaction === reaction) {
      await db.query('DELETE FROM member_feed_comment_reactions WHERE id = ? LIMIT 1', [existingRows[0].id]);
      currentUserReaction = null;
    } else if (existingRows.length) {
      await db.query('UPDATE member_feed_comment_reactions SET reaction = ? WHERE id = ?', [
        reaction,
        existingRows[0].id,
      ]);
    } else {
      await db.query(
        'INSERT INTO member_feed_comment_reactions (org_id, post_id, comment_id, user_id, reaction) VALUES (?, ?, ?, ?, ?)',
        [orgId, postId, commentId, userId, reaction],
      );
    }

    const [countRows] = await db.query(
      `SELECT
        SUM(CASE WHEN reaction = 'like' THEN 1 ELSE 0 END) AS likes_count,
        SUM(CASE WHEN reaction = 'dislike' THEN 1 ELSE 0 END) AS dislikes_count
       FROM member_feed_comment_reactions
       WHERE org_id = ? AND post_id = ? AND comment_id = ?`,
      [orgId, postId, commentId],
    );

    return res.json({
      status: 'success',
      data: {
        comment_id: commentId,
        current_user_reaction: currentUserReaction,
        likes_count: Number(countRows[0]?.likes_count || 0),
        dislikes_count: Number(countRows[0]?.dislikes_count || 0),
      },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to update comment reaction.' });
  }
};

const updateFeedPostComment = async (req, res) => {
  try {
    await ensureFeedTables();
    const orgId = resolveOrgId(req.user);
    const postId = Number(req.params.postId);
    const commentId = Number(req.params.commentId);
    const userId = Number(req.user?.id);
    if (!orgId || Number.isNaN(postId) || Number.isNaN(commentId) || Number.isNaN(userId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid request.' });
    }
    const commentText = String(req.body?.comment_text || req.body?.commentText || '').trim();
    if (!commentText) {
      return res.status(400).json({ status: 'error', message: 'Comment is required.' });
    }

    const [commentRows] = await db.query(
      `SELECT user_id FROM member_feed_comments WHERE id = ? AND org_id = ? AND post_id = ? LIMIT 1`,
      [commentId, orgId, postId],
    );
    if (!commentRows.length) {
      return res.status(404).json({ status: 'error', message: 'Comment not found.' });
    }
    if (!canModifyFeedComment(req.user, commentRows[0].user_id)) {
      return res.status(403).json({ status: 'error', message: 'You cannot edit this comment.' });
    }

    await db.query(
      `UPDATE member_feed_comments SET comment_text = ? WHERE id = ? AND org_id = ? AND post_id = ?`,
      [commentText, commentId, orgId, postId],
    );

    return res.json({
      status: 'success',
      data: { id: commentId, comment_text: commentText },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to update comment.' });
  }
};

const deleteFeedPostComment = async (req, res) => {
  try {
    await ensureFeedTables();
    const orgId = resolveOrgId(req.user);
    const postId = Number(req.params.postId);
    const commentId = Number(req.params.commentId);
    const userId = Number(req.user?.id);
    if (!orgId || Number.isNaN(postId) || Number.isNaN(commentId) || Number.isNaN(userId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid request.' });
    }

    const [commentRows] = await db.query(
      `SELECT user_id FROM member_feed_comments WHERE id = ? AND org_id = ? AND post_id = ? LIMIT 1`,
      [commentId, orgId, postId],
    );
    if (!commentRows.length) {
      return res.status(404).json({ status: 'error', message: 'Comment not found.' });
    }
    if (!canModifyFeedComment(req.user, commentRows[0].user_id)) {
      return res.status(403).json({ status: 'error', message: 'You cannot delete this comment.' });
    }

    const descendants = await collectDescendantFeedCommentIds(orgId, postId, commentId);
    const allIds = [commentId, ...descendants];
    const ph = allIds.map(() => '?').join(', ');
    await db.query(
      `DELETE FROM member_feed_comments WHERE org_id = ? AND post_id = ? AND id IN (${ph})`,
      [orgId, postId, ...allIds],
    );

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS commentCount FROM member_feed_comments WHERE org_id = ? AND post_id = ?`,
      [orgId, postId],
    );

    return res.json({
      status: 'success',
      data: {
        deleted_count: allIds.length,
        comments_count: Number(countRow?.commentCount || 0),
      },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to delete comment.' });
  }
};

const createFeedCommentReport = async (req, res) => {
  try {
    await ensureFeedTables();
    const orgId = resolveOrgId(req.user);
    const userId = Number(req.user?.id);
    const postId = Number(req.params.postId);
    const commentId = Number(req.params.commentId);
    const reason = String(req.body.reason || '').trim();
    if (!orgId || !userId || Number.isNaN(postId) || Number.isNaN(commentId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid report request.' });
    }
    if (!reason) {
      return res.status(400).json({ status: 'error', message: 'Report reason is required.' });
    }

    const [commentRows] = await db.query(
      'SELECT id FROM member_feed_comments WHERE id = ? AND org_id = ? AND post_id = ? LIMIT 1',
      [commentId, orgId, postId],
    );
    if (!commentRows.length) {
      return res.status(404).json({ status: 'error', message: 'Comment not found.' });
    }

    await db.query(
      `INSERT INTO member_feed_comment_reports (org_id, post_id, comment_id, reporter_user_id, reporter_name, reason)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         reason = VALUES(reason),
         reporter_name = VALUES(reporter_name),
         status = 'pending',
         updated_at = CURRENT_TIMESTAMP`,
      [orgId, postId, commentId, userId, req.user?.name || null, reason.slice(0, 255)],
    );

    return res.status(201).json({ status: 'success', message: 'Report submitted.' });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to submit report.' });
  }
};

const getFeedCommentReportsList = async (req, res) => {
  try {
    await ensureFeedTables();
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }
    const [rows] = await db.query(
      `SELECT r.*,
        p.heading AS post_heading,
        p.user_name AS post_user_name,
        c.user_name AS comment_author_name,
        c.comment_text AS comment_text
       FROM member_feed_comment_reports r
       INNER JOIN member_feed_posts p ON p.id = r.post_id AND p.org_id = r.org_id
       INNER JOIN member_feed_comments c ON c.id = r.comment_id AND c.org_id = r.org_id AND c.post_id = r.post_id
       WHERE r.org_id = ?
       ORDER BY r.created_at DESC, r.id DESC
       LIMIT 200`,
      [orgId],
    );

    const data = rows.map((row) => ({
      id: row.id,
      post_id: row.post_id,
      comment_id: row.comment_id,
      reporter_user_id: row.reporter_user_id,
      reporter_name: row.reporter_name,
      reason: row.reason,
      status: row.status || 'pending',
      created_at: row.created_at,
      post_heading: row.post_heading,
      post_user_name: row.post_user_name,
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

const createFeedPostReport = async (req, res) => {
  try {
    await ensureFeedTables();
    const orgId = resolveOrgId(req.user);
    const userId = Number(req.user?.id);
    const postId = Number(req.params.postId);
    const reason = String(req.body.reason || '').trim();
    if (!orgId || !userId || Number.isNaN(postId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid report request.' });
    }
    if (!reason) {
      return res.status(400).json({ status: 'error', message: 'Report reason is required.' });
    }

    const [postRows] = await db.query('SELECT id FROM member_feed_posts WHERE id = ? AND org_id = ? LIMIT 1', [
      postId,
      orgId,
    ]);
    if (!postRows.length) {
      return res.status(404).json({ status: 'error', message: 'Feed post not found.' });
    }

    await db.query(
      `INSERT INTO member_feed_reports (org_id, post_id, reporter_user_id, reporter_name, reason)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         reason = VALUES(reason),
         reporter_name = VALUES(reporter_name),
         status = 'pending',
         updated_at = CURRENT_TIMESTAMP`,
      [orgId, postId, userId, req.user?.name || null, reason.slice(0, 255)],
    );

    return res.status(201).json({ status: 'success', message: 'Report submitted.' });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to submit report.' });
  }
};

const getFeedPostReports = async (req, res) => {
  try {
    await ensureFeedTables();
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }
    const [rows] = await db.query(
      `SELECT r.*,
        p.heading AS post_heading,
        p.sub_heading AS post_sub_heading,
        p.content AS post_content,
        p.user_name AS post_user_name,
        p.created_at AS post_created_at,
        p.is_blocked AS post_is_blocked,
        p.blocked_at AS post_blocked_at
       FROM member_feed_reports r
       INNER JOIN member_feed_posts p
         ON p.id = r.post_id AND p.org_id = r.org_id
       WHERE r.org_id = ?
       ORDER BY r.created_at DESC, r.id DESC
       LIMIT 100`,
      [orgId],
    );

    return res.json({
      status: 'success',
      data: rows.map(serializeReport),
      summary: {
        pending: rows.filter((report) => report.status === 'pending').length,
        reviewed: rows.filter((report) => report.status === 'reviewed').length,
        resolved: rows.filter((report) => report.status === 'resolved').length,
        total: rows.length,
      },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to fetch reports.' });
  }
};

const getFeedPostReportDetail = async (req, res) => {
  try {
    await ensureFeedTables();
    const orgId = resolveOrgId(req.user);
    const reportId = Number(req.params.reportId);
    if (!orgId || Number.isNaN(reportId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid report request.' });
    }

    const [rows] = await db.query(
      `SELECT r.*,
        p.heading AS post_heading,
        p.sub_heading AS post_sub_heading,
        p.content AS post_content,
        p.user_name AS post_user_name,
        p.created_at AS post_created_at,
        p.is_blocked AS post_is_blocked,
        p.blocked_at AS post_blocked_at
       FROM member_feed_reports r
       INNER JOIN member_feed_posts p
         ON p.id = r.post_id AND p.org_id = r.org_id
       WHERE r.id = ? AND r.org_id = ?
       LIMIT 1`,
      [reportId, orgId],
    );
    if (!rows.length) {
      return res.status(404).json({ status: 'error', message: 'Report not found.' });
    }

    const [attachmentRows] = await db.query(
      `SELECT id, post_id, media_url, media_type, media_name, media_mime, media_size, sort_order
       FROM member_feed_post_attachments
       WHERE org_id = ? AND post_id = ?
       ORDER BY sort_order ASC, id ASC`,
      [orgId, rows[0].post_id],
    );
    const attachmentIds = attachmentRows.map((attachment) => attachment.id);
    const variantPlaceholders = attachmentIds.map(() => '?').join(', ');
    const [variantRows] = attachmentIds.length
      ? await db.query(
        `SELECT id, attachment_id, resolution, media_url, status, error_message
         FROM member_feed_video_variants
         WHERE org_id = ? AND attachment_id IN (${variantPlaceholders})
         ORDER BY FIELD(resolution, '360p', '720p', '1080p'), id ASC`,
        [orgId, ...attachmentIds],
      )
      : [[]];
    const attachments = attachmentRows.map((attachment) => {
      const variants = variantRows.filter((variant) => Number(variant.attachment_id) === Number(attachment.id));
      return serializeAttachment({ ...attachment, video_variants: variants }, req, orgId);
    });

    return res.json({ status: 'success', data: serializeReport(rows[0], attachments) });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to fetch report detail.' });
  }
};

const blockReportedFeedPost = async (req, res) => {
  try {
    await ensureFeedTables();
    const orgId = resolveOrgId(req.user);
    const reportId = Number(req.params.reportId);
    const userId = Number(req.user?.id) || null;
    if (!orgId || Number.isNaN(reportId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid block request.' });
    }

    const [reportRows] = await db.query(
      'SELECT id, post_id FROM member_feed_reports WHERE id = ? AND org_id = ? LIMIT 1',
      [reportId, orgId],
    );
    if (!reportRows.length) {
      return res.status(404).json({ status: 'error', message: 'Report not found.' });
    }

    await db.query(
      'UPDATE member_feed_posts SET is_blocked = 1, blocked_at = CURRENT_TIMESTAMP, blocked_by = ? WHERE id = ? AND org_id = ?',
      [userId, reportRows[0].post_id, orgId],
    );
    await db.query(
      "UPDATE member_feed_reports SET status = 'resolved' WHERE post_id = ? AND org_id = ?",
      [reportRows[0].post_id, orgId],
    );

    return res.json({ status: 'success', message: 'Post blocked successfully.' });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to block post.' });
  }
};

module.exports = {
  streamFeedAttachmentMedia,
  streamFeedVariantMedia,
  streamFeedPostMedia,
  getFeedPosts,
  createFeedPost,
  toggleFeedPostLike,
  createFeedPostComment,
  updateFeedPostComment,
  deleteFeedPostComment,
  toggleFeedPostCommentReaction,
  createFeedPostReport,
  createFeedCommentReport,
  getFeedCommentReportsList,
  getFeedPostReports,
  getFeedPostReportDetail,
  blockReportedFeedPost,
};
