const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { listNotifications, markRead, markAllRead, clearAll, subscribePush, unsubscribePush } = require('../controllers/notificationController');

router.get('/', protect, listNotifications);
router.patch('/:id/read', protect, markRead);
router.patch('/read-all', protect, markAllRead);
router.delete('/', protect, clearAll);
router.post('/push/subscribe', protect, subscribePush);
router.post('/push/unsubscribe', protect, unsubscribePush);

module.exports = router;
