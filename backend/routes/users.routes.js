const express = require('express');
const router = express.Router();
const usersController = require('../controllers/users.controller');
const { verifyToken, authorizeRole } = require('../middlewares/auth.middleware');

router.use(verifyToken);
router.post('/', authorizeRole(['CEO', 'Admin']), usersController.createUser);
router.get('/members', usersController.getMembers);
router.get('/members/:id/profile', usersController.getMemberDirectoryProfile);
router.get('/members/:id/activity-summary', usersController.getMemberDirectoryActivitySummary);
router.get('/members/:id/feed-posts', usersController.getMemberDirectoryFeedPosts);
router.get('/members/:id/feed-comments', usersController.getMemberDirectoryFeedComments);
router.get('/members/:id/posting-spaces', usersController.getMemberDirectoryPostingSpaces);
router.get('/members/:id/wall-of-wins', usersController.getMemberDirectoryWallOfWins);
router.get('/', authorizeRole(['CEO', 'Admin', 'Instructor']), usersController.getUsers);
router.get('/:id', authorizeRole(['CEO', 'Admin', 'Instructor']), usersController.getUserById);
router.put('/:id', authorizeRole(['CEO', 'Admin']), usersController.updateUser);
router.patch('/:id/status', authorizeRole(['CEO', 'Admin']), usersController.toggleUserStatus);
router.delete('/:id', authorizeRole(['CEO', 'Admin']), usersController.deleteUser);

module.exports = router;
