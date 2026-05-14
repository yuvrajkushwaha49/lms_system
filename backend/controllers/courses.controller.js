const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');
const db = require('../config/db');
const {
  ensureCourseVideoVariantsTable,
  processCourseVideoVariants,
  resolveLocalCourseUploadPath,
  VIDEO_VARIANTS,
} = require('../services/courseVideoVariants.service');

const resolveOrgId = (user) => user?.org_id || user?.business_id || null;

const ensureCoursesTableColumns = async () => {
  await db.query(
    "ALTER TABLE courses ADD COLUMN IF NOT EXISTS delivery_mode ENUM('Live','Recorded') DEFAULT 'Recorded'",
  );
  await db.query(
    'ALTER TABLE courses ADD COLUMN IF NOT EXISTS recorded_type VARCHAR(120) DEFAULT NULL',
  );
  await db.query(
    "ALTER TABLE courses ADD COLUMN IF NOT EXISTS pricing_type VARCHAR(80) DEFAULT 'Paid'",
  );
  await db.query(
    'ALTER TABLE courses ADD COLUMN IF NOT EXISTS free_for_members TINYINT(1) DEFAULT 0',
  );
  await db.query(
    "ALTER TABLE courses ADD COLUMN IF NOT EXISTS course_type VARCHAR(80) DEFAULT 'Chapter Wise Course'",
  );
};

const resolveCourseType = ({ courseType, deliveryMode, recordedType }) => {
  const explicit = String(courseType || '').trim();
  if (explicit) return explicit;
  const mode = String(deliveryMode || '').toLowerCase();
  const recType = String(recordedType || '').toLowerCase();
  if (mode === 'live') return 'Workshop';
  if (recType.includes('short')) return 'Short Course';
  return 'Chapter Wise Course';
};

