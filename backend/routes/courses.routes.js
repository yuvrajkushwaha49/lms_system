const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const coursesController = require('../controllers/courses.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const uploadDir = path.join(__dirname, '..', 'uploads', 'course-media');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname || '');
    const safeBase = path
      .basename(file.originalname || 'media', extension)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 60);
    cb(null, `${Date.now()}-${safeBase}${extension}`);
  },
});
const upload = multer({ storage });

router.use(verifyToken);
router.post('/', coursesController.createCourse);
router.get('/', coursesController.getCourses);
router.get('/reports/video-comments', coursesController.listCourseVideoCommentReports);
router.put('/:courseId', coursesController.updateCourse);
router.delete('/:courseId', coursesController.deleteCourse);
router.get('/bookmarks', coursesController.getCourseBookmarks);
router.get('/media-bookmarks', coursesController.getCourseMediaBookmarks);
router.post('/upload-media', upload.single('file'), coursesController.uploadCourseMedia);
router.post('/:courseId/bookmark/toggle', coursesController.toggleCourseBookmark);
router.post('/:courseId/videos/:videoId/bookmark/toggle', coursesController.toggleCourseMediaBookmark);
router.post('/:courseId/lessons', coursesController.createCourseLesson);
router.get('/:courseId/lessons', coursesController.getCourseLessons);
router.post('/:courseId/videos', coursesController.createCourseVideo);
router.get('/:courseId/videos', coursesController.getCourseVideos);
router.get('/:courseId/videos/engagement', coursesController.getCourseVideoEngagement);
router.post('/:courseId/videos/:videoId/likes/toggle', coursesController.toggleCourseVideoLike);
router.post('/:courseId/videos/:videoId/comments', coursesController.createCourseVideoComment);
router.patch('/:courseId/videos/:videoId/comments/:commentId', coursesController.updateCourseVideoComment);
router.post('/:courseId/videos/:videoId/comments/:commentId/reports', coursesController.createCourseVideoCommentReport);
router.post('/:courseId/videos/:videoId/comments/:commentId/reaction', coursesController.toggleCourseVideoCommentReaction);
router.patch('/:courseId/videos/:videoId/comments/:commentId/block', coursesController.toggleCourseVideoCommentBlock);
router.delete('/:courseId/videos/:videoId/comments/:commentId', coursesController.deleteCourseVideoComment);
router.post('/:courseId/videos/:videoId/progress', coursesController.upsertCourseVideoProgress);
router.put('/:courseId/videos/:videoId', coursesController.updateCourseVideo);
router.patch('/:courseId/videos/:videoId/status', coursesController.toggleCourseVideoStatus);
router.delete('/:courseId/videos/:videoId', coursesController.deleteCourseVideo);

module.exports = router;
