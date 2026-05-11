const express = require('express');
const router = express.Router();
const orgController = require('../controllers/org.controller');
const { verifyToken, authorizeRole } = require('../middlewares/auth.middleware');

router.use(verifyToken);
router.use(authorizeRole(['CEO', 'Admin']));
router.get('/dashboard-stats', orgController.getOrgDashboardStats);
module.exports = router;
