const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const wallOfWinsController = require('../controllers/wallOfWins.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const uploadDir = path.join(__dirname, '..', 'uploads', 'wall-of-wins');
fs.mkdirSync(uploadDir, { recursive: true });

const imageMimeOnly = (req, file, cb) => {
  const mime = String(file.mimetype || '');
  if (!mime.startsWith('image/')) {
    cb(new Error('Only image uploads are allowed.'));
    return;
  }
  cb(null, true);
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname || '') || '.jpg';
    const safeBase = path
      .basename(file.originalname || 'win-image', extension)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40);
    cb(null, `${Date.now()}-${safeBase}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: imageMimeOnly,
});

const handleUpload = (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        status: 'error',
        message: err.message || 'Invalid image upload.',
      });
    }
    next();
  });
};

router.use(verifyToken);
router.get('/', wallOfWinsController.listWallOfWins);
router.get('/:entryId/suggestions', wallOfWinsController.getWallWinSuggestions);
router.get('/:entryId/comments', wallOfWinsController.getWallWinComments);
router.get('/:entryId', wallOfWinsController.getWallWin);
router.post('/:entryId/likes/toggle', wallOfWinsController.toggleWallWinLike);
router.post('/:entryId/comments', wallOfWinsController.createWallWinComment);
router.post('/', handleUpload, wallOfWinsController.createWallWin);
router.patch('/:entryId/block', wallOfWinsController.toggleWallWinBlock);
router.delete('/:entryId', wallOfWinsController.deleteWallWin);

module.exports = router;
