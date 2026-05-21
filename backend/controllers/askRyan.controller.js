const db = require('../config/db');

const resolveOrgId = (user) => user?.org_id || user?.business_id || null;

const canManageAskRyan = (user) => {
  const role = String(user?.role_name || '').toLowerCase();
  return ['ceo', 'admin', 'instructor', 'trainer'].includes(role);
};

const ensureTables = async () => {
  await db.query(
    `CREATE TABLE IF NOT EXISTS org_ask_ryan_questions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      user_id INT NOT NULL,
      user_name VARCHAR(255) DEFAULT NULL,
      question_text TEXT NOT NULL,
      status ENUM('pending', 'answered') NOT NULL DEFAULT 'pending',
      response_title VARCHAR(500) DEFAULT NULL,
      response_video_url VARCHAR(2000) DEFAULT NULL,
      response_thumbnail_url VARCHAR(2000) DEFAULT NULL,
      answered_by INT DEFAULT NULL,
      answered_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_org_status (org_id, status),
      INDEX idx_org_answered (org_id, answered_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );

  await db.query(
    `CREATE TABLE IF NOT EXISTS org_ask_ryan_likes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      question_id INT NOT NULL,
      user_id INT NOT NULL,
      user_name VARCHAR(255) DEFAULT NULL,
      avatar_data_url MEDIUMTEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_ask_ryan_like (org_id, question_id, user_id),
      INDEX idx_ask_ryan_like_q (question_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  await db.query(
    'ALTER TABLE org_ask_ryan_likes ADD COLUMN IF NOT EXISTS user_name VARCHAR(255) DEFAULT NULL',
  );
  await db.query(
    'ALTER TABLE org_ask_ryan_likes ADD COLUMN IF NOT EXISTS avatar_data_url MEDIUMTEXT NULL',
  );

  await db.query(
    `CREATE TABLE IF NOT EXISTS org_ask_ryan_comments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      question_id INT NOT NULL,
      user_id INT NOT NULL,
      user_name VARCHAR(255) DEFAULT NULL,
      comment_text TEXT NOT NULL,
      parent_comment_id INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ask_ryan_comment_q (question_id),
      INDEX idx_ask_ryan_comment_parent (org_id, question_id, parent_comment_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  await db.query(
    'ALTER TABLE org_ask_ryan_comments ADD COLUMN IF NOT EXISTS parent_comment_id INT DEFAULT NULL',
  );

  await db.query(
    `CREATE TABLE IF NOT EXISTS org_ask_ryan_comment_likes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      question_id INT NOT NULL,
      comment_id INT NOT NULL,
      user_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_ask_ryan_comment_like (org_id, comment_id, user_id),
      INDEX idx_ask_ryan_comment_like_comment (org_id, question_id, comment_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );

  await db.query(
    `CREATE TABLE IF NOT EXISTS org_ask_ryan_section_likes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      section_key VARCHAR(64) NOT NULL,
      user_id INT NOT NULL,
      user_name VARCHAR(255) DEFAULT NULL,
      avatar_data_url MEDIUMTEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_ask_ryan_section_like (org_id, section_key, user_id),
      INDEX idx_ask_ryan_section_like (org_id, section_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  await db.query(
    'ALTER TABLE org_ask_ryan_section_likes ADD COLUMN IF NOT EXISTS user_name VARCHAR(255) DEFAULT NULL',
  );
  await db.query(
    'ALTER TABLE org_ask_ryan_section_likes ADD COLUMN IF NOT EXISTS avatar_data_url MEDIUMTEXT NULL',
  );
};

const ASK_RYAN_COMMUNITY_SECTION_KEY = 'community';

const getCommunityLikeSummary = async (orgId, userId) => {
  const [[countRow]] = await db.query(
    `SELECT COUNT(*) AS c
     FROM org_ask_ryan_section_likes
     WHERE org_id = ? AND section_key = ?`,
    [orgId, ASK_RYAN_COMMUNITY_SECTION_KEY],
  );
  const [[likedRow]] = await db.query(
    `SELECT COUNT(*) AS c
     FROM org_ask_ryan_section_likes
     WHERE org_id = ? AND section_key = ? AND user_id = ?`,
    [orgId, ASK_RYAN_COMMUNITY_SECTION_KEY, userId],
  );
  const [recentRows] = await db.query(
    `SELECT user_name, avatar_data_url
     FROM org_ask_ryan_section_likes
     WHERE org_id = ? AND section_key = ?
     ORDER BY id DESC
     LIMIT 5`,
    [orgId, ASK_RYAN_COMMUNITY_SECTION_KEY],
  );
  const recentLikers = recentRows
    .map((row) => ({
      user_name: String(row.user_name || '').trim(),
      avatar_data_url: String(row.avatar_data_url || '').trim(),
    }))
    .filter((row) => row.user_name);

  return {
    section_key: ASK_RYAN_COMMUNITY_SECTION_KEY,
    likes_count: Number(countRow?.c || 0),
    liked_by_me: Number(likedRow?.c || 0) > 0,
    recent_likers: recentLikers,
  };
};

const serializePublishedRow = (row, userId) => ({
  id: Number(row.id),
  question_text: row.question_text || '',
  user_name: row.user_name || 'Member',
  response_title: row.response_title || '',
  response_video_url: row.response_video_url || '',
  response_thumbnail_url: row.response_thumbnail_url || '',
  answered_at: row.answered_at,
  likes_count: Number(row.likes_count || 0),
  comments_count: Number(row.comments_count || 0),
  is_liked: Number(row.is_liked || 0) === 1,
  recent_likers: Array.isArray(row.recent_likers) ? row.recent_likers : [],
});

const getQuestionLikeSummary = async (orgId, questionId, userId) => {
  const [[countRow]] = await db.query(
    `SELECT COUNT(*) AS c FROM org_ask_ryan_likes WHERE org_id = ? AND question_id = ?`,
    [orgId, questionId],
  );
  const [[likedRow]] = await db.query(
    `SELECT COUNT(*) AS c FROM org_ask_ryan_likes WHERE org_id = ? AND question_id = ? AND user_id = ?`,
    [orgId, questionId, userId],
  );
  const [recentRows] = await db.query(
    `SELECT
        COALESCE(NULLIF(TRIM(l.user_name), ''), NULLIF(TRIM(u.name), ''), 'Member') AS user_name,
        COALESCE(NULLIF(TRIM(l.avatar_data_url), ''), '') AS avatar_data_url
     FROM org_ask_ryan_likes l
     LEFT JOIN users u ON u.id = l.user_id
     WHERE l.org_id = ? AND l.question_id = ?
     ORDER BY l.id DESC
     LIMIT 5`,
    [orgId, questionId],
  );

  return {
    likes_count: Number(countRow?.c || 0),
    is_liked: Number(likedRow?.c || 0) > 0,
    recent_likers: recentRows
      .map((row) => ({
        user_name: String(row.user_name || '').trim() || 'Member',
        avatar_data_url: String(row.avatar_data_url || '').trim(),
      })),
  };
};

/** Student / member: submit a question */
const submitQuestion = async (req, res) => {
  try {
    await ensureTables();
    const orgId = resolveOrgId(req.user);
    const userId = Number(req.user?.id);
    if (!orgId || !userId) {
      return res.status(400).json({ status: 'error', message: 'User or organization context missing.' });
    }
    const questionText = String(req.body?.question_text || req.body?.questionText || '').trim();
    if (!questionText) {
      return res.status(400).json({ status: 'error', message: 'Please enter your question.' });
    }
    if (questionText.length > 8000) {
      return res.status(400).json({ status: 'error', message: 'Question is too long (max 8000 characters).' });
    }

    const userName = String(req.user?.name || '').trim() || null;
    const [result] = await db.query(
      `INSERT INTO org_ask_ryan_questions (org_id, user_id, user_name, question_text, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [orgId, userId, userName, questionText],
    );

    return res.status(201).json({
      status: 'success',
      data: {
        id: result.insertId,
        message: 'Thanks! Your question was submitted. When there is a video reply, it will show on this page.',
      },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Unable to submit question.' });
  }
};

/** Published video responses (answered only) */
const getPublished = async (req, res) => {
  try {
    await ensureTables();
    const orgId = resolveOrgId(req.user);
    const userId = Number(req.user?.id);
    if (!orgId || !userId) {
      return res.status(400).json({ status: 'error', message: 'User or organization context missing.' });
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 50);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const [rows] = await db.query(
      `SELECT q.id, q.question_text, q.user_name, q.response_title, q.response_video_url,
              q.response_thumbnail_url, q.answered_at,
              (SELECT COUNT(*) FROM org_ask_ryan_likes l WHERE l.question_id = q.id AND l.org_id = q.org_id) AS likes_count,
              (SELECT COUNT(*) FROM org_ask_ryan_comments c WHERE c.question_id = q.id AND c.org_id = q.org_id) AS comments_count,
              EXISTS(
                SELECT 1 FROM org_ask_ryan_likes l2
                WHERE l2.question_id = q.id AND l2.org_id = q.org_id AND l2.user_id = ?
              ) AS is_liked
       FROM org_ask_ryan_questions q
       WHERE q.org_id = ? AND q.status = 'answered'
       ORDER BY q.answered_at DESC, q.id DESC
       LIMIT ? OFFSET ?`,
      [userId, orgId, limit, offset],
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM org_ask_ryan_questions
       WHERE org_id = ? AND status = 'answered'`,
      [orgId],
    );

    const likerMap = new Map();
    if (rows.length > 0) {
      const questionIds = rows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id));
      if (questionIds.length > 0) {
        const placeholders = questionIds.map(() => '?').join(', ');
        const [likerRows] = await db.query(
          `SELECT question_id, user_name, avatar_data_url
           FROM (
             SELECT
               l.question_id,
               COALESCE(NULLIF(TRIM(l.user_name), ''), NULLIF(TRIM(u.name), ''), 'Member') AS user_name,
               COALESCE(NULLIF(TRIM(l.avatar_data_url), ''), '') AS avatar_data_url,
               ROW_NUMBER() OVER (PARTITION BY l.question_id ORDER BY l.id DESC) AS rn
             FROM org_ask_ryan_likes l
             LEFT JOIN users u ON u.id = l.user_id
             WHERE l.org_id = ? AND l.question_id IN (${placeholders})
           ) ranked
           WHERE rn <= 5`,
          [orgId, ...questionIds],
        );
        likerRows.forEach((row) => {
          const key = String(row.question_id);
          const current = likerMap.get(key) || [];
          current.push({
            user_name: String(row.user_name || '').trim() || 'Member',
            avatar_data_url: String(row.avatar_data_url || '').trim(),
          });
          likerMap.set(key, current);
        });
      }
    }

    return res.json({
      status: 'success',
      data: rows.map((r) =>
        serializePublishedRow({
          ...r,
          recent_likers: likerMap.get(String(r.id)) || [],
        }, userId),
      ),
      pagination: {
        limit,
        offset,
        total: Number(total || 0),
        has_more: offset + rows.length < Number(total || 0),
      },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Unable to load responses.' });
  }
};

const toggleLike = async (req, res) => {
  try {
    await ensureTables();
    const orgId = resolveOrgId(req.user);
    const userId = Number(req.user?.id);
    const questionId = Number(req.params.questionId);
    if (!orgId || !userId || Number.isNaN(questionId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid request.' });
    }

    const [qRows] = await db.query(
      `SELECT id FROM org_ask_ryan_questions WHERE id = ? AND org_id = ? AND status = 'answered' LIMIT 1`,
      [questionId, orgId],
    );
    if (!qRows.length) {
      return res.status(404).json({ status: 'error', message: 'Response not found.' });
    }

    const [existing] = await db.query(
      `SELECT id FROM org_ask_ryan_likes WHERE org_id = ? AND question_id = ? AND user_id = ? LIMIT 1`,
      [orgId, questionId, userId],
    );

    let isLiked;
    if (existing.length) {
      await db.query('DELETE FROM org_ask_ryan_likes WHERE id = ? LIMIT 1', [existing[0].id]);
      isLiked = false;
    } else {
      const userName = String(req.user?.name || '').trim() || null;
      const avatarDataUrlRaw = String(req.body?.avatar_data_url || req.body?.avatarDataUrl || '').trim();
      const avatarDataUrl = avatarDataUrlRaw.startsWith('data:image/') ? avatarDataUrlRaw : null;
      await db.query(
        `INSERT INTO org_ask_ryan_likes (org_id, question_id, user_id, user_name, avatar_data_url) VALUES (?, ?, ?, ?, ?)`,
        [orgId, questionId, userId, userName, avatarDataUrl],
      );
      isLiked = true;
    }

    const likeSummary = await getQuestionLikeSummary(orgId, questionId, userId);

    return res.json({
      status: 'success',
      data: {
        question_id: questionId,
        is_liked: isLiked,
        likes_count: likeSummary.likes_count,
        recent_likers: likeSummary.recent_likers,
      },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Unable to update like.' });
  }
};

const getQuestionLikes = async (req, res) => {
  try {
    await ensureTables();
    const orgId = resolveOrgId(req.user);
    const questionId = Number(req.params.questionId);
    if (!orgId || Number.isNaN(questionId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid request.' });
    }

    const [qRows] = await db.query(
      `SELECT id FROM org_ask_ryan_questions WHERE id = ? AND org_id = ? AND status = 'answered' LIMIT 1`,
      [questionId, orgId],
    );
    if (!qRows.length) {
      return res.status(404).json({ status: 'error', message: 'Response not found.' });
    }

    const [rows] = await db.query(
      `SELECT
          l.user_id,
          COALESCE(NULLIF(TRIM(l.user_name), ''), NULLIF(TRIM(u.name), ''), 'Member') AS user_name,
          COALESCE(NULLIF(TRIM(l.avatar_data_url), ''), '') AS avatar_data_url
       FROM org_ask_ryan_likes l
       LEFT JOIN users u ON u.id = l.user_id
       WHERE l.org_id = ? AND l.question_id = ?
       ORDER BY l.id DESC
       LIMIT 200`,
      [orgId, questionId],
    );

    return res.json({
      status: 'success',
      data: rows.map((row) => ({
        user_id: Number(row.user_id),
        user_name: String(row.user_name || '').trim() || 'Member',
        avatar_data_url: String(row.avatar_data_url || '').trim(),
      })),
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Unable to load likes.' });
  }
};

const addComment = async (req, res) => {
  try {
    await ensureTables();
    const orgId = resolveOrgId(req.user);
    const userId = Number(req.user?.id);
    const questionId = Number(req.params.questionId);
    const commentText = String(req.body?.comment_text || req.body?.commentText || '').trim();
    const rawParentCommentId = req.body?.parent_comment_id ?? req.body?.parentCommentId ?? null;
    const parentCommentId =
      rawParentCommentId == null || rawParentCommentId === ''
        ? null
        : Number(rawParentCommentId);
    if (!orgId || !userId || Number.isNaN(questionId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid request.' });
    }
    if (parentCommentId != null && Number.isNaN(parentCommentId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid parent comment.' });
    }
    if (!commentText) {
      return res.status(400).json({ status: 'error', message: 'Comment cannot be empty.' });
    }
    if (commentText.length > 2000) {
      return res.status(400).json({ status: 'error', message: 'Comment is too long.' });
    }

    const [qRows] = await db.query(
      `SELECT id FROM org_ask_ryan_questions WHERE id = ? AND org_id = ? AND status = 'answered' LIMIT 1`,
      [questionId, orgId],
    );
    if (!qRows.length) {
      return res.status(404).json({ status: 'error', message: 'Response not found.' });
    }

    if (parentCommentId != null) {
      const [parentRows] = await db.query(
        `SELECT id FROM org_ask_ryan_comments
         WHERE id = ? AND org_id = ? AND question_id = ?
         LIMIT 1`,
        [parentCommentId, orgId, questionId],
      );
      if (!parentRows.length) {
        return res.status(404).json({ status: 'error', message: 'Parent comment not found.' });
      }
    }

    const userName = String(req.user?.name || '').trim() || null;
    await db.query(
      `INSERT INTO org_ask_ryan_comments (org_id, question_id, user_id, user_name, comment_text, parent_comment_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [orgId, questionId, userId, userName, commentText, parentCommentId],
    );

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS c FROM org_ask_ryan_comments WHERE org_id = ? AND question_id = ?`,
      [orgId, questionId],
    );

    return res.status(201).json({
      status: 'success',
      data: {
        comments_count: Number(countRow?.c || 0),
        parent_comment_id: parentCommentId,
      },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Unable to add comment.' });
  }
};

const getComments = async (req, res) => {
  try {
    await ensureTables();
    const orgId = resolveOrgId(req.user);
    const userId = Number(req.user?.id);
    const questionId = Number(req.params.questionId);
    if (!orgId || !userId || Number.isNaN(questionId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid request.' });
    }

    const [qRows] = await db.query(
      `SELECT id FROM org_ask_ryan_questions WHERE id = ? AND org_id = ? AND status = 'answered' LIMIT 1`,
      [questionId, orgId],
    );
    if (!qRows.length) {
      return res.status(404).json({ status: 'error', message: 'Response not found.' });
    }

    const [rows] = await db.query(
      `SELECT c.id, c.user_name, c.comment_text, c.created_at, c.parent_comment_id,
              COALESCE(cl.likes_count, 0) AS likes_count,
              COALESCE(ml.is_liked, 0) AS is_liked
       FROM org_ask_ryan_comments c
       LEFT JOIN (
         SELECT org_id, question_id, comment_id, COUNT(*) AS likes_count
         FROM org_ask_ryan_comment_likes
         WHERE org_id = ? AND question_id = ?
         GROUP BY org_id, question_id, comment_id
       ) cl
         ON cl.org_id = c.org_id AND cl.question_id = c.question_id AND cl.comment_id = c.id
       LEFT JOIN (
         SELECT org_id, question_id, comment_id, 1 AS is_liked
         FROM org_ask_ryan_comment_likes
         WHERE org_id = ? AND question_id = ? AND user_id = ?
       ) ml
         ON ml.org_id = c.org_id AND ml.question_id = c.question_id AND ml.comment_id = c.id
       WHERE c.org_id = ? AND c.question_id = ?
       ORDER BY id ASC
       LIMIT 100`,
      [orgId, questionId, orgId, questionId, userId, orgId, questionId],
    );

    return res.json({
      status: 'success',
      data: rows.map((r) => ({
        id: Number(r.id),
        user_name: r.user_name || 'Member',
        comment_text: r.comment_text || '',
        created_at: r.created_at,
        parent_comment_id: r.parent_comment_id == null ? null : Number(r.parent_comment_id),
        likes_count: Number(r.likes_count || 0),
        is_liked: Number(r.is_liked || 0) === 1,
      })),
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Unable to load comments.' });
  }
};

const toggleCommentLike = async (req, res) => {
  try {
    await ensureTables();
    const orgId = resolveOrgId(req.user);
    const userId = Number(req.user?.id);
    const questionId = Number(req.params.questionId);
    const commentId = Number(req.params.commentId);
    if (!orgId || !userId || Number.isNaN(questionId) || Number.isNaN(commentId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid request.' });
    }

    const [commentRows] = await db.query(
      `SELECT id FROM org_ask_ryan_comments
       WHERE id = ? AND org_id = ? AND question_id = ?
       LIMIT 1`,
      [commentId, orgId, questionId],
    );
    if (!commentRows.length) {
      return res.status(404).json({ status: 'error', message: 'Comment not found.' });
    }

    const [existing] = await db.query(
      `SELECT id FROM org_ask_ryan_comment_likes
       WHERE org_id = ? AND question_id = ? AND comment_id = ? AND user_id = ?
       LIMIT 1`,
      [orgId, questionId, commentId, userId],
    );

    let isLiked;
    if (existing.length) {
      await db.query('DELETE FROM org_ask_ryan_comment_likes WHERE id = ? LIMIT 1', [existing[0].id]);
      isLiked = false;
    } else {
      await db.query(
        `INSERT INTO org_ask_ryan_comment_likes (org_id, question_id, comment_id, user_id)
         VALUES (?, ?, ?, ?)`,
        [orgId, questionId, commentId, userId],
      );
      isLiked = true;
    }

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS c FROM org_ask_ryan_comment_likes
       WHERE org_id = ? AND question_id = ? AND comment_id = ?`,
      [orgId, questionId, commentId],
    );

    return res.json({
      status: 'success',
      data: {
        question_id: questionId,
        comment_id: commentId,
        is_liked: isLiked,
        likes_count: Number(countRow?.c || 0),
      },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Unable to update comment like.' });
  }
};

const getCommunityLike = async (req, res) => {
  try {
    await ensureTables();
    const orgId = resolveOrgId(req.user);
    const userId = Number(req.user?.id);
    if (!orgId || !userId) {
      return res.status(400).json({ status: 'error', message: 'Invalid request.' });
    }

    return res.json({
      status: 'success',
      data: await getCommunityLikeSummary(orgId, userId),
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Unable to load community likes.' });
  }
};

const toggleCommunityLike = async (req, res) => {
  try {
    await ensureTables();
    const orgId = resolveOrgId(req.user);
    const userId = Number(req.user?.id);
    if (!orgId || !userId) {
      return res.status(400).json({ status: 'error', message: 'Invalid request.' });
    }

    const [existing] = await db.query(
      `SELECT id FROM org_ask_ryan_section_likes
       WHERE org_id = ? AND section_key = ? AND user_id = ? LIMIT 1`,
      [orgId, ASK_RYAN_COMMUNITY_SECTION_KEY, userId],
    );

    let likedByMe;
    if (existing.length) {
      await db.query('DELETE FROM org_ask_ryan_section_likes WHERE id = ? LIMIT 1', [existing[0].id]);
      likedByMe = false;
    } else {
      const userName = String(req.user?.name || '').trim() || null;
      const avatarDataUrlRaw = String(req.body?.avatar_data_url || req.body?.avatarDataUrl || '').trim();
      const avatarDataUrl = avatarDataUrlRaw.startsWith('data:image/') ? avatarDataUrlRaw : null;
      await db.query(
        `INSERT INTO org_ask_ryan_section_likes (org_id, section_key, user_id, user_name, avatar_data_url)
         VALUES (?, ?, ?, ?, ?)`,
        [orgId, ASK_RYAN_COMMUNITY_SECTION_KEY, userId, userName, avatarDataUrl],
      );
      likedByMe = true;
    }

    return res.json({
      status: 'success',
      data: { ...(await getCommunityLikeSummary(orgId, userId)), liked_by_me: likedByMe },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Unable to update community like.' });
  }
};

/** Admin: list questions */
const adminListQuestions = async (req, res) => {
  try {
    await ensureTables();
    if (!canManageAskRyan(req.user)) {
      return res.status(403).json({ status: 'error', message: 'Access denied.' });
    }
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing.' });
    }

    const status = String(req.query.status || 'all').toLowerCase();
    let where = 'q.org_id = ?';
    const params = [orgId];
    if (status === 'pending') {
      where += " AND q.status = 'pending'";
    } else if (status === 'answered') {
      where += " AND q.status = 'answered'";
    }

    const [rows] = await db.query(
      `SELECT q.*,
        (SELECT COUNT(*) FROM org_ask_ryan_likes l WHERE l.question_id = q.id AND l.org_id = q.org_id) AS likes_count,
        (SELECT COUNT(*) FROM org_ask_ryan_comments c WHERE c.question_id = q.id AND c.org_id = q.org_id) AS comments_count
       FROM org_ask_ryan_questions q
       WHERE ${where}
       ORDER BY q.status ASC, q.created_at DESC`,
      params,
    );

    return res.json({
      status: 'success',
      data: rows.map((r) => ({
        id: Number(r.id),
        user_id: Number(r.user_id),
        user_name: r.user_name || '',
        question_text: r.question_text || '',
        status: r.status,
        response_title: r.response_title || '',
        response_video_url: r.response_video_url || '',
        response_thumbnail_url: r.response_thumbnail_url || '',
        answered_at: r.answered_at,
        created_at: r.created_at,
        likes_count: Number(r.likes_count || 0),
        comments_count: Number(r.comments_count || 0),
      })),
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Unable to load questions.' });
  }
};

/** Admin: attach video answer (multipart) */
const adminAnswerQuestion = async (req, res) => {
  try {
    await ensureTables();
    if (!canManageAskRyan(req.user)) {
      return res.status(403).json({ status: 'error', message: 'Access denied.' });
    }
    const orgId = resolveOrgId(req.user);
    const questionId = Number(req.params.questionId);
    if (!orgId || Number.isNaN(questionId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid request.' });
    }

    const videoFile = req.files?.video?.[0];
    const thumbnailFile = req.files?.thumbnail?.[0];
    const responseTitle = String(req.body?.response_title || req.body?.responseTitle || '').trim().slice(0, 500);
    if (!responseTitle) {
      return res.status(400).json({ status: 'error', message: 'Response title is required (shown on the card).' });
    }

    const [qRows] = await db.query(
      `SELECT id, status, response_video_url, response_thumbnail_url
       FROM org_ask_ryan_questions WHERE id = ? AND org_id = ? LIMIT 1`,
      [questionId, orgId],
    );
    if (!qRows.length) {
      return res.status(404).json({ status: 'error', message: 'Question not found.' });
    }

    const existing = qRows[0] || {};
    let videoUrl = String(existing.response_video_url || '').trim();
    if (videoFile) {
      videoUrl = `${req.protocol}://${req.get('host')}/uploads/ask-ryan/${videoFile.filename}`;
    }
    let thumbnailUrl = String(existing.response_thumbnail_url || '').trim();
    if (thumbnailFile) {
      thumbnailUrl = `${req.protocol}://${req.get('host')}/uploads/ask-ryan/${thumbnailFile.filename}`;
    }

    await db.query(
      `UPDATE org_ask_ryan_questions SET
        status = 'answered',
        response_title = ?,
        response_video_url = ?,
        response_thumbnail_url = ?,
        answered_by = ?,
        answered_at = CURRENT_TIMESTAMP
       WHERE id = ? AND org_id = ?`,
      [responseTitle, videoUrl, thumbnailUrl || null, req.user?.id || null, questionId, orgId],
    );

    const [updated] = await db.query(
      `SELECT * FROM org_ask_ryan_questions WHERE id = ? AND org_id = ? LIMIT 1`,
      [questionId, orgId],
    );

    return res.json({
      status: 'success',
      data: updated[0] || null,
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Unable to save answer.' });
  }
};

module.exports = {
  submitQuestion,
  getPublished,
  toggleLike,
  getQuestionLikes,
  toggleCommentLike,
  addComment,
  getComments,
  getCommunityLike,
  toggleCommunityLike,
  adminListQuestions,
  adminAnswerQuestion,
};
