const express = require('express');
const router = express.Router();
const controller = require('../controllers/monthlyChallengeMonths.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.use(verifyToken);

router.get('/', controller.listLabels);
router.post('/', controller.upsertLabel);
router.get('/:monthKey/schedule', controller.getMonthSchedule);
router.get('/:monthKey/admin-detail', controller.getAdminMonthDetail);
router.put('/:monthKey/courses/:courseId/placement', controller.putCoursePlacement);
router.delete('/:monthKey/courses/:courseId/placement', controller.deleteCoursePlacement);
router.delete('/:monthKey', controller.deleteLabel);

module.exports = router;