const ensureCourseVideosTable = async () => {
  await db.query(
    `CREATE TABLE IF NOT EXISTS course_videos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      course_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      video_url VARCHAR(1024) NOT NULL,
      thumbnail_url VARCHAR(1024) DEFAULT NULL,
      assigned_trainer_id INT DEFAULT NULL,
      assigned_trainer_name VARCHAR(255) DEFAULT NULL,
      uploader_id INT DEFAULT NULL,
      uploader_role VARCHAR(50) DEFAULT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_course_videos_org_course (org_id, course_id),
      CONSTRAINT fk_course_videos_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  await db.query(
    'ALTER TABLE course_videos ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1',
  );
  await db.query(
    'ALTER TABLE course_videos ADD COLUMN IF NOT EXISTS lesson_id INT DEFAULT NULL',
  );
  await db.query(
    'ALTER TABLE course_videos ADD COLUMN IF NOT EXISTS lesson_title VARCHAR(255) DEFAULT NULL',
  );
  await db.query(
    'ALTER TABLE course_videos ADD COLUMN IF NOT EXISTS duration_seconds INT DEFAULT NULL',
  );
  await db.query(
    "ALTER TABLE course_videos ADD COLUMN IF NOT EXISTS content_type VARCHAR(40) DEFAULT 'video'",
  );
  await db.query(
    'ALTER TABLE course_videos ADD COLUMN IF NOT EXISTS short_description VARCHAR(300) DEFAULT NULL',
  );
  await db.query(
    "ALTER TABLE course_videos ADD COLUMN IF NOT EXISTS processing_status ENUM('ready','processing','failed') NOT NULL DEFAULT 'ready'",
  );
  await ensureCourseVideoVariantsTable();
};

const ensureCourseLessonsTable = async () => {
  await db.query(
    `CREATE TABLE IF NOT EXISTS course_lessons (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      course_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      lesson_order INT NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_course_lessons_org_course (org_id, course_id),
      CONSTRAINT fk_course_lessons_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
};

const ensureCourseVideoEngagementTables = async () => {
  await db.query(
    `CREATE TABLE IF NOT EXISTS course_video_likes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      course_id INT NOT NULL,
      video_id INT NOT NULL,
      user_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_course_video_like (org_id, course_id, video_id, user_id),
      INDEX idx_course_video_likes_video (org_id, course_id, video_id),
      CONSTRAINT fk_course_video_likes_video FOREIGN KEY (video_id) REFERENCES course_videos(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  await db.query(
    `CREATE TABLE IF NOT EXISTS course_video_comments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      course_id INT NOT NULL,
      video_id INT NOT NULL,
      user_id INT NOT NULL,
      user_name VARCHAR(255) DEFAULT NULL,
      comment_text TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_course_video_comments_video (org_id, course_id, video_id, created_at),
      CONSTRAINT fk_course_video_comments_video FOREIGN KEY (video_id) REFERENCES course_videos(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  await db.query(
    'ALTER TABLE course_video_comments ADD COLUMN IF NOT EXISTS is_blocked TINYINT(1) NOT NULL DEFAULT 0',
  );
  await db.query(
    'ALTER TABLE course_video_comments ADD COLUMN IF NOT EXISTS parent_comment_id INT DEFAULT NULL',
  );
  await db.query(
    `CREATE TABLE IF NOT EXISTS course_video_comment_reactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      course_id INT NOT NULL,
      video_id INT NOT NULL,
      comment_id INT NOT NULL,
      user_id INT NOT NULL,
      reaction ENUM('like', 'dislike') NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_comment_user_reaction (org_id, course_id, comment_id, user_id),
      INDEX idx_comment_reactions_comment (org_id, course_id, comment_id),
      CONSTRAINT fk_comment_reactions_video FOREIGN KEY (video_id) REFERENCES course_videos(id) ON DELETE CASCADE,
      CONSTRAINT fk_comment_reactions_comment FOREIGN KEY (comment_id) REFERENCES course_video_comments(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  await db.query(
    `CREATE TABLE IF NOT EXISTS course_video_comment_reports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      course_id INT NOT NULL,
      video_id INT NOT NULL,
      comment_id INT NOT NULL,
      reporter_user_id INT NOT NULL,
      reporter_name VARCHAR(255) DEFAULT NULL,
      reason VARCHAR(255) NOT NULL,
      status ENUM('pending', 'reviewed', 'resolved') NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_course_video_comment_report (org_id, course_id, video_id, comment_id, reporter_user_id),
      INDEX idx_course_video_comment_reports_org (org_id, created_at),
      CONSTRAINT fk_cv_comment_reports_video FOREIGN KEY (video_id) REFERENCES course_videos(id) ON DELETE CASCADE,
      CONSTRAINT fk_cv_comment_reports_comment FOREIGN KEY (comment_id) REFERENCES course_video_comments(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
};

const ensureCourseVideoProgressTable = async () => {
  await db.query(
    `CREATE TABLE IF NOT EXISTS course_video_progress (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      course_id INT NOT NULL,
      video_id INT NOT NULL,
      user_id INT NOT NULL,
      watch_time_seconds INT NOT NULL DEFAULT 0,
      status ENUM('in_progress', 'completed') NOT NULL DEFAULT 'in_progress',
      completed_at TIMESTAMP NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_course_video_progress (org_id, course_id, video_id, user_id),
      INDEX idx_course_video_progress_video (org_id, course_id, video_id),
      CONSTRAINT fk_course_video_progress_video FOREIGN KEY (video_id) REFERENCES course_videos(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
};

const ensureCourseBookmarksTable = async () => {
  await db.query(
    `CREATE TABLE IF NOT EXISTS course_bookmarks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      course_id INT NOT NULL,
      user_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_course_bookmark (org_id, course_id, user_id),
      INDEX idx_course_bookmarks_user (org_id, user_id),
      CONSTRAINT fk_course_bookmarks_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
};

const ensureCourseMediaBookmarksTable = async () => {
  await db.query(
    `CREATE TABLE IF NOT EXISTS course_media_bookmarks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      course_id INT NOT NULL,
      video_id INT NOT NULL,
      user_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_course_media_bookmark (org_id, course_id, video_id, user_id),
      INDEX idx_course_media_bookmarks_user (org_id, user_id),
      CONSTRAINT fk_course_media_bookmarks_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      CONSTRAINT fk_course_media_bookmarks_video FOREIGN KEY (video_id) REFERENCES course_videos(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
};

const validateVideoOwnership = async ({ orgId, courseId, videoId }) => {
  const [videoRows] = await db.query(
    'SELECT id FROM course_videos WHERE id = ? AND org_id = ? AND course_id = ? LIMIT 1',
    [videoId, orgId, courseId],
  );
  return videoRows.length > 0;
};

const canModerateCourseVideoComments = (user) => {
  const r = String(user?.role_name || '').toLowerCase();
  return ['ceo', 'admin', 'instructor', 'trainer'].includes(r);
};

const canModifyCourseVideoComment = (user, commentAuthorId) => {
  const uid = Number(user?.id);
  const aid = Number(commentAuthorId);
  return (!Number.isNaN(uid) && uid === aid) || canModerateCourseVideoComments(user);
};

const createCourse = async (req, res) => {
  try {
    await ensureCoursesTableColumns();
    const {
      title,
      description,
      price,
      delivery_mode: deliveryMode = 'Recorded',
      recorded_type: recordedType = null,
      pricing_type: pricingType = 'Paid',
      free_for_members: freeForMembers = false,
      course_type: courseType = '',
    } = req.body;
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }
    const normalizedDeliveryMode = String(deliveryMode || 'Recorded') === 'Live' ? 'Live' : 'Recorded';
    const normalizedPricingType = String(pricingType || 'Paid') || 'Paid';
    const normalizedRecordedType = normalizedDeliveryMode === 'Recorded' ? (recordedType || 'Chapter Wise/Topic Wise') : null;
    const resolvedCourseType = resolveCourseType({
      courseType,
      deliveryMode: normalizedDeliveryMode,
      recordedType: normalizedRecordedType,
    });
    const [insertResult] = await db.query(
      `INSERT INTO courses
       (org_id, instructor_id, title, description, price, delivery_mode, recorded_type, pricing_type, free_for_members, course_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orgId,
        req.user.id,
        title,
        description,
        price,
        normalizedDeliveryMode,
        normalizedRecordedType,
        normalizedPricingType,
        freeForMembers ? 1 : 0,
        resolvedCourseType,
      ],
    );
    const newCourseId = insertResult?.insertId;
    res.json({ status: 'success', data: { id: newCourseId } });
  } catch(e) { res.status(500).json({status: 'error'}); }
};
const mapCourseRow = (row) => {
  const {
    effective_delivery_mode: deliveryMode,
    effective_pricing_type: pricingType,
    effective_free_for_members: freeForMembers,
    effective_course_type: courseType,
    ...rest
  } = row;
  return {
    ...rest,
    delivery_mode: deliveryMode,
    pricing_type: pricingType,
    free_for_members: freeForMembers,
    course_type: courseType,
  };
};

/** Used by monthly challenge schedule; same rows as GET /api/courses without request context. */
const fetchOrgCoursesForOrg = async (orgId, { courseTypeFilter = '' } = {}) => {
  await ensureCoursesTableColumns();
  const params = [orgId];
  let typeClause = '';
  const cf = String(courseTypeFilter || '').trim();
  if (cf) {
    typeClause = ' AND LOWER(TRIM(COALESCE(courses.course_type, \'\'))) = LOWER(?)';
    params.push(cf);
  }
  const [rows] = await db.query(
    `SELECT courses.*,
            COALESCE(courses.delivery_mode, 'Recorded') AS effective_delivery_mode,
            COALESCE(courses.pricing_type, CASE WHEN courses.price = 0 THEN 'Free for Members' ELSE 'Paid' END) AS effective_pricing_type,
            COALESCE(courses.free_for_members, CASE WHEN courses.price = 0 THEN 1 ELSE 0 END) AS effective_free_for_members,
            COALESCE(courses.course_type,
              CASE
                WHEN LOWER(COALESCE(courses.delivery_mode, 'Recorded')) = 'live' THEN 'Workshop'
                WHEN LOWER(COALESCE(courses.recorded_type, '')) LIKE '%short%' THEN 'Short Course'
                ELSE 'Chapter Wise Course'
              END
            ) AS effective_course_type
     FROM courses
     WHERE courses.org_id = ?${typeClause}`,
    params,
  );
  return rows.map(mapCourseRow);
};

const getCourses = async (req, res) => {
  try {
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }
    const courseTypeFilter = String(req.query.course_type || req.query.courseType || '').trim();
    const courses = await fetchOrgCoursesForOrg(orgId, { courseTypeFilter });
    res.json({ status: 'success', data: courses });
  } catch (e) {
    res.status(500).json({ status: 'error' });
  }
};

const updateCourse = async (req, res) => {
  try {
    await ensureCoursesTableColumns();
    const courseId = Number(req.params.courseId);
    if (Number.isNaN(courseId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid course id.' });
    }
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }
    const {
      title,
      description,
      price,
      delivery_mode: deliveryMode = 'Recorded',
      recorded_type: recordedType = null,
      pricing_type: pricingType = 'Paid',
      free_for_members: freeForMembers = false,
      course_type: courseType = '',
    } = req.body || {};
    if (!String(title || '').trim()) {
      return res.status(400).json({ status: 'error', message: 'Course title is required.' });
    }
    const numericPrice = Number(price);
    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      return res.status(400).json({ status: 'error', message: 'Invalid price.' });
    }
    const normalizedDeliveryMode = String(deliveryMode || 'Recorded') === 'Live' ? 'Live' : 'Recorded';
    const normalizedRecordedType = normalizedDeliveryMode === 'Recorded' ? (recordedType || 'Chapter Wise/Topic Wise') : null;
    const normalizedPricingType = String(pricingType || 'Paid') || 'Paid';

    const resolvedCourseType = resolveCourseType({
      courseType,
      deliveryMode: normalizedDeliveryMode,
      recordedType: normalizedRecordedType,
    });

    const [result] = await db.query(
      `UPDATE courses
       SET title = ?, description = ?, price = ?, delivery_mode = ?, recorded_type = ?, pricing_type = ?, free_for_members = ?, course_type = ?
       WHERE id = ? AND org_id = ?`,
      [
        String(title).trim(),
        description || null,
        numericPrice,
        normalizedDeliveryMode,
        normalizedRecordedType,
        normalizedPricingType,
        freeForMembers ? 1 : 0,
        resolvedCourseType,
        courseId,
        orgId,
      ],
    );
    if (!result.affectedRows) {
      return res.status(404).json({ status: 'error', message: 'Course not found.' });
    }
    return res.json({ status: 'success' });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to update course.' });
  }
};

const deleteCourse = async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    if (Number.isNaN(courseId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid course id.' });
    }
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }
    const [result] = await db.query(
      'DELETE FROM courses WHERE id = ? AND org_id = ?',
      [courseId, orgId],
    );
    if (!result.affectedRows) {
      return res.status(404).json({ status: 'error', message: 'Course not found.' });
    }
    return res.json({ status: 'success' });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to delete course.' });
  }
};

const getCourseBookmarks = async (req, res) => {
  try {
    await ensureCourseBookmarksTable();
    const userId = Number(req.user?.id);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid user id.' });
    }
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }
    const [rows] = await db.query(
      'SELECT course_id FROM course_bookmarks WHERE org_id = ? AND user_id = ? ORDER BY created_at DESC',
      [orgId, userId],
    );
    const courseIds = rows.map((row) => Number(row.course_id)).filter((id) => !Number.isNaN(id));
    return res.json({ status: 'success', data: { course_ids: courseIds } });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to fetch bookmarks.' });
  }
};

