const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { verifyToken, authorizeRole } = require('../middlewares/auth.middleware');
const documentCenterController = require('../controllers/documentCenter.controller');

const uploadDir = path.join(__dirname, '..', 'uploads', 'document-center');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    const safeBase = path
      .basename(file.originalname || 'file', ext)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 80);
    cb(null, `${Date.now()}-${safeBase}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 80 * 1024 * 1024 },
});

const router = express.Router();

router.get('/files', verifyToken, documentCenterController.listDocumentCenterFiles);
router.post(
  '/upload',
  verifyToken,
  authorizeRole(['CEO', 'Admin', 'Instructor']),
  upload.single('file'),
  documentCenterController.uploadDocumentCenterFile,
);

router.get('/items', verifyToken, documentCenterController.getDocumentCenterItems);
router.get('/items/:id/comments', verifyToken, documentCenterController.getDocumentCenterComments);
router.get('/items/:id/likes', verifyToken, documentCenterController.getDocumentCenterLikes);
router.post('/items/:id/comments', verifyToken, documentCenterController.createDocumentCenterComment);
router.post(
  '/items/:id/comments/:commentId/like',
  verifyToken,
  documentCenterController.addDocumentCenterCommentLike,
);
router.get('/items/:id', verifyToken, documentCenterController.getDocumentCenterItem);
router.post(
  '/items',
  verifyToken,
  authorizeRole(['CEO', 'Admin', 'Instructor']),
  documentCenterController.createDocumentCenterItem,
);
router.put(
  '/items/:id',
  verifyToken,
  authorizeRole(['CEO', 'Admin', 'Instructor']),
  documentCenterController.updateDocumentCenterItem,
);
router.delete(
  '/items/:id',
  verifyToken,
  authorizeRole(['CEO', 'Admin', 'Instructor']),
  documentCenterController.deleteDocumentCenterItem,
);
router.post('/items/:id/like', verifyToken, documentCenterController.addDocumentCenterLike);
router.post('/items/:id/comment', verifyToken, documentCenterController.incrementDocumentCenterComment);

module.exports = router;
