const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const { createOriginValidator } = require('./config/cors');
const User = require('./models/User');

dotenv.config();

if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
    console.error('MONGO_URI and JWT_SECRET must be configured in .env');
    process.exit(1);
}

const app = express();
const server = http.createServer(app);
const validateOrigin = createOriginValidator(process.env.FRONTEND_URL);

// ei settings diye API-ke secure ar stable rakha hoy.
// default framework header disable kora hoy ar incoming JSON payload size limited rakha hoy.
app.disable('x-powered-by');
app.use(cors({ origin: validateOrigin, credentials: false }));
app.use(express.json({ limit: '1mb' }));
// express 5 e body-less request e req.body undefined thake — destructure na bhenge
// shob endpoint e empty object ensure kora hoy.
app.use((req, _res, next) => { if (req.body === undefined || req.body === null) req.body = {}; next(); });

// login ar register endpoint e brute-force attack theke safeguard rakhar jonno rate limiter use kora hoy.
// choto somoy er moddhe onek request asle app-ke safe rakhte ei limiter kaj kore.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { success: false, message: 'Too many attempts. Please try again later.' }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Socket.IO setup diye live emergency request update, donor response notification ebong onno realtime feature support kora hoy.
const io = new Server(server, {
    cors: { origin: validateOrigin, methods: ['GET', 'POST', 'PATCH', 'PUT'] }
});

// prottek socket connection JWT authentication er maddhome verify kora hoy, jate shudhu logged-in user realtime update pay.
io.use((socket, next) => {
    try {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error('Authentication required'));
        socket.user = jwt.verify(token, process.env.JWT_SECRET);
        return next();
    } catch {
        return next(new Error('Invalid or expired token'));
    }
});

// client connect hoar por user-ke tar own room ar city room e add kora hoy.
// ei jonno notification shudhu relevant donor/recipient group-ke pathano jay.
io.on('connection', async (socket) => {
    socket.join(`user:${socket.user.id}`);
    try {
        const user = await User.findById(socket.user.id).select('city').lean();
        if (user?.city) socket.join(`city:${user.city}`);
    } catch {
        socket.disconnect(true);
    }
});
app.set('socketio', io);

app.get('/', (req, res) => res.json({ success: true, message: 'Blood Connect Phase 1 API is running' }));
app.get('/api/health', (req, res) => res.json({ success: true, service: 'blood-connect-api' }));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/donors', require('./routes/donorRoutes'));
app.use('/api/requests', require('./routes/requestRoutes'));
app.use('/api/locations', require('./routes/locationRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/favorites', require('./routes/favoriteRoutes'));
app.use('/api/donations', require('./routes/donationRoutes'));
app.use('/api/banks', require('./routes/bloodBankRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/map', require('./routes/mapRoutes'));

app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use((error, req, res, next) => {
    console.error(error);
    if (res.headersSent) return next(error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
});

const PORT = Number(process.env.PORT) || 5000;

const startServer = async () => {
    await connectDB();
    await User.migrateToUnifiedAccounts();
    await seedAdmin();
    server.listen(PORT, () => console.log(`Blood Connect API running on port ${PORT}`));
    // background scheduler: escalation, reminders, eligibility alerts, daily digest.
    require('./services/scheduler').startScheduler(io);
};

// ADMIN_EMAILS env e comma diye dile shei email gulo admin role paye.
const seedAdmin = async () => {
    const emails = String(process.env.ADMIN_EMAILS || '').split(',').map((e) => e.toLowerCase().trim()).filter(Boolean);
    if (!emails.length) return;
    await User.updateMany({ email: { $in: emails } }, { $set: { role: 'admin' } });
    console.log(`Admin role ensured for ${emails.length} email(s)`);
};

if (require.main === module) {
    startServer().catch((error) => {
        console.error('Server startup failed:', error.message);
        process.exit(1);
    });
}

module.exports = { app, server, io, startServer };
