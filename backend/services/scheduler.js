const BloodRequest = require('../models/BloodRequest');
const User = require('../models/User');
const { notify, notifyMany, sendEmail } = require('./notify');
const { donorsFor } = require('./bloodCompatibility');

const HOUR = 60 * 60 * 1000;

// emergency request 30 min e kono donor accept na korle next tier donor-der notun kore notify kore.
// ei process 3 bar (level 3 porjonto) chole — escalation level BloodRequest e store hoy.
const escalateRequest = async (io, request) => {
    if (request.escalationLevel >= 3 || request.status !== 'pending') return null;
    const level = request.escalationLevel + 1;
    const recipient = await User.findById(request.recipientId).select('district city division').lean();
    const areaConditions = [];
    if (level === 1 && recipient?.district) areaConditions.push({ district: recipient.district });
    if (level <= 2 && recipient?.city) areaConditions.push({ city: recipient.city });
    if (recipient?.division) areaConditions.push({ division: recipient.division });
    const donors = await User.find({
        bloodGroup: request.bloodGroup,
        isAvailable: true,
        _id: { $nin: request.responses.map((r) => r.donorId), $ne: request.recipientId },
        ...(areaConditions.length ? { $or: areaConditions } : {})
    }).select('_id').lean();
    const donorIds = donors.map((d) => d._id);
    if (donorIds.length) {
        await BloodRequest.updateOne({ _id: request._id }, {
            $addToSet: { responses: { $each: donorIds.map((id) => ({ donorId: id, status: 'pending' })) } },
            $set: { escalationLevel: level, escalatedAt: new Date() }
        });
        await notifyMany(io, donorIds, {
            type: 'escalation',
            title: 'Urgent blood request escalated',
            message: `${request.bloodGroup} blood needed at ${request.hospitalName} — level ${level} alert.`,
            link: '/requests'
        });
    }
    return level;
};

// 30+ min purono pending emergency request gulo check kore escalate kore.
const runEscalationSweep = async (io) => {
    const stale = await BloodRequest.find({
        requestType: { $in: ['emergency', null] },
        status: 'pending',
        escalationLevel: { $lt: 3 },
        $or: [{ escalatedAt: null }, { escalatedAt: { $lt: new Date(Date.now() - 30 * 60 * 1000) } }],
        postedAt: { $lt: new Date(Date.now() - 30 * 60 * 1000) },
        neededTime: { $gt: new Date() }
    }).limit(50).lean();
    for (const request of stale) await escalateRequest(io, request);
    return stale.length;
};

// pending request donor-der ek ghonta age reminder pathay.
const runRequestReminders = async (io) => {
    const cutoff = new Date(Date.now() - HOUR);
    const requests = await BloodRequest.find({
        status: 'pending',
        neededTime: { $gt: new Date() },
        $or: [{ reminderSentAt: null }, { reminderSentAt: { $lt: cutoff } }]
    }).limit(50).lean();
    for (const request of requests) {
        const pendingDonors = request.responses.filter((r) => r.status === 'pending').map((r) => r.donorId);
        if (pendingDonors.length) {
            await notifyMany(io, pendingDonors, {
                type: 'reminder',
                title: 'Blood request reminder',
                message: `${request.bloodGroup} bag needed at ${request.hospitalName} — please respond if you can help.`,
                link: '/requests'
            });
        }
        await BloodRequest.updateOne({ _id: request._id }, { $set: { reminderSentAt: new Date() } });
    }
    return requests.length;
};

// 90 din por donor abar eligible — tokhon auto reminder + eligibility flag update.
const runDonationEligibilityReminders = async (io) => {
    const cutoff = new Date(Date.now() - 90 * 24 * HOUR);
    const donors = await User.find({
        lastDonationDate: { $lte: cutoff, $ne: null },
        $or: [{ 'meta.eligibilityNotified': { $exists: false } }]
    }).limit(50).lean();
    const eligible = await User.find({
        lastDonationDate: { $lte: cutoff, $ne: null },
        isAvailable: false
    }).select('_id email name').limit(100).lean();
    for (const donor of eligible) {
        await notify(io, donor._id, {
            type: 'reminder',
            title: 'You are eligible to donate again!',
            message: '90 days have passed since your last donation. Update your availability to help someone in need.',
            link: '/dashboard'
        });
    }
    return donors.length + eligible.length;
};

// daily digest — notun emergency request summary email (dev mode e console).
const runDailyDigest = async () => {
    const since = new Date(Date.now() - 24 * HOUR);
    const newRequests = await BloodRequest.countDocuments({ requestType: { $in: ['emergency', null] }, postedAt: { $gte: since } });
    const fulfilled = await BloodRequest.countDocuments({ status: 'fulfilled', postedAt: { $gte: since } });
    if (newRequests === 0 && fulfilled === 0) return null;
    const html = `<h2>Blood Connect — Last 24h digest</h2><p>New emergency requests: <strong>${newRequests}</strong></p><p>Fulfilled requests: <strong>${fulfilled}</strong></p>`;
    if (process.env.DIGEST_EMAIL) await sendEmail(process.env.DIGEST_EMAIL, 'Blood Connect daily digest', html);
    else console.log(`[digest:dev] requests=${newRequests} fulfilled=${fulfilled}`);
    return { newRequests, fulfilled };
};

// ei function ta server start e interval diye call hoy — saragulo background sweep.
const startScheduler = (io) => {
    if (process.env.DISABLE_SCHEDULER === 'true') return null;
    const timers = [];
    timers.push(setInterval(() => runEscalationSweep(io).catch((e) => console.error('escalation:', e.message)), 5 * 60 * 1000));
    timers.push(setInterval(() => runRequestReminders(io).catch((e) => console.error('reminders:', e.message)), 15 * 60 * 1000));
    timers.push(setInterval(() => runDonationEligibilityReminders(io).catch((e) => console.error('eligibility:', e.message)), 6 * HOUR));
    timers.push(setInterval(() => runDailyDigest().catch((e) => console.error('digest:', e.message)), 24 * HOUR));
    timers.forEach((t) => t.unref?.());
    return timers;
};

module.exports = { escalateRequest, runEscalationSweep, runRequestReminders, runDonationEligibilityReminders, runDailyDigest, startScheduler };