const toggleCourseBookmark = async (req, res) => {
  try {
    await ensureCourseBookmarksTable();
    const userId = Number(req.user?.id);
    const courseId = Number(req.params.courseId);
    if (Number.isNaN(userId) || Number.isNaN(courseId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid id.' });
    }
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }

    const [courseRows] = await db.query(
      'SELECT id FROM courses WHERE id = ? AND org_id = ? LIMIT 1',
      [courseId, orgId],
    );
    if (!courseRows.length) {
      return res.status(404).json({ status: 'error', message: 'Course not found.' });
    }

    const [existingRows] = await db.query(
      'SELECT id FROM course_bookmarks WHERE org_id = ? AND course_id = ? AND user_id = ? LIMIT 1',
      [orgId, courseId, userId],
    );
    let bookmarked = false;
    if (existingRows.length) {
      await db.query('DELETE FROM course_bookmarks WHERE id = ? LIMIT 1', [existingRows[0].id]);
      bookmarked = false;
    } else {
      await db.query(
        'INSERT INTO course_bookmarks (org_id, course_id, user_id) VALUES (?, ?, ?)',
        [orgId, courseId, userId],
      );
      bookmarked = true;
    }
    return res.json({ status: 'success', data: { course_id: courseId, bookmarked } });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to update bookmark.' });
  }
};

const getCourseMediaBookmarks = async (req, res) => {
  try {
    await ensureCourseVideosTable();
    await ensureCourseMediaBookmarksTable();
    const userId = Number(req.user?.id);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid user id.' });
    }
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }
    const [rows] = await db.query(
      `SELECT b.course_id, b.video_id, v.title, v.description, v.short_description, v.content_type,
              v.video_url, v.thumbnail_url, v.lesson_id, v.lesson_title
       FROM course_media_bookmarks b
       INNER JOIN course_videos v
         ON v.id = b.video_id AND v.org_id = b.org_id AND v.course_id = b.course_id
       WHERE b.org_id = ? AND b.user_id = ?
       ORDER BY b.created_at DESC`,
      [orgId, userId],
    );
    return res.json({ status: 'success', data: rows || [] });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to fetch media bookmarks.' });
  }
};

