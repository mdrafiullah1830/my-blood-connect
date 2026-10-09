const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const { notify } = require('../services/notify');

const participantFields = 'name bloodGroup city avatar isAvailable';

// shob user er conversation list — last message shoho.
const listConversations = async (req, res) => {
    try {
        const conversations = await Conversation.find({ participants: req.user.id })
            .populate('participants', participantFields)
            .sort({ lastMessageAt: -1 })
            .limit(50)
            .lean();
        const shaped = conversations.map((c) => ({
            ...c,
            lastMessage: c.messages?.[c.messages.length - 1] || null,
            messages: undefined
        }));
        res.json({ success: true, conversations: shaped });
    } catch (error) {
        console.error('Conversations read failed:', error);
        res.status(500).json({ success: false, message: 'Unable to load conversations' });
    }
};

// direct conversation khule dao ba existing ta return koro.
const openDirect = async (req, res) => {
    try {
        const { otherUserId, requestId = null } = req.body;
        if (!mongoose.isValidObjectId(otherUserId)) return res.status(400).json({ success: false, message: 'Invalid user id' });
        if (String(otherUserId) === String(req.user.id)) return res.status(400).json({ success: false, message: 'Cannot chat with yourself' });
        const other = await User.findById(otherUserId).select('_id').lean();
        if (!other) return res.status(404).json({ success: false, message: 'User not found' });

        let conversation = await Conversation.findOne({
            type: 'direct',
            participants: { $all: [req.user.id, otherUserId], $size: 2 },
            ...(requestId ? { requestId } : {})
        });
        if (!conversation) conversation = await Conversation.create({ type: 'direct', participants: [req.user.id, otherUserId], requestId });
        const populated = await Conversation.findById(conversation._id).populate('participants', participantFields);
        res.json({ success: true, conversation: populated });
    } catch (error) {
        console.error('Direct chat open failed:', error);
        res.status(500).json({ success: false, message: 'Unable to open conversation' });
    }
};

// emergency request er jonno group chat toiri — shob assigned donor + recipient.
const openGroup = async (req, res) => {
    try {
        const { requestId, title } = req.body;
        if (!mongoose.isValidObjectId(requestId)) return res.status(400).json({ success: false, message: 'Invalid request id' });
        const BloodRequest = require('../models/BloodRequest');
        const request = await BloodRequest.findById(requestId).lean();
        if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
        const isOwner = String(request.recipientId) === String(req.user.id);
        const isAssigned = request.responses.some((r) => String(r.donorId) === String(req.user.id));
        if (!isOwner && !isAssigned) return res.status(403).json({ success: false, message: 'You are not part of this request' });

        let conversation = await Conversation.findOne({ type: 'group', requestId });
        if (!conversation) {
            const participants = [...new Set([String(request.recipientId), ...request.responses.map((r) => String(r.donorId))])];
            conversation = await Conversation.create({ type: 'group', participants, requestId, title: title || `Emergency: ${request.bloodGroup} at ${request.hospitalName}` });
        }
        const populated = await Conversation.findById(conversation._id).populate('participants', participantFields);
        res.json({ success: true, conversation: populated });
    } catch (error) {
        console.error('Group chat open failed:', error);
        res.status(500).json({ success: false, message: 'Unable to open group chat' });
    }
};

const getMessages = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid conversation id' });
        const conversation = await Conversation.findOne({ _id: req.params.id, participants: req.user.id })
            .populate('participants', participantFields)
            .lean();
        if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found' });
        res.json({ success: true, conversation, messages: conversation.messages || [] });
    } catch (error) {
        console.error('Messages read failed:', error);
        res.status(500).json({ success: false, message: 'Unable to load messages' });
    }
};

// message pathay + socket diye real-time delivery + notification.
const sendMessage = async (req, res) => {
    try {
        const { body } = req.body;
        const text = String(body || '').trim();
        if (!text) return res.status(400).json({ success: false, message: 'Message body required' });
        if (text.length > 1000) return res.status(400).json({ success: false, message: 'Message too long (max 1000 chars)' });
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid conversation id' });

        const conversation = await Conversation.findOne({ _id: req.params.id, participants: req.user.id });
        if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found' });

        const message = { senderId: req.user.id, body: text, readBy: [req.user.id], createdAt: new Date() };
        conversation.messages.push(message);
        if (conversation.messages.length > 500) conversation.messages = conversation.messages.slice(-500);
        conversation.lastMessageAt = new Date();
        await conversation.save();

        const io = req.app.get('socketio');
        const populated = await Conversation.findById(conversation._id).populate('participants', participantFields);
        const saved = populated.messages[populated.messages.length - 1];
        conversation.participants.forEach((id) => {
            const key = String(id);
            if (key !== String(req.user.id) && io) io.to(`user:${key}`).emit('chat_message', { conversationId: conversation._id, message: saved });
        });
        const others = conversation.participants.filter((id) => String(id) !== String(req.user.id));
        await Promise.all(others.map((id) => notify(io, id, {
            type: 'chat',
            title: 'New message',
            message: text.slice(0, 120),
            link: `/chat/${conversation._id}`
        })));

        res.status(201).json({ success: true, message: saved });
    } catch (error) {
        console.error('Message send failed:', error);
        res.status(500).json({ success: false, message: 'Unable to send message' });
    }
};

const markMessagesRead = async (req, res) => {
    try {
        const conversation = await Conversation.findOne({ _id: req.params.id, participants: req.user.id });
        if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found' });
        conversation.messages.forEach((m) => {
            if (!m.readBy.some((id) => String(id) === String(req.user.id))) m.readBy.push(req.user.id);
        });
        await conversation.save();
        res.json({ success: true });
    } catch (error) {
        console.error('Messages mark read failed:', error);
        res.status(500).json({ success: false, message: 'Unable to mark messages read' });
    }
};

// video call er jonno meeting link generate — request-based stable room name.
const getVideoLink = async (req, res) => {
    try {
        const { requestId, conversationId } = req.body;
        const seed = String(requestId || conversationId || req.user.id).replace(/[^a-zA-Z0-9]/g, '');
        if (!seed) return res.status(400).json({ success: false, message: 'requestId or conversationId required' });
        const room = `bloodconnect-${seed}-${process.env.VIDEO_ROOM_SALT || 'local'}`;
        res.json({ success: true, room, url: `https://meet.jit.si/${room}` });
    } catch (error) {
        console.error('Video link failed:', error);
        res.status(500).json({ success: false, message: 'Unable to create video link' });
    }
};

module.exports = { listConversations, openDirect, openGroup, getMessages, sendMessage, markMessagesRead, getVideoLink };
