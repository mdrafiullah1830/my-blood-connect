const User = require('../models/User');
const { donorsFor } = require('../services/bloodCompatibility');

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const GPS_FRESH_MS = 2 * 24 * 60 * 60 * 1000;
const toBoundedNumber = (value, min, max) => {
    if (value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= min && number <= max ? number : null;
};

const isEligible = (donor) => !donor.lastDonationDate || (Date.now() - new Date(donor.lastDonationDate).getTime() >= NINETY_DAYS_MS);
const isFreshLocation = (donor, now = Date.now()) => {
    if (!donor.locationUpdatedAt || donor.location?.coordinates?.length !== 2) return false;
    const age = now - new Date(donor.locationUpdatedAt).getTime();
    return Number.isFinite(age) && age >= 0 && age <= GPS_FRESH_MS;
};

const parseSearchType = (value) => value === 'gps' ? 'gps' : value === 'profile' ? 'profile' : null;

const addSelectedAreaFilters = (query, filters) => {
    if (filters.division && filters.division !== 'All') query.division = filters.division;
    if (filters.district && filters.district !== 'All') query.district = filters.district;
    if (filters.thana && filters.thana !== 'All') query.thana = filters.thana;
    return query;
};

const haversineKm = (lat1, lon1, lat2, lon2) => {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// availability slot filter: donor er weekly slot er sathe query time match kore.
const matchesAvailabilitySlot = (donor, dayFilter, timeFilter) => {
    if (!dayFilter && !timeFilter) return true;
    const slots = donor.availabilitySlots || [];
    if (!slots.length) return false;
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return slots.some((slot) => {
        if (dayFilter && slot.day !== dayFilter) return false;
        if (timeFilter) {
            const [hours, minutes] = timeFilter.split(':').map(Number);
            const minutesOfDay = (hours || 0) * 60 + (minutes || 0);
            const [fromH, fromM] = String(slot.from || '00:00').split(':').map(Number);
            const [toH, toM] = String(slot.to || '23:59').split(':').map(Number);
            const from = (fromH || 0) * 60 + (fromM || 0);
            const to = (toH || 0) * 60 + (toM || 0);
            if (minutesOfDay < from || minutesOfDay > to) return false;
        }
        if (!dayFilter && !timeFilter) return true;
        if (dayFilter && !timeFilter) return true;
        return true;
    }) && (!dayFilter || days.includes(dayFilter));
};

// blood group, availability, location based matching donor khujar jonno ei controller use kora hoy.
// emergency board e live GPS search ar profile-based search—dui rokom search ei section handle kore.
// compatible=true dile O- universal donor somet shob compatible group donor fire ashe.
const searchDonors = async (req, res) => {
    try {
        const {
            bloodGroup, division, district, thana, city, lat, lng, searchType,
            eligibleOnly = 'true', availableOnly = 'true',
            compatible = 'false', radiusKm, sortBy = 'distance',
            availableDay, availableTime, verifiedOnly = 'false'
        } = req.query;
        const filters = { division, district, thana };
        const baseQuery = { _id: { $ne: req.user.id } };
        if (bloodGroup && bloodGroup !== 'All') {
            // compatibility mode: jodi compatible=true hoy, tahole shei group-e donate korte parbe shob donor.
            baseQuery.bloodGroup = compatible === 'true' ? { $in: donorsFor(bloodGroup) } : bloodGroup;
        }
        if (city && city !== 'All') baseQuery.city = city;
        if (availableOnly !== 'false') baseQuery.isAvailable = true;
        if (verifiedOnly === 'true') baseQuery.verified = true;
        if (eligibleOnly !== 'false') {
            const cutoff = new Date(Date.now() - NINETY_DAYS_MS);
            baseQuery.$and = [{ $or: [{ lastDonationDate: null }, { lastDonationDate: { $lte: cutoff } }] }];
        }

        const requestedSearchType = parseSearchType(searchType);
        if (!requestedSearchType) {
            return res.status(400).json({ success:false, message:'Choose Search with Live GPS or Search without GPS' });
        }
        const latitude = Number(lat);
        const longitude = Number(lng);
        const hasValidCoordinates = lat !== undefined && lng !== undefined && Number.isFinite(latitude) && Number.isFinite(longitude) &&
            latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
        if (requestedSearchType === 'gps' && !hasValidCoordinates) {
            return res.status(400).json({ success:false, message:'Live GPS search requires valid recipient coordinates' });
        }
        const hasGps = requestedSearchType === 'gps';
        const now = Date.now();
        const gpsCutoff = new Date(now - GPS_FRESH_MS);
        const selectFields = 'name bloodGroup division district thana city location locationUpdatedAt locationAccuracy lastDonationDate isAvailable ratingSum ratingCount availabilitySlots verified avatar donationCount';
        let rawDonors = [];

        if (hasGps) {
            const freshQuery = {
                ...baseQuery,
                locationUpdatedAt: { $gte: gpsCutoff },
                location: {
                    $near: {
                        $geometry: { type: 'Point', coordinates: [longitude, latitude] }
                    }
                }
            };
            addSelectedAreaFilters(freshQuery, filters);

            const staleQuery = { ...baseQuery, $and: [...(baseQuery.$and || []), { $or: [
                { locationUpdatedAt: null },
                { locationUpdatedAt: { $exists: false } },
                { locationUpdatedAt: { $lt: gpsCutoff } }
            ] }] };
            // Stale/missing GPS donors still remain searchable by their saved
            // profile address. "All" must not silently restrict them to the
            // recipient's own thana; only explicitly selected areas filter them.
            addSelectedAreaFilters(staleQuery, filters);
            const freshDonors = await User.find(freshQuery).select(selectFields).lean();
            const staleDonors = await User.find(staleQuery).select(selectFields).lean();
            rawDonors = [
                ...freshDonors.map((donor) => ({ ...donor, locationSource: 'gps' })),
                ...staleDonors.map((donor) => ({ ...donor, locationSource: 'profile' }))
            ];
        } else {
            const profileQuery = { ...baseQuery };
            // Without GPS, apply only the filters explicitly chosen by the
            // recipient. Never auto-fill missing levels from their profile.
            addSelectedAreaFilters(profileQuery, filters);
            rawDonors = (await User.find(profileQuery).select(selectFields).lean())
                .map((donor) => ({ ...donor, locationSource: 'profile' }));
        }

        const unique = new Map(rawDonors.map((donor) => [String(donor._id), donor]));
        let donors = [...unique.values()].map((donor) => {
            const coordinates = donor.location?.coordinates || [];
            let distanceKm = null;
            if (donor.locationSource === 'gps' && isFreshLocation(donor, now)) {
                const [lon, latValue] = coordinates;
                distanceKm = haversineKm(latitude, longitude, latValue, lon);
            }
            const { lastDonationDate, ...publicDonor } = donor;
            if (publicDonor.locationSource === 'profile') delete publicDonor.location;
            return {
                ...publicDonor,
                eligible: isEligible(donor),
                rating: donor.ratingCount ? Number((donor.ratingSum / donor.ratingCount).toFixed(1)) : 0,
                gpsExpiresAt: donor.locationSource === 'gps' ? new Date(new Date(donor.locationUpdatedAt).getTime() + GPS_FRESH_MS) : null,
                distanceKm: distanceKm === null ? null : Number(distanceKm.toFixed(2))
            };
        });

        // radius slider: km limit diye filter (distance na thakle profile address thakle rakha hoy).
        const radius = toBoundedNumber(radiusKm, 1, 500);
        if (radius && hasGps) donors = donors.filter((d) => d.distanceKm === null || d.distanceKm <= radius);

        // availability time slot filter.
        if (availableDay || availableTime) {
            donors = donors.filter((d) => matchesAvailabilitySlot(d, availableDay, availableTime));
        }

        // sort: distance (default), rating, donationCount, recent (last donation age beshi hole age).
        const sorters = {
            distance: (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity),
            rating: (a, b) => (b.rating || 0) - (a.rating || 0),
            donations: (a, b) => (b.donationCount || 0) - (a.donationCount || 0),
            recent: (a, b) => new Date(a._lastDonationSort || 0) - new Date(b._lastDonationSort || 0)
        };
        // lastDonationDate private — sort er jonno age ready rakhi.
        const lastDonationBy = new Map([...unique.values()].map((d) => [String(d._id), d.lastDonationDate || null]));
        donors.forEach((d) => { d._lastDonationSort = lastDonationBy.get(String(d._id)) || null; });
        const comparator = sorters[sortBy] || sorters.distance;
        donors.sort(comparator);
        donors.forEach((d) => delete d._lastDonationSort);

        res.json({ success: true, total: donors.length, searchMode: hasGps ? 'gps' : 'profile', gpsFreshHours: 48, donors });
    } catch (error) {
        console.error('Donor search failed:', error);
        res.status(500).json({ success: false, message: 'Unable to search donors' });
    }
};

module.exports = { searchDonors, isEligible, isFreshLocation, parseSearchType, addSelectedAreaFilters, toBoundedNumber, haversineKm, matchesAvailabilitySlot, GPS_FRESH_MS };