const toggleCourseMediaBookmark = async (req, res) => {
  try {
    await ensureCourseVideosTable();
    await ensureCourseMediaBookmarksTable();
    const userId = Number(req.user?.id);
    const courseId = Number(req.params.courseId);
    const videoId = Number(req.params.videoId);
    if (Number.isNaN(userId) || Number.isNaN(courseId) || Number.isNaN(videoId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid id.' });
    }
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }
    const isValidVideo = await validateVideoOwnership({ orgId, courseId, videoId });
    if (!isValidVideo) {
      return res.status(404).json({ status: 'error', message: 'Media file not found.' });
    }
    const [existingRows] = await db.query(
      'SELECT id FROM course_media_bookmarks WHERE org_id = ? AND course_id = ? AND video_id = ? AND user_id = ? LIMIT 1',
      [orgId, courseId, videoId, userId],
    );
    let bookmarked = false;
    if (existingRows.length) {
      await db.query('DELETE FROM course_media_bookmarks WHERE id = ? LIMIT 1', [existingRows[0].id]);
      bookmarked = false;
    } else {
      await db.query(
        'INSERT INTO course_media_bookmarks (org_id, course_id, video_id, user_id) VALUES (?, ?, ?, ?)',
        [orgId, courseId, videoId, userId],
      );
      bookmarked = true;
    }
    return res.json({
      status: 'success',
      data: { course_id: courseId, video_id: videoId, bookmarked },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to update media bookmark.' });
  }
};

const createCourseVideo = async (req, res) => {
  try {
    await ensureCourseVideosTable();
    await ensureCourseLessonsTable();
    const courseId = Number(req.params.courseId);
    if (Number.isNaN(courseId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid course id.' });
    }

    const {
      title,
      short_description: shortDescription,
      description,
      video_url: videoUrl,
      thumbnail_url: thumbnailUrl,
      content_type: contentType,
      assigned_trainer_id: assignedTrainerId,
      assigned_trainer_name: assignedTrainerName,
      lesson_id: lessonId,
      lesson_title: lessonTitle,
      duration_seconds: durationSeconds,
    } = req.body;

    if (!title || !videoUrl) {
      return res.status(400).json({ status: 'error', message: 'title and video_url are required.' });
    }
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }

    let resolvedLessonTitle = lessonTitle || null;
    let resolvedLessonId = lessonId || null;
    if (lessonId) {
      const [lessonRows] = await db.query(
        'SELECT id, title FROM course_lessons WHERE id = ? AND org_id = ? AND course_id = ? LIMIT 1',
        [lessonId, orgId, courseId],
      );
      if (!lessonRows.length) {
        return res.status(400).json({ status: 'error', message: 'Selected lesson does not exist.' });
      }
      resolvedLessonId = lessonRows[0].id;
      resolvedLessonTitle = lessonRows[0].title;
    }

    const ct = String(contentType || 'video').toLowerCase();
    const [insertResult] = await db.query(
      `INSERT INTO course_videos
      (org_id, course_id, title, short_description, description, video_url, thumbnail_url, content_type, assigned_trainer_id, assigned_trainer_name, lesson_id, lesson_title, duration_seconds, uploader_id, uploader_role, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orgId,
        courseId,
        title,
        shortDescription || null,
        description || null,
        videoUrl,
        thumbnailUrl || null,
        ct,
        assignedTrainerId || null,
        assignedTrainerName || null,
        resolvedLessonId,
        resolvedLessonTitle,
        durationSeconds || null,
        req.user.id || null,
        req.user.role_name || null,
        1,
      ],
    );
    const newVideoId = insertResult.insertId;

    const localPath = resolveLocalCourseUploadPath(videoUrl);
    const isLocalVideoFile =
      localPath &&
      fsSync.existsSync(localPath) &&
      ct === 'video' &&
      !/\.m3u8(\?|$)/i.test(String(videoUrl));

    if (isLocalVideoFile && newVideoId) {
      await ensureCourseVideoVariantsTable();
      await db.query('UPDATE course_videos SET processing_status = ? WHERE id = ? AND org_id = ?', [
        'processing',
        newVideoId,
        orgId,
      ]);
      const variantRows = VIDEO_VARIANTS.map((variant) => [orgId, courseId, newVideoId, variant.resolution, 'pending']);
      await db.query(
        `INSERT INTO course_video_variants (org_id, course_id, video_id, resolution, status) VALUES ?`,
        [variantRows],
      );
      const resolveMediaUrl = (relativeKey) =>
        `${req.protocol}://${req.get('host')}/uploads/course-media/${String(relativeKey).replace(/\\/g, '/')}`;
      processCourseVideoVariants({
        resolveMediaUrl,
        orgId,
        courseId,
        videoId: newVideoId,
        inputPath: localPath,
      }).catch((error) => {
        console.error('course video variant processing error:', error);
      });
    }

    res.json({ status: 'success' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message || 'Failed to save video.' });
  }
};

const uploadCourseMedia = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: 'error', message: 'File is required.' });
    }
    const mediaUrl = `${req.protocol}://${req.get('host')}/uploads/course-media/${req.file.filename}`;
    return res.json({
      status: 'success',
      data: {
        url: mediaUrl,
        filename: req.file.filename,
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to upload media.' });
  }
};

const attachCourseVideoVariants = async (orgId, courseId, videos) => {
  const ids = videos.map((v) => v.id).filter((id) => id != null);
  if (!ids.length) return videos;
  await ensureCourseVideoVariantsTable();
  const placeholders = ids.map(() => '?').join(', ');
  const [rows] = await db.query(
    `SELECT id, video_id, resolution, media_url, status, error_message
     FROM course_video_variants
     WHERE org_id = ? AND course_id = ? AND video_id IN (${placeholders})
     ORDER BY FIELD(resolution, '360p', '720p', '1080p'), id ASC`,
    [orgId, courseId, ...ids],
  );
  return videos.map((video) => ({
    ...video,
    video_variants: rows
      .filter((r) => Number(r.video_id) === Number(video.id))
      .map((r) => ({
        id: r.id,
        resolution: r.resolution,
        media_url: r.media_url,
        status: r.status,
        error_message: r.error_message,
      })),
  }));
};

const getCourseVideos = async (req, res) => {
  try {
    await ensureCourseVideosTable();
    await ensureCourseLessonsTable();
    const courseId = Number(req.params.courseId);
    if (Number.isNaN(courseId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid course id.' });
    }

    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }

    const requesterRole = String(req.user?.role_name || '').toLowerCase();
    const canViewAll = requesterRole === 'admin' || requesterRole === 'ceo';
    const activeFilter = canViewAll ? '' : ' AND is_active = 1';
    const [videos] = await db.query(
      `SELECT id, course_id, title, short_description, description, video_url, thumbnail_url, content_type, assigned_trainer_id, assigned_trainer_name, lesson_id, lesson_title, duration_seconds, uploader_role, is_active, created_at,
              COALESCE(processing_status, 'ready') AS processing_status
       FROM course_videos
       WHERE org_id = ? AND course_id = ?${activeFilter}
       ORDER BY COALESCE(lesson_id, 999999), created_at DESC`,
      [orgId, courseId],
    );
    const withVariants = await attachCourseVideoVariants(orgId, courseId, videos);
    res.json({ status: 'success', data: withVariants });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message || 'Failed to fetch videos.' });
  }
};

const updateCourseVideo = async (req, res) => {
  try {
    await ensureCourseVideosTable();
    await ensureCourseLessonsTable();
    const courseId = Number(req.params.courseId);
    const videoId = Number(req.params.videoId);
    if (Number.isNaN(courseId) || Number.isNaN(videoId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid id.' });
    }
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }

    const {
      title,
      short_description: shortDescription,
      description,
      assigned_trainer_id: assignedTrainerId,
      assigned_trainer_name: assignedTrainerName,
      lesson_id: lessonId,
      lesson_title: lessonTitle,
      duration_seconds: durationSeconds,
      content_type: contentType,
    } = req.body;
    if (!title) {
      return res.status(400).json({ status: 'error', message: 'title is required.' });
    }

    let resolvedLessonTitle = lessonTitle || null;
    let resolvedLessonId = lessonId || null;
    if (lessonId) {
      const [lessonRows] = await db.query(
        'SELECT id, title FROM course_lessons WHERE id = ? AND org_id = ? AND course_id = ? LIMIT 1',
        [lessonId, orgId, courseId],
      );
      if (!lessonRows.length) {
        return res.status(400).json({ status: 'error', message: 'Selected lesson does not exist.' });
      }
      resolvedLessonId = lessonRows[0].id;
      resolvedLessonTitle = lessonRows[0].title;
    }

    const [result] = await db.query(
      `UPDATE course_videos
       SET title = ?, short_description = ?, description = ?, assigned_trainer_id = ?, assigned_trainer_name = ?, lesson_id = ?, lesson_title = ?, duration_seconds = COALESCE(?, duration_seconds), content_type = COALESCE(?, content_type)
       WHERE id = ? AND org_id = ? AND course_id = ?`,
      [
        title,
        shortDescription || null,
        description || null,
        assignedTrainerId || null,
        assignedTrainerName || null,
        resolvedLessonId,
        resolvedLessonTitle,
        durationSeconds || null,
        contentType || null,
        videoId,
        orgId,
        courseId,
      ],
    );
    if (!result.affectedRows) {
      return res.status(404).json({ status: 'error', message: 'Video not found.' });
    }
    return res.json({ status: 'success' });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to update video.' });
  }
};

