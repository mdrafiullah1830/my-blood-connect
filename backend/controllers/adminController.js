const User = require('../models/User');
const BloodRequest = require('../models/BloodRequest');
const Donation = require('../models/Donation');
const { notify } = require('../services/notify');

// admin panel: platform-wide stats.
const adminStats = async (req, res) => {
    try {
        const [users, available, pending, fulfilled, cancelled, donations, verified, banks] = await Promise.all([
            User.countDocuments({}),
            User.countDocuments({ isAvailable: true }),
            BloodRequest.countDocuments({ status: 'pending' }),
            BloodRequest.countDocuments({ status: 'fulfilled' }),
            BloodRequest.countDocuments({ status: 'cancelled' }),
            Donation.countDocuments({}),
            User.countDocuments({ verified: true }),
            require('../models/BloodBank').countDocuments({ active: true })
        ]);
        res.json({ success: true, stats: { users, available, pending, fulfilled, cancelled, donations, verified, banks } });
    } catch (error) {
        console.error('Admin stats failed:', error);
        res.status(500).json({ success: false, message: 'Unable to load admin stats' });
    }
};

// user list — search + pagination.
const adminListUsers = async (req, res) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(50, Number(req.query.limit) || 20);
        const query = {};
        if (req.query.q) {
            const rx = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            query.$or = [{ name: rx }, { email: rx }, { phone: rx }];
        }
        if (req.query.bloodGroup && req.query.bloodGroup !== 'All') query.bloodGroup = req.query.bloodGroup;
        const [users, total] = await Promise.all([
            User.find(query).select('-password').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            User.countDocuments(query)
        ]);
        res.json({ success: true, users, total, page, pages: Math.ceil(total / limit) });
    } catch (error) {
        console.error('Admin users failed:', error);
        res.status(500).json({ success: false, message: 'Unable to load users' });
    }
};

// NID document review kore donor verify badge dey.
const adminVerifyUser = async (req, res) => {
    try {
        const { verified } = req.body;
        const user = await User.findByIdAndUpdate(req.params.id, {
            verified: Boolean(verified),
            verifiedAt: verified ? new Date() : null
        }, { new: true }).select('-password');
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        if (verified) {
            await notify(req.app.get('socketio'), user._id, {
                type: 'verification',
                title: 'Your profile is verified',
                message: 'Congratulations! Your identity document has been verified. You now carry the verified donor badge.',
                link: '/profile'
            });
        }
        res.json({ success: true, message: verified ? 'User verified' : 'Verification removed', user });
    } catch (error) {
        console.error('Admin verify failed:', error);
        res.status(500).json({ success: false, message: 'Unable to update verification' });
    }
};

// user k admin banaoa / availability force korano.
const adminUpdateUserRole = async (req, res) => {
    try {
        const { role } = req.body;
        if (!['user', 'admin'].includes(role)) return res.status(400).json({ success: false, message: 'Role must be user or admin' });
        if (String(req.params.id) === String(req.user.id)) return res.status(400).json({ success: false, message: 'Cannot change your own role' });
        const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password');
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        res.json({ success: true, message: `Role updated to ${role}`, user });
    } catch (error) {
        console.error('Admin role failed:', error);
        res.status(500).json({ success: false, message: 'Unable to update role' });
    }
};

const adminDeleteUser = async (req, res) => {
    try {
        if (String(req.params.id) === String(req.user.id)) return res.status(400).json({ success: false, message: 'Cannot delete yourself' });
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        res.json({ success: true, message: 'User deleted' });
    } catch (error) {
        console.error('Admin delete failed:', error);
        res.status(500).json({ success: false, message: 'Unable to delete user' });
    }
};

// shob request list — admin moderation.
const adminListRequests = async (req, res) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(50, Number(req.query.limit) || 20);
        const query = {};
        if (req.query.status && ['pending', 'fulfilled', 'cancelled'].includes(req.query.status)) query.status = req.query.status;
        const [requests, total] = await Promise.all([
            BloodRequest.find(query).populate('recipientId', 'name phone city').sort({ postedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            BloodRequest.countDocuments(query)
        ]);
        res.json({ success: true, requests, total, page, pages: Math.ceil(total / limit) });
    } catch (error) {
        console.error('Admin requests failed:', error);
        res.status(500).json({ success: false, message: 'Unable to load requests' });
    }
};

const adminCancelRequest = async (req, res) => {
    try {
        const request = await BloodRequest.findByIdAndUpdate(req.params.id, { status: 'cancelled' }, { new: true });
        if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
        const io = req.app.get('socketio');
        if (io) request.responses.forEach((item) => io.to(`user:${item.donorId}`).emit('blood_request_cancelled', { requestId: request._id }));
        res.json({ success: true, message: 'Request cancelled by admin' });
    } catch (error) {
        console.error('Admin cancel failed:', error);
        res.status(500).json({ success: false, message: 'Unable to cancel request' });
    }
};

module.exports = { adminStats, adminListUsers, adminVerifyUser, adminUpdateUserRole, adminDeleteUser, adminListRequests, adminCancelRequest };
