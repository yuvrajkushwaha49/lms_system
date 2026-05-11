const express = require('express');
const router = express.Router();
const usersController = require('../controllers/users.controller');
const { verifyToken, authorizeRole } = require('../middlewares/auth.middleware');

router.use(verifyToken);
router.post('/', authorizeRole(['CEO', 'Admin']), usersController.createUser);
router.get('/members', usersController.getMembers);
router.get('/', authorizeRole(['CEO', 'Admin', 'Instructor']), usersController.getUsers);
router.get('/:id', authorizeRole(['CEO', 'Admin', 'Instructor']), usersController.getUserById);
router.put('/:id', authorizeRole(['CEO', 'Admin']), usersController.updateUser);
router.patch('/:id/status', authorizeRole(['CEO', 'Admin']), usersController.toggleUserStatus);
router.delete('/:id', authorizeRole(['CEO', 'Admin']), usersController.deleteUser);

module.exports = router;
