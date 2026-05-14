const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const feedController = require('../controllers/feed.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const uploadDir = path.join(__dirname, '..', 'uploads', 'feed-media');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname || '');
    const safeBase = path
      .basename(file.originalname || 'feed-media', extension)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 60);
    cb(null, `${Date.now()}-${safeBase}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});

router.get('/media/variants/:variantId', feedController.streamFeedVariantMedia);
router.get('/media/posts/:postId', feedController.streamFeedPostMedia);
router.get('/media/:attachmentId', feedController.streamFeedAttachmentMedia);

router.use(verifyToken);
router.get('/summary', feedController.getFeedSpaceSummary);
router.get('/', feedController.getFeedPosts);
router.get('/reports/comments', feedController.getFeedCommentReportsList);
router.get('/reports', feedController.getFeedPostReports);
router.get('/reports/:reportId', feedController.getFeedPostReportDetail);
router.patch('/reports/:reportId/block-post', feedController.blockReportedFeedPost);
router.post('/', upload.array('media', 12), feedController.createFeedPost);
router.post('/:postId/likes/toggle', feedController.toggleFeedPostLike);
router.post('/:postId/reports', feedController.createFeedPostReport);
router.post('/:postId/comments', feedController.createFeedPostComment);
router.patch('/:postId/comments/:commentId', feedController.updateFeedPostComment);
router.delete('/:postId/comments/:commentId', feedController.deleteFeedPostComment);
router.post('/:postId/comments/:commentId/reports', feedController.createFeedCommentReport);
router.post('/:postId/comments/:commentId/reaction', feedController.toggleFeedPostCommentReaction);

module.exports = router;
