const User = require('../models/User');
const BloodRequest = require('../models/BloodRequest');
const Donation = require('../models/Donation');

// public leaderboard — donation count, rating diye top donor list.
const leaderboard = async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit) || 20, 50);
        const donors = await User.find({ donationCount: { $gt: 0 } })
            .select('name bloodGroup city division district donationCount ratingSum ratingCount avatar verified')
            .sort({ donationCount: -1, ratingSum: -1 })
            .limit(limit)
            .lean();
        const shaped = donors.map((d, index) => ({
            rank: index + 1,
            id: d._id,
            name: d.name,
            bloodGroup: d.bloodGroup,
            city: d.city,
            district: d.district,
            verified: d.verified,
            avatar: d.avatar,
            donationCount: d.donationCount,
            rating: d.ratingCount ? Number((d.ratingSum / d.ratingCount).toFixed(1)) : 0
        }));
        res.json({ success: true, leaderboard: shaped });
    } catch (error) {
        console.error('Leaderboard failed:', error);
        res.status(500).json({ success: false, message: 'Unable to load leaderboard' });
    }
};

// real impact metrics — live counts theke lives saved estimate (1 donation ~ 3 lives).
const impactMetrics = async (req, res) => {
    try {
        const [donors, available, totalDonations, fulfilled, activeRequests, savedBags] = await Promise.all([
            User.countDocuments({}),
            User.countDocuments({ isAvailable: true }),
            Donation.countDocuments({}),
            BloodRequest.countDocuments({ status: 'fulfilled' }),
            BloodRequest.countDocuments({ status: 'pending', neededTime: { $gt: new Date() } }),
            Donation.aggregate([{ $group: { _id: null, bags: { $sum: '$bags' } } }])
        ]);
        const bags = savedBags[0]?.bags || 0;
        res.json({
            success: true,
            metrics: {
                registeredDonors: donors,
                availableDonors: available,
                totalDonations: bags || totalDonations,
                fulfilledRequests: fulfilled,
                activeRequests,
                livesSaved: (bags || totalDonations) * 3
            }
        });
    } catch (error) {
        console.error('Impact metrics failed:', error);
        res.status(500).json({ success: false, message: 'Unable to load metrics' });
    }
};

// analytics dashboard data — monthly trend, blood group distribution, area demand.
const analyticsDashboard = async (req, res) => {
    try {
        const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const [monthly, byBloodGroup, byArea, donorGrowth, topHospitals] = await Promise.all([
            Donation.aggregate([
                { $match: { donatedAt: { $gte: since } } },
                { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$donatedAt' } }, donations: { $sum: 1 }, bags: { $sum: '$bags' } } },
                { $sort: { _id: 1 } }
            ]),
            BloodRequest.aggregate([
                { $match: { postedAt: { $gte: since } } },
                { $group: { _id: '$bloodGroup', requests: { $sum: 1 }, fulfilled: { $sum: { $cond: [{ $eq: ['$status', 'fulfilled'] }, 1, 0] } } } },
                { $sort: { requests: -1 } }
            ]),
            BloodRequest.aggregate([
                { $match: { postedAt: { $gte: since } } },
                { $lookup: { from: 'users', localField: 'recipientId', foreignField: '_id', as: 'recipient' } },
                { $unwind: '$recipient' },
                { $group: { _id: '$recipient.district', requests: { $sum: 1 }, fulfilled: { $sum: { $cond: [{ $eq: ['$status', 'fulfilled'] }, 1, 0] } } } },
                { $sort: { requests: -1 } },
                { $limit: 15 }
            ]),
            User.aggregate([
                { $match: { createdAt: { $gte: since } } },
                { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, users: { $sum: 1 } } },
                { $sort: { _id: 1 } }
            ]),
            BloodRequest.aggregate([
                { $match: { postedAt: { $gte: since }, status: 'fulfilled' } },
                { $group: { _id: '$hospitalName', fulfilled: { $sum: 1 } } },
                { $sort: { fulfilled: -1 } },
                { $limit: 10 }
            ])
        ]);
        res.json({ success: true, analytics: { monthly, byBloodGroup, byArea, donorGrowth, topHospitals } });
    } catch (error) {
        console.error('Analytics failed:', error);
        res.status(500).json({ success: false, message: 'Unable to load analytics' });
    }
};

module.exports = { leaderboard, impactMetrics, analyticsDashboard };
