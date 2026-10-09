const mongoose = require('mongoose');

// geofence alert: recipient active request er chomuke donor Dhukle turant notification jay.
const geoAlertSchema = new mongoose.Schema({
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'BloodRequest', required: true, index: true },
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    donorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    radiusMeters: { type: Number, min: 100, max: 50000, default: 2000 },
    notifiedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now }
});

geoAlertSchema.index({ requestId: 1, donorId: 1 }, { unique: true });

module.exports = mongoose.model('GeoAlert', geoAlertSchema);
