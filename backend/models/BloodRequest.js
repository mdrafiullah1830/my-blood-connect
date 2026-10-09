const mongoose = require('mongoose');

// ei schema e donor response status track kora hoy, jemon accepted, rejected, ar pending.
const responseSchema = new mongoose.Schema({
    donorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    respondedAt: { type: Date, default: null }
}, { _id: false });

// ei schema e blood request er patient info, hospital info, needed time, ar donor response store kora hoy.
const bloodRequestSchema = new mongoose.Schema({
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    requestType: { type: String, enum: ['direct', 'emergency'], required: true, default: 'emergency' },
    patientName: { type: String, required: true, trim: true, maxlength: 100 },
    bloodGroup: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], required: true },
    hospitalName: { type: String, required: true, trim: true, maxlength: 150 },
    hospitalAddress: { type: String, required: true, trim: true, maxlength: 300 },
    contactNumber: { type: String, required: true, trim: true, minlength: 7, maxlength: 20 },
    bagsRequired: { type: Number, min: 1, max: 20, default: 1 },
    neededTime: { type: Date, required: true },
    recipientLocation: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: undefined }
    },
    responses: { type: [responseSchema], default: [] },
    status: { type: String, enum: ['pending', 'fulfilled', 'cancelled'], default: 'pending' },
    priority: { type: String, enum: ['normal', 'high', 'critical'], default: 'normal' },
    shareToken: { type: String, default: '', index: true },
    escalationLevel: { type: Number, min: 0, max: 3, default: 0 },
    escalatedAt: { type: Date, default: null },
    broadcastAt: { type: Date, default: null },
    reminderSentAt: { type: Date, default: null },
    postedAt: { type: Date, default: Date.now }
});

bloodRequestSchema.index({ recipientId: 1, postedAt: -1 });
bloodRequestSchema.index({ 'responses.donorId': 1, status: 1 });
bloodRequestSchema.index({ 'responses.donorId': 1, requestType: 1, status: 1, postedAt: -1 });
bloodRequestSchema.index({ neededTime: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('BloodRequest', bloodRequestSchema);
