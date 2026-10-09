const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { issueOtp, verifyOtp, issueToken, consumeToken } = require('../services/tokens');
const { sendEmail } = require('../services/notify');
const { safeUser } = require('./authController');

const REFRESH_DAYS = Number(process.env.REFRESH_TOKEN_DAYS) || 30;

// phone e OTP pathay (registration/phone verification feature).
const sendPhoneOtp = async (req, res) => {
    try {
        const { purpose = 'phone_verify' } = req.body || {};
        // body te phone na thakle user er stored phone-e OTP jay.
        const storedUser = await User.findById(req.user.id).select('phone').lean();
        if (!storedUser) return res.status(404).json({ success: false, message: 'User not found' });
        const normalized = String(req.body?.phone || storedUser.phone || '').trim();
        if (normalized.length < 7) return res.status(400).json({ success: false, message: 'Valid phone number required' });
        await issueOtp({ userId: req.user.id, kind: 'otp_phone', destination: normalized, channel: 'sms', purpose });
        res.json({ success: true, message: 'Verification code sent via SMS' });
    } catch (error) {
        console.error('Phone OTP failed:', error);
        res.status(500).json({ success: false, message: 'Unable to send verification code' });
    }
};

const verifyPhoneOtp = async (req, res) => {
    try {
        const { code, token } = req.body;
        const result = await verifyOtp({ userId: req.user.id, kind: 'otp_phone', token, code });
        if (!result.ok) return res.status(400).json({ success: false, message: result.message });
        const user = await User.findByIdAndUpdate(req.user.id, { phoneVerified: true }, { new: true }).select('-password');
        res.json({ success: true, message: 'Phone number verified', user: safeUser(user) });
    } catch (error) {
        console.error('Phone OTP verify failed:', error);
        res.status(500).json({ success: false, message: 'Unable to verify code' });
    }
};

