const express = require('express');
const router = express.Router();
const startHereStepsController = require('../controllers/startHereSteps.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.use(verifyToken);

router.get('/stats', startHereStepsController.getStepStats);
router.post('/:stepKey/toggle-like', startHereStepsController.toggleStepLike);

module.exports = router;
