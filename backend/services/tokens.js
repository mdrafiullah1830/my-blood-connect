const crypto = require('crypto');
const AuthToken = require('../models/AuthToken');
const { sendSms, sendEmail } = require('./notify');

const OTP_MINUTES = Number(process.env.OTP_MINUTES) || 10;
const OTP_LENGTH = 6;

const generateCode = () => String(crypto.randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
const generateToken = () => crypto.randomBytes(32).toString('hex');

// OTP create kore store + channel (sms/email) diye pathay.
const issueOtp = async ({ userId, kind, destination, channel, purpose }) => {
    const code = generateCode();
    const token = generateToken();
    const expiresAt = new Date(Date.now() + OTP_MINUTES * 60 * 1000);
    await AuthToken.deleteMany({ userId, kind, used: false });
    await AuthToken.create({ userId, kind, token, code, expiresAt, meta: { purpose } });
    const body = `Your Blood Connect ${purpose || 'verification'} code is ${code}. It expires in ${OTP_MINUTES} minutes.`;
    if (channel === 'sms') await sendSms(destination, body);
    else await sendEmail(destination, `Blood Connect ${purpose || 'verification'} code`, `<p>${body}</p>`);
    return { token, expiresAt };
};

// code verify kore — bhul hole attempt count, correct hole token use hoye jay.
const verifyOtp = async ({ userId, kind, token, code, maxAttempts = 5 }) => {
    const record = await AuthToken.findOne({ userId, kind, used: false, ...(token ? { token } : {}) }).sort({ createdAt: -1 });
    if (!record) return { ok: false, message: 'Code not found or already used' };
    if (record.expiresAt < new Date()) return { ok: false, message: 'Code expired' };
    const attempts = Number(record.meta?.attempts || 0);
    if (attempts >= maxAttempts) {
        await record.deleteOne();
        return { ok: false, message: 'Too many failed attempts. Request a new code.' };
    }
    if (String(code) !== String(record.code)) {
        record.meta = { ...record.meta, attempts: attempts + 1 };
        await record.save();
        return { ok: false, message: 'Invalid code' };
    }
    record.used = true;
    await record.save();
    return { ok: true, record };
};

// generic signed token (password reset, email verify, refresh session).
const issueToken = async ({ userId, kind, ttlMinutes = 60, meta = {} }) => {
    const token = generateToken();
    await AuthToken.create({ userId, kind, token, expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000), meta });
    return token;
};

const consumeToken = async ({ userId, kind, token }) => {
    const record = await AuthToken.findOne({ userId, kind, token, used: false });
    if (!record) return { ok: false, message: 'Invalid or expired link' };
    if (record.expiresAt < new Date()) return { ok: false, message: 'Link expired' };
    record.used = true;
    await record.save();
    return { ok: true, record };
};

module.exports = { issueOtp, verifyOtp, issueToken, consumeToken, generateToken };