// registration er por email verification link pathay.
const sendEmailVerification = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('email emailVerified name').lean();
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        if (user.emailVerified) return res.json({ success: true, message: 'Email already verified' });
        const token = await issueToken({ userId: req.user.id, kind: 'email_verify', ttlMinutes: 24 * 60 });
        const link = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${token}`;
        await sendEmail(user.email, 'Verify your Blood Connect account', `<p>Hi ${user.name},</p><p>Verify your email: <a href="${link}">${link}</a></p><p>Link expires in 24 hours.</p>`);
        res.json({ success: true, message: 'Verification email sent', ...(process.env.SMTP_HOST ? {} : { devLink: link }) });
    } catch (error) {
        console.error('Email verify send failed:', error);
        res.status(500).json({ success: false, message: 'Unable to send verification email' });
    }
};

// public endpoint — link e token diye email verify.
const verifyEmail = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ success: false, message: 'Token required' });
        const AuthToken = require('../models/AuthToken');
        const record = await AuthToken.findOne({ kind: 'email_verify', token, used: false });
        if (!record || record.expiresAt < new Date()) return res.status(400).json({ success: false, message: 'Invalid or expired verification link' });
        record.used = true;
        await record.save();
        await User.findByIdAndUpdate(record.userId, { emailVerified: true });
        res.json({ success: true, message: 'Email verified successfully' });
    } catch (error) {
        console.error('Email verify failed:', error);
        res.status(500).json({ success: false, message: 'Unable to verify email' });
    }
};

// password bhule gele email diye reset link — token ekbar use hoy.
const forgotPassword = async (req, res) => {
    try {
        const email = String(req.body.email || '').toLowerCase().trim();
        const user = await User.findOne({ email }).select('_id email name').lean();
        // user na thakle o same message — enumeration attack prevent korte.
        if (!user) return res.json({ success: true, message: 'If that email exists, a reset link has been sent' });
        const token = await issueToken({ userId: user._id, kind: 'password_reset', ttlMinutes: 30 });
        const link = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
        await sendEmail(user.email, 'Reset your Blood Connect password', `<p>Hi ${user.name},</p><p>Reset password: <a href="${link}">${link}</a></p><p>Link expires in 30 minutes.</p>`);
        res.json({ success: true, message: 'If that email exists, a reset link has been sent', ...(process.env.SMTP_HOST ? {} : { devLink: link }) });
    } catch (error) {
        console.error('Forgot password failed:', error);
        res.status(500).json({ success: false, message: 'Unable to process request' });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;
        if (typeof password !== 'string' || password.length < 8) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
        const AuthToken = require('../models/AuthToken');
        const record = await AuthToken.findOne({ kind: 'password_reset', token, used: false });
        if (!record || record.expiresAt < new Date()) return res.status(400).json({ success: false, message: 'Invalid or expired reset link' });
        record.used = true;
        await record.save();
        const hashed = await bcrypt.hash(password, 12);
        await User.findByIdAndUpdate(record.userId, { password: hashed });
        // purano shob session invalidate kore notun password diye login lagbe.
        await AuthToken.deleteMany({ userId: record.userId, kind: 'refresh' });
        res.json({ success: true, message: 'Password reset successful. Please log in.' });
    } catch (error) {
        console.error('Reset password failed:', error);
        res.status(500).json({ success: false, message: 'Unable to reset password' });
    }
};

// 2FA enable/disable — enable korle login e OTP lagbe.
const toggle2FA = async (req, res) => {
    try {
        const enable = Boolean(req.body.enabled);
        if (enable) {
            const user = await User.findById(req.user.id).select('email').lean();
            await issueOtp({ userId: req.user.id, kind: 'otp_2fa', destination: user.email, channel: 'email', purpose: '2FA setup' });
            return res.json({ success: true, requiresOtp: true, message: 'Enter the code sent to your email to enable 2FA' });
        }
        await User.findByIdAndUpdate(req.user.id, { twoFactorEnabled: false });
        return res.json({ success: true, twoFactorEnabled: false, message: 'Two-factor authentication disabled' });
    } catch (error) {
        console.error('2FA toggle failed:', error);
        res.status(500).json({ success: false, message: 'Unable to update 2FA setting' });
    }
};

const confirm2FAEnable = async (req, res) => {
    try {
        const result = await verifyOtp({ userId: req.user.id, kind: 'otp_2fa', token: req.body.token, code: req.body.code });
        if (!result.ok) return res.status(400).json({ success: false, message: result.message });
        await User.findByIdAndUpdate(req.user.id, { twoFactorEnabled: true });
        res.json({ success: true, twoFactorEnabled: true, message: 'Two-factor authentication enabled' });
    } catch (error) {
        console.error('2FA confirm failed:', error);
        res.status(500).json({ success: false, message: 'Unable to enable 2FA' });
    }
};

// 2FA login flow — password valid hole OTP challenge return hoy, verify korle token.
const beginLogin2FA = async (email) => {
    const user = await User.findOne({ email: String(email || '').toLowerCase().trim() });
    if (!user || !user.twoFactorEnabled) return null;
    await issueOtp({ userId: user._id, kind: 'otp_2fa', destination: user.email, channel: 'email', purpose: 'login' });
    const challenge = jwt.sign({ id: user._id.toString(), stage: '2fa' }, process.env.JWT_SECRET, { expiresIn: '10m' });
    return { challenge, email: user.email };
};

const completeLogin2FA = async ({ challenge, code }) => {
    let payload;
    try {
        payload = jwt.verify(challenge, process.env.JWT_SECRET);
        if (payload.stage !== '2fa') throw new Error('bad stage');
    } catch {
        return { ok: false, status: 401, message: 'Invalid or expired 2FA challenge' };
    }
    const result = await verifyOtp({ userId: payload.id, kind: 'otp_2fa', code });
    if (!result.ok) return { ok: false, status: 400, message: result.message };
    const user = await User.findById(payload.id);
    if (!user) return { ok: false, status: 404, message: 'User not found' };
    return { ok: true, user };
};

// refresh token issue + rotate — access token short-lived thake, session secure thake.
const issueRefreshToken = async (userId, meta = {}) => {
    const token = await issueToken({ userId, kind: 'refresh', ttlMinutes: REFRESH_DAYS * 24 * 60, meta });
    return token;
};

const refreshSession = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) return res.status(400).json({ success: false, message: 'Refresh token required' });
        const consumed = await consumeToken({ kind: 'refresh', token: refreshToken });
        if (!consumed.ok) return res.status(401).json({ success: false, message: consumed.message });
        const user = await User.findById(consumed.record.userId);
        if (!user) return res.status(401).json({ success: false, message: 'User not found' });
        const token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '7d' });
        const newRefresh = await issueRefreshToken(user._id, { ip: req.ip });
        res.json({ success: true, token, refreshToken: newRefresh, user: safeUser(user) });
    } catch (error) {
        console.error('Token refresh failed:', error);
        res.status(500).json({ success: false, message: 'Unable to refresh session' });
    }
};

// active refresh session list + revoke (feature 6: session management).
const listSessions = async (req, res) => {
    try {
        const AuthToken = require('../models/AuthToken');
        const sessions = await AuthToken.find({ userId: req.user.id, kind: 'refresh', used: false, expiresAt: { $gt: new Date() } })
            .select('token meta createdAt expiresAt').lean();
        res.json({ success: true, sessions: sessions.map((s) => ({ id: s.token.slice(0, 12), createdAt: s.createdAt, expiresAt: s.expiresAt, ip: s.meta?.ip || '' })) });
    } catch (error) {
        console.error('Sessions list failed:', error);
        res.status(500).json({ success: false, message: 'Unable to load sessions' });
    }
};

const revokeAllSessions = async (req, res) => {
    try {
        const AuthToken = require('../models/AuthToken');
        await AuthToken.deleteMany({ userId: req.user.id, kind: 'refresh' });
        res.json({ success: true, message: 'All sessions revoked' });
    } catch (error) {
        console.error('Session revoke failed:', error);
        res.status(500).json({ success: false, message: 'Unable to revoke sessions' });
    }
};

// social login (Google/GitHub) — ID token verify kore notun/purono account e login.
// env key na thakle clear message return hoy.
const socialLogin = async (req, res) => {
    try {
        const { provider, email, name, avatar } = req.body;
        let idToken = req.body.idToken;
        if (!['google', 'github'].includes(provider)) return res.status(400).json({ success: false, message: 'Provider must be google or github' });

        let verifiedEmail = null;
        let verifiedName = name || '';
        let verifiedAvatar = avatar || '';
        if (provider === 'google') {
            if (!process.env.GOOGLE_CLIENT_ID) return res.status(501).json({ success: false, message: 'Google login is not configured (set GOOGLE_CLIENT_ID)' });
            if (!idToken) return res.status(400).json({ success: false, message: 'Google ID token required' });
            const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
            if (!response.ok) return res.status(401).json({ success: false, message: 'Invalid Google token' });
            const info = await response.json();
            if (info.aud !== process.env.GOOGLE_CLIENT_ID) return res.status(401).json({ success: false, message: 'Google token audience mismatch' });
            verifiedEmail = info.email;
            verifiedName = verifiedName || info.name || '';
            verifiedAvatar = verifiedAvatar || info.picture || '';
        } else {
            if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) return res.status(501).json({ success: false, message: 'GitHub login is not configured (set GITHUB_CLIENT_ID/SECRET)' });
            // frontend OAuth code pathay — secret backend e thakay, tai code theke access token nilam.
            if (!idToken && req.body.code) {
                const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                    body: JSON.stringify({
                        client_id: process.env.GITHUB_CLIENT_ID,
                        client_secret: process.env.GITHUB_CLIENT_SECRET,
                        code: req.body.code,
                        redirect_uri: req.body.redirectUri || `${process.env.FRONTEND_URL || ''}/login`
                    })
                });
                const tokenData = await tokenResponse.json();
                if (tokenData.access_token) idToken = tokenData.access_token;
            }
            if (!idToken) return res.status(400).json({ success: false, message: 'GitHub access token required' });
            const response = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${idToken}`, 'User-Agent': 'blood-connect' } });
            if (!response.ok) return res.status(401).json({ success: false, message: 'Invalid GitHub token' });
            const info = await response.json();
            verifiedEmail = info.email || `${info.login}@users.noreply.github.com`;
            verifiedName = verifiedName || info.name || info.login || '';
            verifiedAvatar = verifiedAvatar || info.avatar_url || '';
        }
        if (!verifiedEmail) return res.status(400).json({ success: false, message: 'Provider did not return an email' });

        let user = await User.findOne({ email: verifiedEmail.toLowerCase() });
        if (!user) {
            // social user er jonno temporary password + minimal profile create hoy.
            const tempPassword = require('crypto').randomBytes(24).toString('hex');
            user = await User.create({
                name: verifiedName || verifiedEmail.split('@')[0],
                email: verifiedEmail.toLowerCase(),
                password: await bcrypt.hash(tempPassword, 12),
                phone: `social-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                bloodGroup: 'O+',
                city: 'Dhaka',
                avatar: verifiedAvatar,
                emailVerified: true,
                isAvailable: false
            });
        }
        const token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '7d' });
        const refreshToken = await issueRefreshToken(user._id, { ip: req.ip, provider });
        res.json({ success: true, token, refreshToken, user: safeUser(user), isNewUser: !user.city });
    } catch (error) {
        console.error('Social login failed:', error);
        res.status(500).json({ success: false, message: 'Social login failed' });
    }
};

module.exports = {
    sendPhoneOtp, verifyPhoneOtp, sendEmailVerification, verifyEmail,
    forgotPassword, resetPassword, toggle2FA, confirm2FAEnable,
    beginLogin2FA, completeLogin2FA, issueRefreshToken, refreshSession,
    listSessions, revokeAllSessions, socialLogin
};