const createCourseLesson = async (req, res) => {
  try {
    await ensureCourseLessonsTable();
    const courseId = Number(req.params.courseId);
    const orgId = resolveOrgId(req.user);
    if (Number.isNaN(courseId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid course id.' });
    }
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }
    const title = String(req.body?.title || '').trim();
    const lessonOrder = Number(req.body?.lesson_order || 0);
    if (!title) {
      return res.status(400).json({ status: 'error', message: 'Lesson title is required.' });
    }
    const [existing] = await db.query(
      'SELECT id FROM course_lessons WHERE org_id = ? AND course_id = ? AND LOWER(title) = LOWER(?) LIMIT 1',
      [orgId, courseId, title],
    );
    if (existing.length) {
      return res.status(409).json({ status: 'error', message: 'Lesson with same title already exists.' });
    }
    const [maxOrderRows] = await db.query(
      'SELECT COALESCE(MAX(lesson_order), 0) AS maxOrder FROM course_lessons WHERE org_id = ? AND course_id = ?',
      [orgId, courseId],
    );
    const nextOrder = lessonOrder > 0 ? lessonOrder : Number(maxOrderRows[0]?.maxOrder || 0) + 1;
    const [insertResult] = await db.query(
      'INSERT INTO course_lessons (org_id, course_id, title, lesson_order) VALUES (?, ?, ?, ?)',
      [orgId, courseId, title, nextOrder],
    );
    return res.json({
      status: 'success',
      data: { id: insertResult.insertId, title, lesson_order: nextOrder },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to create lesson.' });
  }
};

const getCourseLessons = async (req, res) => {
  try {
    await ensureCourseLessonsTable();
    const courseId = Number(req.params.courseId);
    const orgId = resolveOrgId(req.user);
    if (Number.isNaN(courseId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid course id.' });
    }
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }
    const [rows] = await db.query(
      'SELECT id, course_id, title, lesson_order, created_at FROM course_lessons WHERE org_id = ? AND course_id = ? ORDER BY lesson_order ASC, created_at ASC',
      [orgId, courseId],
    );
    return res.json({ status: 'success', data: rows });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to fetch lessons.' });
  }
};

const deleteCourseVideo = async (req, res) => {
  try {
    await ensureCourseVideosTable();
    const courseId = Number(req.params.courseId);
    const videoId = Number(req.params.videoId);
    if (Number.isNaN(courseId) || Number.isNaN(videoId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid id.' });
    }
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }
    const [result] = await db.query(
      'DELETE FROM course_videos WHERE id = ? AND org_id = ? AND course_id = ?',
      [videoId, orgId, courseId],
    );
    if (!result.affectedRows) {
      return res.status(404).json({ status: 'error', message: 'Video not found.' });
    }
    return res.json({ status: 'success' });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to delete video.' });
  }
};

const toggleCourseVideoStatus = async (req, res) => {
  try {
    await ensureCourseVideosTable();
    const courseId = Number(req.params.courseId);
    const videoId = Number(req.params.videoId);
    if (Number.isNaN(courseId) || Number.isNaN(videoId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid id.' });
    }
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }

    const [rows] = await db.query(
      'SELECT is_active FROM course_videos WHERE id = ? AND org_id = ? AND course_id = ? LIMIT 1',
      [videoId, orgId, courseId],
    );
    if (!rows.length) {
      return res.status(404).json({ status: 'error', message: 'Video not found.' });
    }
    const nextActive = rows[0].is_active ? 0 : 1;
    await db.query(
      'UPDATE course_videos SET is_active = ? WHERE id = ? AND org_id = ? AND course_id = ?',
      [nextActive, videoId, orgId, courseId],
    );
    return res.json({ status: 'success', data: { is_active: nextActive } });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to toggle video status.' });
  }
};

const toggleCourseVideoLike = async (req, res) => {
  try {
    await ensureCourseVideosTable();
    await ensureCourseVideoEngagementTables();
    const courseId = Number(req.params.courseId);
    const videoId = Number(req.params.videoId);
    const userId = Number(req.user?.id);
    if (Number.isNaN(courseId) || Number.isNaN(videoId) || Number.isNaN(userId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid id.' });
    }
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }

    const isValidVideo = await validateVideoOwnership({ orgId, courseId, videoId });
    if (!isValidVideo) {
      return res.status(404).json({ status: 'error', message: 'Video not found.' });
    }

    const [existing] = await db.query(
      'SELECT id FROM course_video_likes WHERE org_id = ? AND course_id = ? AND video_id = ? AND user_id = ? LIMIT 1',
      [orgId, courseId, videoId, userId],
    );
    let liked = false;
    if (existing.length) {
      await db.query(
        'DELETE FROM course_video_likes WHERE org_id = ? AND course_id = ? AND video_id = ? AND user_id = ?',
        [orgId, courseId, videoId, userId],
      );
      liked = false;
    } else {
      await db.query(
        'INSERT INTO course_video_likes (org_id, course_id, video_id, user_id) VALUES (?, ?, ?, ?)',
        [orgId, courseId, videoId, userId],
      );
      liked = true;
    }

    const [countRows] = await db.query(
      'SELECT COUNT(*) AS likeCount FROM course_video_likes WHERE org_id = ? AND course_id = ? AND video_id = ?',
      [orgId, courseId, videoId],
    );
    return res.json({
      status: 'success',
      data: {
        video_id: videoId,
        liked,
        like_count: Number(countRows[0]?.likeCount || 0),
      },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to toggle like.' });
  }
};

const createCourseVideoComment = async (req, res) => {
  try {
    await ensureCourseVideosTable();
    await ensureCourseVideoEngagementTables();
    const courseId = Number(req.params.courseId);
    const videoId = Number(req.params.videoId);
    const userId = Number(req.user?.id);
    if (Number.isNaN(courseId) || Number.isNaN(videoId) || Number.isNaN(userId)) {
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

    const isValidVideo = await validateVideoOwnership({ orgId, courseId, videoId });
    if (!isValidVideo) {
      return res.status(404).json({ status: 'error', message: 'Video not found.' });
    }

    let parentCommentId = null;
    if (req.body?.parent_comment_id != null && req.body.parent_comment_id !== '') {
      const rawParent = Number(req.body.parent_comment_id);
      if (!Number.isNaN(rawParent)) {
        const [parentRows] = await db.query(
          `SELECT id, parent_comment_id FROM course_video_comments
           WHERE id = ? AND org_id = ? AND course_id = ? AND video_id = ? LIMIT 1`,
          [rawParent, orgId, courseId, videoId],
        );
        if (!parentRows.length) {
          return res.status(400).json({ status: 'error', message: 'Parent comment not found.' });
        }
        if (parentRows[0].parent_comment_id != null) {
          return res.status(400).json({ status: 'error', message: 'You can only reply to top-level comments.' });
        }
        parentCommentId = rawParent;
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
      'INSERT INTO course_video_comments (org_id, course_id, video_id, user_id, user_name, comment_text, parent_comment_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [orgId, courseId, videoId, userId, userName, commentText, parentCommentId],
    );

    const [rows] = await db.query(
      'SELECT id, video_id, user_id, user_name, comment_text, created_at, parent_comment_id FROM course_video_comments WHERE id = ? LIMIT 1',
      [insertResult.insertId],
    );
    return res.json({ status: 'success', data: rows[0] || null });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to add comment.' });
  }
};

const updateCourseVideoComment = async (req, res) => {
  try {
    await ensureCourseVideosTable();
    await ensureCourseVideoEngagementTables();
    const courseId = Number(req.params.courseId);
    const videoId = Number(req.params.videoId);
    const commentId = Number(req.params.commentId);
    const userId = Number(req.user?.id);
    if (Number.isNaN(courseId) || Number.isNaN(videoId) || Number.isNaN(commentId) || Number.isNaN(userId)) {
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

    const isValidVideo = await validateVideoOwnership({ orgId, courseId, videoId });
    if (!isValidVideo) {
      return res.status(404).json({ status: 'error', message: 'Video not found.' });
    }

    const [commentRows] = await db.query(
      `SELECT user_id, is_blocked FROM course_video_comments WHERE id = ? AND org_id = ? AND course_id = ? AND video_id = ? LIMIT 1`,
      [commentId, orgId, courseId, videoId],
    );
    if (!commentRows.length) {
      return res.status(404).json({ status: 'error', message: 'Comment not found.' });
    }
    if (Number(commentRows[0].is_blocked) === 1 && !canModerateCourseVideoComments(req.user)) {
      return res.status(403).json({ status: 'error', message: 'Comment is blocked.' });
    }
    if (!canModifyCourseVideoComment(req.user, commentRows[0].user_id)) {
      return res.status(403).json({ status: 'error', message: 'You cannot edit this comment.' });
    }

    await db.query(
      `UPDATE course_video_comments SET comment_text = ? WHERE id = ? AND org_id = ? AND course_id = ? AND video_id = ?`,
      [commentText, commentId, orgId, courseId, videoId],
    );

    return res.json({
      status: 'success',
      data: { id: commentId, comment_text: commentText },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to update comment.' });
  }
};

const toggleCourseVideoCommentReaction = async (req, res) => {
  try {
    await ensureCourseVideosTable();
    await ensureCourseVideoEngagementTables();
    const courseId = Number(req.params.courseId);
    const videoId = Number(req.params.videoId);
    const commentId = Number(req.params.commentId);
    const userId = Number(req.user?.id);
    if (Number.isNaN(courseId) || Number.isNaN(videoId) || Number.isNaN(commentId) || Number.isNaN(userId)) {
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

    const isValidVideo = await validateVideoOwnership({ orgId, courseId, videoId });
    if (!isValidVideo) {
      return res.status(404).json({ status: 'error', message: 'Video not found.' });
    }

    const [commentRows] = await db.query(
      'SELECT id FROM course_video_comments WHERE id = ? AND org_id = ? AND course_id = ? AND video_id = ? LIMIT 1',
      [commentId, orgId, courseId, videoId],
    );
    if (!commentRows.length) {
      return res.status(404).json({ status: 'error', message: 'Comment not found.' });
    }

    const [existingRows] = await db.query(
      'SELECT id, reaction FROM course_video_comment_reactions WHERE org_id = ? AND course_id = ? AND comment_id = ? AND user_id = ? LIMIT 1',
      [orgId, courseId, commentId, userId],
    );

    let myReaction = reaction;
    if (existingRows.length && String(existingRows[0].reaction) === reaction) {
      await db.query(
        'DELETE FROM course_video_comment_reactions WHERE id = ? LIMIT 1',
        [existingRows[0].id],
      );
      myReaction = null;
    } else if (existingRows.length) {
      await db.query(
        'UPDATE course_video_comment_reactions SET reaction = ? WHERE id = ?',
        [reaction, existingRows[0].id],
      );
    } else {
      await db.query(
        `INSERT INTO course_video_comment_reactions
         (org_id, course_id, video_id, comment_id, user_id, reaction)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orgId, courseId, videoId, commentId, userId, reaction],
      );
    }

    const [countsRows] = await db.query(
      `SELECT
         SUM(CASE WHEN reaction = 'like' THEN 1 ELSE 0 END) AS likes_count,
         SUM(CASE WHEN reaction = 'dislike' THEN 1 ELSE 0 END) AS dislikes_count
       FROM course_video_comment_reactions
       WHERE org_id = ? AND course_id = ? AND comment_id = ?`,
      [orgId, courseId, commentId],
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

const deleteCourseVideoComment = async (req, res) => {
  try {
    await ensureCourseVideosTable();
    await ensureCourseVideoEngagementTables();
    const courseId = Number(req.params.courseId);
    const videoId = Number(req.params.videoId);
    const commentId = Number(req.params.commentId);
    if (Number.isNaN(courseId) || Number.isNaN(videoId) || Number.isNaN(commentId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid id.' });
    }
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }
    const isValidVideo = await validateVideoOwnership({ orgId, courseId, videoId });
    if (!isValidVideo) {
      return res.status(404).json({ status: 'error', message: 'Video not found.' });
    }

    const [metaRows] = await db.query(
      `SELECT user_id, is_blocked FROM course_video_comments WHERE id = ? AND org_id = ? AND course_id = ? AND video_id = ? LIMIT 1`,
      [commentId, orgId, courseId, videoId],
    );
    if (!metaRows.length) {
      return res.status(404).json({ status: 'error', message: 'Comment not found.' });
    }
    if (Number(metaRows[0].is_blocked) === 1 && !canModerateCourseVideoComments(req.user)) {
      return res.status(403).json({ status: 'error', message: 'Comment is blocked.' });
    }
    if (!canModifyCourseVideoComment(req.user, metaRows[0].user_id)) {
      return res.status(403).json({ status: 'error', message: 'You cannot delete this comment.' });
    }

    await db.query(
      `DELETE FROM course_video_comments WHERE parent_comment_id = ? AND org_id = ? AND course_id = ? AND video_id = ?`,
      [commentId, orgId, courseId, videoId],
    );

    const [result] = await db.query(
      'DELETE FROM course_video_comments WHERE id = ? AND org_id = ? AND course_id = ? AND video_id = ?',
      [commentId, orgId, courseId, videoId],
    );
    if (!result.affectedRows) {
      return res.status(404).json({ status: 'error', message: 'Comment not found.' });
    }
    return res.json({ status: 'success' });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to delete comment.' });
  }
};

const toggleCourseVideoCommentBlock = async (req, res) => {
  try {
    await ensureCourseVideosTable();
    await ensureCourseVideoEngagementTables();
    const courseId = Number(req.params.courseId);
    const videoId = Number(req.params.videoId);
    const commentId = Number(req.params.commentId);
    if (Number.isNaN(courseId) || Number.isNaN(videoId) || Number.isNaN(commentId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid id.' });
    }
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }
    const [rows] = await db.query(
      'SELECT is_blocked FROM course_video_comments WHERE id = ? AND org_id = ? AND course_id = ? AND video_id = ? LIMIT 1',
      [commentId, orgId, courseId, videoId],
    );
    if (!rows.length) {
      return res.status(404).json({ status: 'error', message: 'Comment not found.' });
    }
    const nextBlocked = Number(rows[0].is_blocked) === 1 ? 0 : 1;
    await db.query(
      'UPDATE course_video_comments SET is_blocked = ? WHERE id = ? AND org_id = ? AND course_id = ? AND video_id = ?',
      [nextBlocked, commentId, orgId, courseId, videoId],
    );
    return res.json({ status: 'success', data: { comment_id: commentId, is_blocked: nextBlocked } });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to update comment block status.' });
  }
};

const getCourseVideoEngagement = async (req, res) => {
  try {
    await ensureCourseVideosTable();
    await ensureCourseVideoEngagementTables();
    await ensureCourseVideoProgressTable();
    const courseId = Number(req.params.courseId);
    const userId = Number(req.user?.id);
    if (Number.isNaN(courseId) || Number.isNaN(userId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid id.' });
    }
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }

    const [videos] = await db.query(
      'SELECT id FROM course_videos WHERE org_id = ? AND course_id = ?',
      [orgId, courseId],
    );
    const videoIds = videos.map((entry) => Number(entry.id)).filter((id) => !Number.isNaN(id));
    if (videoIds.length === 0) {
      return res.json({ status: 'success', data: { likes: {}, comments: {} } });
    }

    const [likeRows] = await db.query(
      `SELECT video_id, COUNT(*) AS like_count,
              SUM(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS liked_by_me
       FROM course_video_likes
       WHERE org_id = ? AND course_id = ? AND video_id IN (?)
       GROUP BY video_id`,
      [userId, orgId, courseId, videoIds],
    );
    const [commentRows] = await db.query(
      `SELECT c.id, c.video_id, c.user_id, COALESCE(NULLIF(c.user_name, ''), u.name) AS user_name, c.comment_text, c.is_blocked, c.created_at, c.parent_comment_id
       FROM course_video_comments c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.org_id = ? AND c.course_id = ? AND c.video_id IN (?)
       ORDER BY c.video_id ASC, c.id ASC`,
      [orgId, courseId, videoIds],
    );
    const [reactionRows] = await db.query(
      `SELECT comment_id,
              SUM(CASE WHEN reaction = 'like' THEN 1 ELSE 0 END) AS likes_count,
              SUM(CASE WHEN reaction = 'dislike' THEN 1 ELSE 0 END) AS dislikes_count,
              MAX(CASE WHEN user_id = ? THEN reaction ELSE NULL END) AS my_reaction
       FROM course_video_comment_reactions
       WHERE org_id = ? AND course_id = ? AND video_id IN (?)
       GROUP BY comment_id`,
      [userId, orgId, courseId, videoIds],
    );
    const [progressRows] = await db.query(
      `SELECT video_id, watch_time_seconds, status, updated_at
       FROM course_video_progress
       WHERE org_id = ? AND course_id = ? AND user_id = ? AND video_id IN (?)`,
      [orgId, courseId, userId, videoIds],
    );
    const [viewRows] = await db.query(
      `SELECT video_id, COUNT(DISTINCT user_id) AS view_count
       FROM course_video_progress
       WHERE org_id = ? AND course_id = ? AND video_id IN (?) AND watch_time_seconds > 0
       GROUP BY video_id`,
      [orgId, courseId, videoIds],
    );

    const likes = {};
    videoIds.forEach((id) => {
      likes[String(id)] = { count: 0, liked: false };
    });
    likeRows.forEach((row) => {
      likes[String(row.video_id)] = {
        count: Number(row.like_count || 0),
        liked: Number(row.liked_by_me || 0) > 0,
      };
    });

    const comments = {};
    const reactionMap = {};
    reactionRows.forEach((row) => {
      reactionMap[String(row.comment_id)] = {
        likes_count: Number(row.likes_count || 0),
        dislikes_count: Number(row.dislikes_count || 0),
        my_reaction: row.my_reaction || null,
      };
    });
    const buildCommentNode = (row) => {
      const commentReaction = reactionMap[String(row.id)] || {
        likes_count: 0,
        dislikes_count: 0,
        my_reaction: null,
      };
      return {
        id: row.id,
        video_id: row.video_id,
        user_id: row.user_id,
        user_name: row.user_name,
        text: row.comment_text,
        is_blocked: Number(row.is_blocked || 0) === 1,
        createdAt: row.created_at,
        parent_comment_id: row.parent_comment_id != null ? Number(row.parent_comment_id) : null,
        likesCount: commentReaction.likes_count,
        dislikesCount: commentReaction.dislikes_count,
        myReaction: commentReaction.my_reaction,
        replies: [],
      };
    };

    videoIds.forEach((id) => {
      comments[String(id)] = [];
    });

    const rowsByVideo = {};
    commentRows.forEach((row) => {
      const key = String(row.video_id);
      if (!rowsByVideo[key]) rowsByVideo[key] = [];
      rowsByVideo[key].push(row);
    });

    Object.keys(rowsByVideo).forEach((vid) => {
      const rows = rowsByVideo[vid];
      const byId = new Map();
      rows.forEach((row) => {
        byId.set(Number(row.id), buildCommentNode(row));
      });
      const roots = [];
      rows.forEach((row) => {
        const node = byId.get(Number(row.id));
        const pid = row.parent_comment_id != null ? Number(row.parent_comment_id) : null;
        if (pid && byId.has(pid)) {
          byId.get(pid).replies.push(node);
        } else {
          roots.push(node);
        }
      });
      roots.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      roots.forEach((r) => {
        r.replies.sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      });
      comments[vid] = roots;
    });

    const progress = {};
    const progressMeta = {};
    videoIds.forEach((id) => {
      progress[String(id)] = false;
      progressMeta[String(id)] = {
        watch_time_seconds: 0,
        status: 'in_progress',
        updated_at: null,
      };
    });
    let lastWatched = null;
    progressRows.forEach((row) => {
      progress[String(row.video_id)] = String(row.status) === 'completed';
      progressMeta[String(row.video_id)] = {
        watch_time_seconds: Number(row.watch_time_seconds || 0),
        status: String(row.status || 'in_progress'),
        updated_at: row.updated_at || null,
      };
      const rowUpdatedAt = row.updated_at ? new Date(row.updated_at).getTime() : 0;
      const lastUpdatedAt = lastWatched?.updated_at ? new Date(lastWatched.updated_at).getTime() : 0;
      if (!lastWatched || rowUpdatedAt >= lastUpdatedAt) {
        lastWatched = {
          video_id: Number(row.video_id),
          watch_time_seconds: Number(row.watch_time_seconds || 0),
          status: String(row.status || 'in_progress'),
          updated_at: row.updated_at || null,
        };
      }
    });

    const views = {};
    videoIds.forEach((id) => {
      views[String(id)] = 0;
    });
    viewRows.forEach((row) => {
      views[String(row.video_id)] = Number(row.view_count || 0);
    });

    return res.json({
      status: 'success',
      data: { likes, comments, progress, progressMeta, lastWatched, views },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to fetch engagement.' });
  }
};

const upsertCourseVideoProgress = async (req, res) => {
  try {
    await ensureCourseVideosTable();
    await ensureCourseVideoProgressTable();
    const courseId = Number(req.params.courseId);
    const videoId = Number(req.params.videoId);
    const userId = Number(req.user?.id);
    if (Number.isNaN(courseId) || Number.isNaN(videoId) || Number.isNaN(userId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid id.' });
    }
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }
    const isValidVideo = await validateVideoOwnership({ orgId, courseId, videoId });
    if (!isValidVideo) {
      return res.status(404).json({ status: 'error', message: 'Video not found.' });
    }

    const watchTimeSeconds = Math.max(0, Number(req.body?.watch_time_seconds || 0));
    const durationSeconds = Math.max(0, Number(req.body?.duration_seconds || 0));
    const requestedStatus = String(req.body?.status || 'in_progress').toLowerCase();
    const status = requestedStatus === 'completed' ? 'completed' : 'in_progress';

    const [existingRows] = await db.query(
      'SELECT watch_time_seconds, status FROM course_video_progress WHERE org_id = ? AND course_id = ? AND video_id = ? AND user_id = ? LIMIT 1',
      [orgId, courseId, videoId, userId],
    );
    const prevWatchTime = Number(existingRows[0]?.watch_time_seconds || 0);
    const prevStatus = String(existingRows[0]?.status || 'in_progress');
    const nextWatchTime = Math.max(prevWatchTime, watchTimeSeconds);
    const nextStatus = prevStatus === 'completed' || status === 'completed' ? 'completed' : 'in_progress';

    await db.query(
      `INSERT INTO course_video_progress (org_id, course_id, video_id, user_id, watch_time_seconds, status, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         watch_time_seconds = VALUES(watch_time_seconds),
         status = VALUES(status),
         completed_at = VALUES(completed_at)`,
      [
        orgId,
        courseId,
        videoId,
        userId,
        nextWatchTime,
        nextStatus,
        nextStatus === 'completed' ? new Date() : null,
      ],
    );

    if (durationSeconds > 0) {
      await db.query(
        `UPDATE course_videos
         SET duration_seconds = CASE
           WHEN duration_seconds IS NULL OR duration_seconds < ? THEN ?
           ELSE duration_seconds
         END
         WHERE id = ? AND org_id = ? AND course_id = ?`,
        [durationSeconds, durationSeconds, videoId, orgId, courseId],
      );
    }

    return res.json({
      status: 'success',
      data: {
        video_id: videoId,
        watch_time_seconds: nextWatchTime,
        status: nextStatus,
      },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to save progress.' });
  }
};

const createCourseVideoCommentReport = async (req, res) => {
  try {
    await ensureCourseVideosTable();
    await ensureCourseVideoEngagementTables();
    const orgId = resolveOrgId(req.user);
    const userId = Number(req.user?.id);
    const courseId = Number(req.params.courseId);
    const videoId = Number(req.params.videoId);
    const commentId = Number(req.params.commentId);
    const reason = String(req.body.reason || '').trim();
    if (!orgId || !userId || Number.isNaN(courseId) || Number.isNaN(videoId) || Number.isNaN(commentId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid report request.' });
    }
    if (!reason) {
      return res.status(400).json({ status: 'error', message: 'Report reason is required.' });
    }

    const isValidVideo = await validateVideoOwnership({ orgId, courseId, videoId });
    if (!isValidVideo) {
      return res.status(404).json({ status: 'error', message: 'Video not found.' });
    }

    const [commentRows] = await db.query(
      `SELECT id FROM course_video_comments WHERE id = ? AND org_id = ? AND course_id = ? AND video_id = ? LIMIT 1`,
      [commentId, orgId, courseId, videoId],
    );
    if (!commentRows.length) {
      return res.status(404).json({ status: 'error', message: 'Comment not found.' });
    }

    await db.query(
      `INSERT INTO course_video_comment_reports (org_id, course_id, video_id, comment_id, reporter_user_id, reporter_name, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         reason = VALUES(reason),
         reporter_name = VALUES(reporter_name),
         status = 'pending',
         updated_at = CURRENT_TIMESTAMP`,
      [orgId, courseId, videoId, commentId, userId, req.user?.name || null, reason.slice(0, 255)],
    );

    return res.status(201).json({ status: 'success', message: 'Report submitted.' });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to submit report.' });
  }
};

const listCourseVideoCommentReports = async (req, res) => {
  try {
    await ensureCourseVideosTable();
    await ensureCourseVideoEngagementTables();
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }

    const [rows] = await db.query(
      `SELECT r.*,
        crs.title AS course_title,
        v.title AS video_title,
        c.user_name AS comment_author_name,
        c.comment_text AS comment_text
       FROM course_video_comment_reports r
       INNER JOIN courses crs ON crs.id = r.course_id AND crs.org_id = r.org_id
       INNER JOIN course_videos v ON v.id = r.video_id AND v.org_id = r.org_id AND v.course_id = r.course_id
       INNER JOIN course_video_comments c ON c.id = r.comment_id AND c.org_id = r.org_id AND c.course_id = r.course_id AND c.video_id = r.video_id
       WHERE r.org_id = ?
       ORDER BY r.created_at DESC, r.id DESC
       LIMIT 200`,
      [orgId],
    );

    const data = rows.map((row) => ({
      id: row.id,
      course_id: row.course_id,
      video_id: row.video_id,
      comment_id: row.comment_id,
      reporter_user_id: row.reporter_user_id,
      reporter_name: row.reporter_name,
      reason: row.reason,
      status: row.status || 'pending',
      created_at: row.created_at,
      course_title: row.course_title,
      video_title: row.video_title,
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

module.exports = {
  createCourse,
  getCourses,
  fetchOrgCoursesForOrg,
  updateCourse,
  deleteCourse,
  getCourseBookmarks,
  toggleCourseBookmark,
  getCourseMediaBookmarks,
  toggleCourseMediaBookmark,
  createCourseLesson,
  getCourseLessons,
  createCourseVideo,
  getCourseVideos,
  uploadCourseMedia,
  updateCourseVideo,
  deleteCourseVideo,
  toggleCourseVideoStatus,
  toggleCourseVideoLike,
  createCourseVideoComment,
  updateCourseVideoComment,
  toggleCourseVideoCommentReaction,
  deleteCourseVideoComment,
  toggleCourseVideoCommentBlock,
  getCourseVideoEngagement,
  upsertCourseVideoProgress,
  createCourseVideoCommentReport,
  listCourseVideoCommentReports,
};
