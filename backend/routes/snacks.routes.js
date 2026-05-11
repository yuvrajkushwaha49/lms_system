const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const snacksController = require('../controllers/snacks.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const uploadDir = path.join(__dirname, '..', 'uploads', 'snacks-media');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname || '');
    const safeBase = path
      .basename(file.originalname || 'snack-media', extension)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 60);
    cb(null, `${Date.now()}-${safeBase}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
});

router.use(verifyToken);
router.get('/comment-reports', snacksController.listSnackCommentReports);
router.get('/', snacksController.getSnacks);
router.get('/:snackId/comments', snacksController.getSnackComments);
router.get('/:snackId/suggestions', snacksController.getSnackSuggestions);
router.post('/:snackId/likes/toggle', snacksController.toggleSnackLike);
router.post('/:snackId/comments', snacksController.createSnackComment);
router.patch('/:snackId/comments/:commentId', snacksController.updateSnackComment);
router.delete('/:snackId/comments/:commentId', snacksController.deleteSnackComment);
router.post('/:snackId/comments/:commentId/reports', snacksController.createSnackCommentReport);
router.post('/:snackId/comments/:commentId/reaction', snacksController.toggleSnackCommentReaction);
router.get('/:snackId', snacksController.getSnack);
router.post(
  '/',
  upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ]),
  snacksController.createSnack,
);

module.exports = router;
