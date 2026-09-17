const express = require('express');
const router = express.Router();
const upcomingEventsController = require('../controllers/upcomingEvents.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.use(verifyToken);

router.get('/', upcomingEventsController.getUpcomingEvents);
router.post('/', upcomingEventsController.createUpcomingEvent);
router.patch('/:eventId', upcomingEventsController.updateUpcomingEvent);
router.delete('/:eventId', upcomingEventsController.deleteUpcomingEvent);

module.exports = router;
