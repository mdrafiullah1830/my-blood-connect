const User = require('../models/User');
const BloodRequest = require('../models/BloodRequest');
const GeoAlert = require('../models/GeoAlert');
const { notify } = require('../services/notify');
const { haversineKm } = require('./donorController');

// heatmap: available donor gulo district bhaag kore count — map e density circle dekhay.
const donorHeatmap = async (req, res) => {
    try {
        const base = { isAvailable: true };
        if (req.query.bloodGroup && req.query.bloodGroup !== 'All') base.bloodGroup = req.query.bloodGroup;
        const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        base.$or = [{ lastDonationDate: null }, { lastDonationDate: { $lte: cutoff } }];

        const grouped = await User.aggregate([
            { $match: base },
            { $group: { _id: { district: '$district', city: '$city', bloodGroup: '$bloodGroup' }, count: { $sum: 1 } } },
            { $group: { _id: { district: '$_id.district', city: '$_id.city' }, total: { $sum: '$count' }, groups: { $push: { bloodGroup: '$_id.bloodGroup', count: '$count' } } } },
            { $match: { total: { $gte: 1 } } },
            { $sort: { total: -1 } },
            { $limit: 200 }
        ]);

        // prtyek district er centroid approx janno map e circle place kora jay.
        const withCoords = await Promise.all(grouped.map(async (row) => {
            const sample = await User.findOne({ district: row._id.district, isAvailable: true, location: { $exists: true } })
                .select('location').lean();
            return {
                district: row._id.district || '',
                city: row._id.city || '',
                total: row.total,
                groups: row.groups,
                coordinates: sample?.location?.coordinates || null
            };
        }));
        res.json({ success: true, heatmap: withCoords.filter((r) => r.coordinates) });
    } catch (error) {
        console.error('Heatmap failed:', error);
        res.status(500).json({ success: false, message: 'Unable to build heatmap' });
    }
};

// geofence: donor er notun location er sathe active emergency request er location milay,
// jodi radius e dhuke jay tahole recipient ke turant notify kore (feature 37).
const checkGeofence = async (req, res) => {
    try {
        const { latitude, longitude } = req.body;
        const lat = Number(latitude);
        const lng = Number(longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return res.status(400).json({ success: false, message: 'Valid latitude and longitude required' });
        }
        const user = await User.findById(req.user.id).select('bloodGroup isAvailable lastDonationDate').lean();
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        // donor eligible + available + same blood group na hole kono alert ashbe na.
        const eligible = user.isAvailable && (!user.lastDonationDate || new Date(user.lastDonationDate) <= new Date(Date.now() - 90 * 86400000));
        if (!eligible) return res.json({ success: true, alerts: [] });

        const activeRequests = await BloodRequest.find({
            status: 'pending',
            bloodGroup: user.bloodGroup,
            requestType: { $in: ['emergency', null] },
            recipientId: { $ne: req.user.id },
            neededTime: { $gt: new Date() },
            'recipientLocation.coordinates': { $exists: true }
        }).select('recipientId hospitalName bloodGroup bagsRequired neededTime recipientLocation shareToken').lean();

        const alerts = [];
        for (const request of activeRequests) {
            const [reqLng, reqLat] = request.recipientLocation.coordinates;
            const distanceKm = haversineKm(lat, lng, reqLat, reqLng);
            const radiusKm = 2;
            if (distanceKm <= radiusKm) {
                const existing = await GeoAlert.findOne({ requestId: request._id, donorId: req.user.id });
                if (!existing) {
                    await GeoAlert.create({ requestId: request._id, recipientId: request.recipientId, donorId: req.user.id, radiusMeters: radiusKm * 1000, notifiedAt: new Date() });
                    const io = req.app.get('socketio');
                    await notify(io, request.recipientId, {
                        type: 'geofence',
                        title: 'A compatible donor is nearby!',
                        message: `An eligible ${user.bloodGroup} donor entered 2 km of ${request.hospitalName}.`,
                        link: '/requests'
                    });
                    await notify(io, req.user.id, {
                        type: 'geofence',
                        title: 'You are near a blood request',
                        message: `${request.bloodGroup} needed at ${request.hospitalName} — you are within 2 km.`,
                        link: '/requests'
                    });
                    alerts.push({ requestId: request._id, distanceKm: Number(distanceKm.toFixed(2)), hospitalName: request.hospitalName });
                }
            }
        }
        res.json({ success: true, alerts });
    } catch (error) {
        console.error('Geofence check failed:', error);
        res.status(500).json({ success: false, message: 'Geofence check failed' });
    }
};

// live donor movement: shareLiveLocation enabled donor-er notun coordinate
// city room e broadcast kore jate map e move korte pare (feature 38).
const streamLocation = async (req, res) => {
    try {
        const { latitude, longitude, accuracy } = req.body;
        const lat = Number(latitude);
        const lng = Number(longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ success: false, message: 'Valid coordinates required' });
        const user = await User.findByIdAndUpdate(req.user.id, {
            location: { type: 'Point', coordinates: [lng, lat] },
            locationUpdatedAt: new Date(),
            locationAccuracy: Number.isFinite(Number(accuracy)) ? Math.max(0, Number(accuracy)) : null
        }, { new: true }).select('name city shareLiveLocation location').lean();
        const io = req.app.get('socketio');
        if (io && user.shareLiveLocation && user.city) {
            io.to(`city:${user.city}`).emit('donor_location_update', {
                donorId: req.user.id,
                name: user.name,
                coordinates: [lng, lat],
                updatedAt: new Date()
            });
        }
        res.json({ success: true, streaming: Boolean(user.shareLiveLocation) });
    } catch (error) {
        console.error('Location stream failed:', error);
        res.status(500).json({ success: false, message: 'Unable to stream location' });
    }
};

module.exports = { donorHeatmap, checkGeofence, streamLocation };
