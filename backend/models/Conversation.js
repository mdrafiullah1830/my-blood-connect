const mongoose = require('mongoose');

// chat er message — donor/recipient er moddhe in-app conversation er jonno.
const messageSchema = new mongoose.Schema({
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, maxlength: 1000 },
    readBy: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
    createdAt: { type: Date, default: Date.now }
}, { _id: true });

// conversation: direct (2 jon) ba group (emergency team) — group chat support kore.
const conversationSchema = new mongoose.Schema({
    type: { type: String, enum: ['direct', 'group'], default: 'direct' },
    participants: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], required: true },
    title: { type: String, default: '', maxlength: 100 },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'BloodRequest', default: null },
    lastMessageAt: { type: Date, default: Date.now },
    messages: { type: [messageSchema], default: [] }
});

conversationSchema.index({ participants: 1, lastMessageAt: -1 });
conversationSchema.index({ requestId: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);
