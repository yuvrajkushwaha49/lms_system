const db = require('../config/db');

const resolveOrgId = (user) => user?.org_id || user?.business_id || null;

const canManageWelcome = (user) => {
  const role = String(user?.role_name || '').toLowerCase();
  return ['ceo', 'admin', 'instructor', 'trainer'].includes(role);
};

const ensureTable = async () => {
  await db.query(
    `CREATE TABLE IF NOT EXISTS org_welcome_video (
      org_id INT NOT NULL PRIMARY KEY,
      video_url VARCHAR(2000) NOT NULL DEFAULT '',
      video_caption VARCHAR(800) NOT NULL DEFAULT '',
      body_text MEDIUMTEXT NULL,
      transcript_text MEDIUMTEXT NULL,
      updated_by INT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  await db.query(
    'ALTER TABLE org_welcome_video ADD COLUMN IF NOT EXISTS thumbnail_url VARCHAR(2000) NOT NULL DEFAULT \'\'',
  );
};

const mapRow = (row) => ({
  video_url: row?.video_url || '',
  thumbnail_url: row?.thumbnail_url || '',
  video_caption: row?.video_caption || '',
  body_text: row?.body_text || '',
  transcript_text: row?.transcript_text || '',
  updated_at: row?.updated_at || null,
});

const getWelcomeVideo = async (req, res) => {
  try {
    await ensureTable();
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }
    const [rows] = await db.query(
      'SELECT org_id, video_url, thumbnail_url, video_caption, body_text, transcript_text, updated_at FROM org_welcome_video WHERE org_id = ? LIMIT 1',
      [orgId],
    );
    if (!rows.length) {
      return res.json({ status: 'success', data: mapRow(null) });
    }
    return res.json({ status: 'success', data: mapRow(rows[0]) });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Unable to load welcome video.' });
  }
};

const upsertWelcomeVideo = async (req, res) => {
  try {
    await ensureTable();
    if (!canManageWelcome(req.user)) {
      return res.status(403).json({ status: 'error', message: 'Only admin or trainer can update welcome video.' });
    }
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }

    const videoFile = req.files?.video?.[0];
    const thumbnailFile = req.files?.thumbnail?.[0];

    if (thumbnailFile && Number(thumbnailFile.size || 0) > 5 * 1024 * 1024) {
      return res.status(400).json({ status: 'error', message: 'Thumbnail must be 5 MB or smaller.' });
    }

    const [existingRows] = await db.query(
      'SELECT video_url, thumbnail_url FROM org_welcome_video WHERE org_id = ? LIMIT 1',
      [orgId],
    );
    const existing = existingRows[0] || {};

    let videoUrl = String(req.body?.video_url ?? '').trim().slice(0, 2000);
    if (videoFile) {
      videoUrl = `${req.protocol}://${req.get('host')}/uploads/welcome-video/${videoFile.filename}`;
    } else if (!videoUrl) {
      videoUrl = String(existing.video_url || '').trim().slice(0, 2000);
    }

    let thumbnailUrl = String(req.body?.thumbnail_url ?? '').trim().slice(0, 2000);
    if (thumbnailFile) {
      thumbnailUrl = `${req.protocol}://${req.get('host')}/uploads/welcome-video/${thumbnailFile.filename}`;
    } else if (!thumbnailUrl) {
      thumbnailUrl = String(existing.thumbnail_url || '').trim().slice(0, 2000);
    }

    const videoCaption = String(req.body?.video_caption ?? '').trim().slice(0, 800);
    const bodyText = req.body?.body_text != null ? String(req.body.body_text) : '';
    const transcriptText = req.body?.transcript_text != null ? String(req.body.transcript_text) : '';

    await db.query(
      `INSERT INTO org_welcome_video (org_id, video_url, thumbnail_url, video_caption, body_text, transcript_text, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         video_url = VALUES(video_url),
         thumbnail_url = VALUES(thumbnail_url),
         video_caption = VALUES(video_caption),
         body_text = VALUES(body_text),
         transcript_text = VALUES(transcript_text),
         updated_by = VALUES(updated_by)`,
      [orgId, videoUrl, thumbnailUrl, videoCaption, bodyText, transcriptText, req.user?.id || null],
    );

    const [rows] = await db.query(
      'SELECT org_id, video_url, thumbnail_url, video_caption, body_text, transcript_text, updated_at FROM org_welcome_video WHERE org_id = ? LIMIT 1',
      [orgId],
    );
    return res.json({ status: 'success', data: rows[0] ? mapRow(rows[0]) : mapRow(null) });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Unable to save welcome video.' });
  }
};

module.exports = {
  getWelcomeVideo,
  upsertWelcomeVideo,
};
