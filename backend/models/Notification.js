const mongoose = require('mongoose');

// ei schema te in-app notification history store hoy — notification center er jonno.
const notificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
        type: String,
        enum: ['request', 'response', 'reminder', 'chat', 'system', 'digest', 'escalation', 'geofence', 'verification'],
        default: 'system'
    },
    title: { type: String, required: true, maxlength: 150 },
    message: { type: String, required: true, maxlength: 500 },
    link: { type: String, default: '' },
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now, index: true }
});

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
