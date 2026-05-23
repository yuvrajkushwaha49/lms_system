const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const askRyanController = require('../controllers/askRyan.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const uploadDir = path.join(__dirname, '..', 'uploads', 'ask-ryan');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname || '');
    const safeBase = path
      .basename(file.originalname || 'ask-ryan', extension)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 60);
    cb(null, `${Date.now()}-${safeBase}${extension}`);
  },
});

const answerUpload = multer({
  storage,
  limits: { fileSize: 150 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const mime = String(file.mimetype || '').toLowerCase();
    if (file.fieldname === 'video') {
      if (mime.startsWith('video/')) {
        cb(null, true);
        return;
      }
      cb(new Error('Video must be a video file.'));
      return;
    }
    if (file.fieldname === 'thumbnail') {
      if (mime.startsWith('image/')) {
        cb(null, true);
        return;
      }
      cb(new Error('Thumbnail must be an image.'));
      return;
    }
    cb(new Error('Unexpected field.'));
  },
}).fields([
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
]);

router.use(verifyToken);

router.post('/questions', askRyanController.submitQuestion);
router.get('/published', askRyanController.getPublished);
router.get('/community-like', askRyanController.getCommunityLike);
router.post('/community-like/toggle', askRyanController.toggleCommunityLike);
router.get('/questions/:questionId/likes', askRyanController.getQuestionLikes);
router.post('/questions/:questionId/likes/toggle', askRyanController.toggleLike);
router.post('/questions/:questionId/comments/:commentId/likes/toggle', askRyanController.toggleCommentLike);
router.post('/questions/:questionId/comments', askRyanController.addComment);
router.get('/questions/:questionId/comments', askRyanController.getComments);

router.get('/admin/questions', askRyanController.adminListQuestions);
router.post('/admin/questions/:questionId/answer', (req, res, next) => {
  answerUpload(req, res, (err) => {
    if (err) {
      return res.status(400).json({ status: 'error', message: err.message || 'Upload failed.' });
    }
    next();
  });
}, askRyanController.adminAnswerQuestion);

module.exports = router;
