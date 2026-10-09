const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { listConversations, openDirect, openGroup, getMessages, sendMessage, markMessagesRead, getVideoLink } = require('../controllers/chatController');

router.get('/conversations', protect, listConversations);
router.post('/conversations/direct', protect, openDirect);
router.post('/conversations/group', protect, openGroup);
router.get('/conversations/:id', protect, getMessages);
router.post('/conversations/:id/messages', protect, sendMessage);
router.patch('/conversations/:id/read', protect, markMessagesRead);
router.post('/video-link', protect, getVideoLink);

module.exports = router;
