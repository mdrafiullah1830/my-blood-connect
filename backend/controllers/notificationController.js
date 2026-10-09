const Notification = require('../models/Notification');
const PushSubscription = require('../models/PushSubscription');

// notification center: shob notification list, unread count, mark-read.
const listNotifications = async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit) || 30, 100);
        const [notifications, unread] = await Promise.all([
            Notification.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(limit).lean(),
            Notification.countDocuments({ userId: req.user.id, read: false })
        ]);
        res.json({ success: true, notifications, unread });
    } catch (error) {
        console.error('Notifications read failed:', error);
        res.status(500).json({ success: false, message: 'Unable to load notifications' });
    }
};

const markRead = async (req, res) => {
    try {
        await Notification.updateOne({ _id: req.params.id, userId: req.user.id }, { $set: { read: true } });
        res.json({ success: true });
    } catch (error) {
        console.error('Notification mark read failed:', error);
        res.status(500).json({ success: false, message: 'Unable to update notification' });
    }
};

const markAllRead = async (req, res) => {
    try {
        await Notification.updateMany({ userId: req.user.id, read: false }, { $set: { read: true } });
        res.json({ success: true });
    } catch (error) {
        console.error('Notifications mark all failed:', error);
        res.status(500).json({ success: false, message: 'Unable to update notifications' });
    }
};

const clearAll = async (req, res) => {
    try {
        await Notification.deleteMany({ userId: req.user.id });
        res.json({ success: true });
    } catch (error) {
        console.error('Notifications clear failed:', error);
        res.status(500).json({ success: false, message: 'Unable to clear notifications' });
    }
};

// browser push subscription save kore rakhhe (PWA push notification feature).
const subscribePush = async (req, res) => {
    try {
        const { endpoint, keys } = req.body;
        if (!endpoint) return res.status(400).json({ success: false, message: 'Push endpoint required' });
        await PushSubscription.findOneAndUpdate(
            { userId: req.user.id, endpoint },
            { userId: req.user.id, endpoint, keys: keys || {}, userAgent: String(req.headers['user-agent'] || '').slice(0, 200) },
            { upsert: true }
        );
        res.json({ success: true, message: 'Push subscription saved' });
    } catch (error) {
        console.error('Push subscribe failed:', error);
        res.status(500).json({ success: false, message: 'Unable to save push subscription' });
    }
};

const unsubscribePush = async (req, res) => {
    try {
        await PushSubscription.deleteOne({ userId: req.user.id, endpoint: req.body.endpoint });
        res.json({ success: true });
    } catch (error) {
        console.error('Push unsubscribe failed:', error);
        res.status(500).json({ success: false, message: 'Unable to remove push subscription' });
    }
};

module.exports = { listNotifications, markRead, markAllRead, clearAll, subscribePush, unsubscribePush };
