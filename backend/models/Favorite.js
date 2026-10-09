const mongoose = require('mongoose');

// recipient favorite donor save kore rakhle pore sohoje pabe — saved donor list.
const favoriteSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    donorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now }
});

favoriteSchema.index({ userId: 1, donorId: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', favoriteSchema);
