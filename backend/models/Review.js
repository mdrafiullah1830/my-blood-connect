const mongoose = require('mongoose');

// donor ke recipient rating dewar jonno ei schema — average rating calculate hoy.
const reviewSchema = new mongoose.Schema({
    donorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'BloodRequest', default: null },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, trim: true, maxlength: 300, default: '' },
    createdAt: { type: Date, default: Date.now }
});

reviewSchema.index({ donorId: 1, reviewerId: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
