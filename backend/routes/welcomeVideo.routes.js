const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const welcomeVideoController = require('../controllers/welcomeVideo.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const uploadDir = path.join(__dirname, '..', 'uploads', 'welcome-video');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname || '');
    const safeBase = path
      .basename(file.originalname || 'welcome-media', extension)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 60);
    cb(null, `${Date.now()}-${safeBase}${extension}`);
  },
});

const uploadFields = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const mime = String(file.mimetype || '').toLowerCase();
    if (file.fieldname === 'video') {
      if (mime.startsWith('video/')) {
        cb(null, true);
        return;
      }
      cb(new Error('Only video files are allowed for the video field.'));
      return;
    }
    if (file.fieldname === 'thumbnail') {
      if (mime.startsWith('image/')) {
        cb(null, true);
        return;
      }
      cb(new Error('Only image files are allowed for the thumbnail.'));
      return;
    }
    cb(new Error('Unexpected upload field.'));
  },
}).fields([
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
]);

/** Run multer only for multipart saves (community-feed style: video ± thumbnail). */
const welcomePutUpload = (req, res, next) => {
  const ct = String(req.headers['content-type'] || '');
  if (!ct.includes('multipart/form-data')) {
    next();
    return;
  }
  uploadFields(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        status: 'error',
        message: err.message || 'Upload failed.',
      });
    }
    next();
  });
};

router.use(verifyToken);

router.get('/', welcomeVideoController.getWelcomeVideo);
router.put('/', welcomePutUpload, welcomeVideoController.upsertWelcomeVideo);

module.exports = router;
