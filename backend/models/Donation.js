const mongoose = require('mongoose');

// donor er prottek successful donation er record — timeline, count, certificate er jonno.
const donationSchema = new mongoose.Schema({
    donorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'BloodRequest', default: null },
    bloodGroup: { type: String, required: true },
    hospitalName: { type: String, default: '', maxlength: 150 },
    city: { type: String, default: '' },
    bags: { type: Number, min: 1, max: 20, default: 1 },
    donatedAt: { type: Date, required: true, index: true },
    certificateId: { type: String, unique: true, sparse: true },
    note: { type: String, maxlength: 300, default: '' }
});

donationSchema.index({ donorId: 1, donatedAt: -1 });

module.exports = mongoose.model('Donation', donationSchema);
