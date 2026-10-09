const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ei middleware diye request er Authorization header check kora hoy.
// JWT token thakle user ke authenticated hisabe accept kora hoy, na hole access stop kora hoy.
const protect = async (req, res, next) => {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    try {
        const token = header.slice(7).trim();
        if (!token) throw new Error('Missing token');
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        if (!payload.id) throw new Error('Invalid payload');
        req.user = payload;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
};

// role check — JWT e role na thakle database theke live role load kore
// (tai admin promote korle turant kaj kore, purano token invalidate na lage).
const requireRole = (...roles) => async (req, res, next) => {
    if (!req.user) return res.status(403).json({ success: false, message: 'You do not have permission for this action' });
    let role = req.user.role;
    if (!role) {
        try {
            const user = await User.findById(req.user.id).select('role').lean();
            role = user?.role || 'user';
        } catch {
            return res.status(500).json({ success: false, message: 'Unable to verify role' });
        }
    }
    if (!roles.includes(role)) {
        return res.status(403).json({ success: false, message: 'You do not have permission for this action' });
    }
    req.user.role = role;
    next();
};

module.exports = { protect, requireRole };
