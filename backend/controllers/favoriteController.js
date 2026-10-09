const mongoose = require('mongoose');
const Favorite = require('../models/Favorite');
const User = require('../models/User');
const Review = require('../models/Review');

// favorite donor list — rating/eligibility shoho populate kore.
const listFavorites = async (req, res) => {
    try {
        const favorites = await Favorite.find({ userId: req.user.id }).sort({ createdAt: -1 }).lean();
        const donorIds = favorites.map((f) => f.donorId);
        const donors = await User.find({ _id: { $in: donorIds } })
            .select('name bloodGroup city division district thana isAvailable lastDonationDate ratingSum ratingCount avatar verified')
            .lean();
        const donorMap = new Map(donors.map((d) => [String(d._id), d]));
        const shaped = favorites.map((f) => {
            const donor = donorMap.get(String(f.donorId));
            if (!donor) return null;
            const eligible = !donor.lastDonationDate || (Date.now() - new Date(donor.lastDonationDate).getTime() >= 90 * 86400000);
            return { favoriteId: f._id, addedAt: f.createdAt, ...donor, eligible, rating: donor.ratingCount ? Number((donor.ratingSum / donor.ratingCount).toFixed(1)) : 0 };
        }).filter(Boolean);
        res.json({ success: true, favorites: shaped });
    } catch (error) {
        console.error('Favorites read failed:', error);
        res.status(500).json({ success: false, message: 'Unable to load favorites' });
    }
};

const addFavorite = async (req, res) => {
    try {
        const { donorId } = req.body;
        if (!mongoose.isValidObjectId(donorId)) return res.status(400).json({ success: false, message: 'Invalid donor id' });
        if (String(donorId) === String(req.user.id)) return res.status(400).json({ success: false, message: 'Cannot favorite yourself' });
        const donor = await User.findById(donorId).select('_id').lean();
        if (!donor) return res.status(404).json({ success: false, message: 'Donor not found' });
        await Favorite.updateOne({ userId: req.user.id, donorId }, { $setOnInsert: { userId: req.user.id, donorId } }, { upsert: true });
        res.status(201).json({ success: true, message: 'Donor saved to favorites' });
    } catch (error) {
        if (error?.code === 11000) return res.json({ success: true, message: 'Donor already in favorites' });
        console.error('Favorite add failed:', error);
        res.status(500).json({ success: false, message: 'Unable to save favorite' });
    }
};

const removeFavorite = async (req, res) => {
    try {
        const { donorId } = req.params;
        await Favorite.deleteOne({ userId: req.user.id, donorId });
        res.json({ success: true, message: 'Removed from favorites' });
    } catch (error) {
        console.error('Favorite remove failed:', error);
        res.status(500).json({ success: false, message: 'Unable to remove favorite' });
    }
};

// donor rating — prithibi review (unique per reviewer-donor pair), average calculate hoy.
const listReviews = async (req, res) => {
    try {
        const { donorId } = req.params;
        if (!mongoose.isValidObjectId(donorId)) return res.status(400).json({ success: false, message: 'Invalid donor id' });
        const reviews = await Review.find({ donorId }).populate('reviewerId', 'name avatar').sort({ createdAt: -1 }).limit(50).lean();
        const donor = await User.findById(donorId).select('ratingSum ratingCount').lean();
        const average = donor?.ratingCount ? Number((donor.ratingSum / donor.ratingCount).toFixed(1)) : 0;
        res.json({ success: true, reviews, average, total: donor?.ratingCount || 0 });
    } catch (error) {
        console.error('Reviews read failed:', error);
        res.status(500).json({ success: false, message: 'Unable to load reviews' });
    }
};

const createReview = async (req, res) => {
    try {
        const { donorId } = req.params;
        const { rating, comment = '', requestId = null } = req.body;
        const ratingNum = Number(rating);
        if (!mongoose.isValidObjectId(donorId)) return res.status(400).json({ success: false, message: 'Invalid donor id' });
        if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) return res.status(400).json({ success: false, message: 'Rating must be 1-5' });
        if (String(donorId) === String(req.user.id)) return res.status(400).json({ success: false, message: 'Cannot review yourself' });
        const donor = await User.findById(donorId).select('_id').lean();
        if (!donor) return res.status(404).json({ success: false, message: 'Donor not found' });

        const existing = await Review.findOne({ donorId, reviewerId: req.user.id });
        if (existing) {
            const diff = ratingNum - existing.rating;
            existing.rating = ratingNum;
            existing.comment = String(comment).slice(0, 300);
            existing.createdAt = new Date();
            await existing.save();
            await User.updateOne({ _id: donorId }, { $inc: { ratingSum: diff } });
            return res.json({ success: true, message: 'Review updated', review: existing });
        }

        const review = await Review.create({ donorId, reviewerId: req.user.id, requestId, rating: ratingNum, comment: String(comment).slice(0, 300) });
        await User.updateOne({ _id: donorId }, { $inc: { ratingSum: ratingNum, ratingCount: 1 } });
        res.status(201).json({ success: true, message: 'Review submitted', review });
    } catch (error) {
        if (error?.code === 11000) return res.status(409).json({ success: false, message: 'You already reviewed this donor' });
        console.error('Review create failed:', error);
        res.status(500).json({ success: false, message: 'Unable to submit review' });
    }
};

module.exports = { listFavorites, addFavorite, removeFavorite, listReviews, createReview };
