const mongoose = require('mongoose');

// browser push subscription — service worker push notification pathanor jonno store hoy.
const pushSubscriptionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    endpoint: { type: String, required: true },
    keys: {
        p256dh: { type: String, default: '' },
        auth: { type: String, default: '' }
    },
    userAgent: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

pushSubscriptionSchema.index({ userId: 1, endpoint: 1 }, { unique: true });

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
