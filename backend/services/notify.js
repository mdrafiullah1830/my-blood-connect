const nodemailer = require('nodemailer');
const Notification = require('../models/Notification');
const PushSubscription = require('../models/PushSubscription');

// ei adapter diye email patha hoy — env na thakle console-e log hoy (dev mode).
let transporter = null;
const getTransporter = () => {
    if (transporter !== null) return transporter;
    if (!process.env.SMTP_HOST) return null;
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
    });
    return transporter;
};

const sendEmail = async (to, subject, html) => {
    const transport = getTransporter();
    if (!transport) {
        console.log(`[email:dev] to=${to} subject=${subject}`);
        return { delivered: false, mode: 'console' };
    }
    await transport.sendMail({ from: process.env.SMTP_FROM || 'Blood Connect <no-reply@bloodconnect.local>', to, subject, html });
    return { delivered: true, mode: 'smtp' };
};

// SMS adapter — Twilio env thakle real SMS, na hole console-e OTP/log.
const sendSms = async (to, body) => {
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        const sid = process.env.TWILIO_ACCOUNT_SID;
        const token = process.env.TWILIO_AUTH_TOKEN;
        const from = process.env.TWILIO_FROM;
        const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({ To: to, From: from, Body: body })
        });
        if (!response.ok) throw new Error(`Twilio SMS failed: ${response.status}`);
        return { delivered: true, mode: 'twilio' };
    }
    console.log(`[sms:dev] to=${to} body=${body}`);
    return { delivered: false, mode: 'console' };
};

// browser push subscription e payload pathano — web-push lib VAPID key use kore.
const sendPush = async (userId, payload) => {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return { delivered: false, mode: 'disabled' };
    const webpush = require('web-push');
    webpush.setVapidDetails('mailto:' + (process.env.VAPID_SUBJECT || 'admin@bloodconnect.local'), process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    const subs = await PushSubscription.find({ userId }).lean();
    let delivered = 0;
    await Promise.all(subs.map(async (sub) => {
        try {
            await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload));
            delivered += 1;
        } catch (error) {
            if (error.statusCode === 404 || error.statusCode === 410) await PushSubscription.deleteOne({ endpoint: sub.endpoint });
        }
    }));
    return { delivered, mode: 'webpush' };
};

// core notify function — in-app notification save + socket + email + push ek sathe handle kore.
const notify = async (io, userId, { type = 'system', title, message, link = '', email = false, push = true }) => {
    try {
        const notification = await Notification.create({ userId, type, title, message, link });
        if (io) io.to(`user:${userId}`).emit('notification', notification);
        if (push) await sendPush(userId, { title, message, link, tag: type });
        if (email) {
            const user = await require('../models/User').findById(userId).select('email').lean();
            if (user?.email) await sendEmail(user.email, title, `<p>${message}</p>`);
        }
        return notification;
    } catch (error) {
        console.error('notify failed:', error.message);
        return null;
    }
};

const notifyMany = async (io, userIds, payload) => Promise.all(userIds.map((id) => notify(io, id, payload)));

module.exports = { notify, notifyMany, sendEmail, sendSms, sendPush };
