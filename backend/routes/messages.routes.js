const express = require('express');
const router = express.Router();
const messagesController = require('../controllers/messages.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.use(verifyToken);

router.get('/conversations', messagesController.listConversations);
router.post('/conversations/ensure', messagesController.ensureConversation);
router.get('/conversations/:conversationId/messages', messagesController.listMessages);
router.post('/conversations/:conversationId/messages', messagesController.createMessage);
router.patch('/conversations/:conversationId/read', messagesController.markConversationRead);
router.patch('/conversations/:conversationId/messages/:messageId', messagesController.updateMessage);
router.delete('/conversations/:conversationId/messages/:messageId', messagesController.deleteMessage);

module.exports = router;

