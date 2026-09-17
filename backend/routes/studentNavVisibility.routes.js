const express = require('express');
const router = express.Router();
const controller = require('../controllers/studentNavVisibility.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.use(verifyToken);
router.get('/', controller.getStudentNavVisibility);
router.put('/', controller.upsertStudentNavVisibility);

module.exports = router;
