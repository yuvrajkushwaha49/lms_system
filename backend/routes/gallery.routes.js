const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { verifyToken, authorizeRole } = require('../middlewares/auth.middleware');
const galleryController = require('../controllers/gallery.controller');

const uploadDir = path.join(__dirname, '..', 'uploads', 'gallery');
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
    const ext = path.extname(file.originalname || '') || '.jpg';
    const safeBase = path
      .basename(file.originalname || 'image', ext)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 80);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeBase}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: imageMimeOnly,
});

const adminOnly = authorizeRole(['CEO', 'Admin', 'Instructor']);

const router = express.Router();

router.get('/folders', verifyToken, galleryController.getGalleryFolders);
router.post('/folders', verifyToken, adminOnly, galleryController.createGalleryFolder);
router.get('/folders/:folderId', verifyToken, galleryController.getGalleryFolder);
router.delete('/folders/:folderId', verifyToken, adminOnly, galleryController.deleteGalleryFolder);
router.post('/folders/:folderId/like', verifyToken, galleryController.likeGalleryFolder);
router.get('/folders/:folderId/comments', verifyToken, galleryController.getGalleryFolderComments);
router.post('/folders/:folderId/comments', verifyToken, galleryController.createGalleryFolderComment);
router.get('/folders/:folderId/images', verifyToken, galleryController.getGalleryFolderImages);
router.post(
  '/folders/:folderId/images',
  verifyToken,
  adminOnly,
  upload.array('images', 24),
  galleryController.uploadGalleryImages,
);

router.delete('/images/:imageId', verifyToken, adminOnly, galleryController.deleteGalleryImage);
router.post('/images/:imageId/like', verifyToken, galleryController.likeGalleryImage);
router.get('/images/:imageId/comments', verifyToken, galleryController.getGalleryImageComments);
router.post('/images/:imageId/comments', verifyToken, galleryController.createGalleryImageComment);

router.post('/comments/:commentId/like', verifyToken, galleryController.likeGalleryComment);
router.patch('/comments/:commentId', verifyToken, galleryController.updateGalleryComment);
router.post('/comments/:commentId/reports', verifyToken, galleryController.createGalleryCommentReport);

module.exports = router;
