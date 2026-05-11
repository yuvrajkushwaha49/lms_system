const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.post('/register-platform', authController.registerPlatform);
router.post('/register', authController.registerPlatform);
router.post('/login', authController.login);

router.get('/me', verifyToken, (req, res) => res.json({ status: 'success', data: req.user }));

module.exports = router;
