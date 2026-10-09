const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ei helper diye password-sahito sensitive field remove kore frontend-ke safe user data return kora hoy.
// ei vabe profile information dekhano thake, kintu confidential data API response e expose hoy na.
const safeUser = (user) => ({
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role === 'admin' ? 'admin' : 'user',
    bloodGroup: user.bloodGroup,
    age: user.age,
    weight: user.weight,
    division: user.division,
    district: user.district,
    thana: user.thana,
    city: user.city,
    nidDocument: user.nidDocument,
    birthCertificateDocument: user.birthCertificateDocument,
    avatar: user.avatar || '',
    verified: Boolean(user.verified),
    emailVerified: Boolean(user.emailVerified),
    phoneVerified: Boolean(user.phoneVerified),
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
    preferredLanguage: user.preferredLanguage || 'en',
    health: user.health || {},
    availabilitySlots: user.availabilitySlots || [],
    donationCount: user.donationCount || 0,
    rating: user.ratingCount ? Number((user.ratingSum / user.ratingCount).toFixed(1)) : 0,
    ratingCount: user.ratingCount || 0,
    shareLiveLocation: Boolean(user.shareLiveLocation),
    location: user.location,
    locationUpdatedAt: user.locationUpdatedAt,
    locationAccuracy: user.locationAccuracy,
    lastDonationDate: user.lastDonationDate,
    isAvailable: user.isAvailable,
    createdAt: user.createdAt
});

const validateCoordinates = (latitude, longitude) => {
    if (latitude === undefined || longitude === undefined || latitude === '' || longitude === '') return null;
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return [lng, lat];
};

const hasCoordinateInput = (latitude, longitude) =>
    latitude !== undefined || longitude !== undefined;

const sendServerError = (res, label, error) => {
    console.error(`${label}:`, error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
};

// notun user account create korar somoy ei controller use kora hoy.
// ei kothay input validation, password hashing, ar MongoDB e user profile store kora hoy.
const registerUser = async (req, res) => {
    try {
        const {
            name, email, password, phone, bloodGroup, age, weight,
            division, district, thana, city, latitude, longitude, accuracy,
            nidDocument, birthCertificateDocument, isAvailable
        } = req.body;

        if (!name || !email || !password || !phone || !bloodGroup || !division || !district || !thana || !city) {
            return res.status(400).json({ success: false, message: 'Name, email, password, phone, blood group, division, district, thana and city are required' });
        }
        const normalizedEmail = String(email).toLowerCase().trim();
        const normalizedPhone = String(phone).trim();
        if (!EMAIL_PATTERN.test(normalizedEmail)) {
            return res.status(400).json({ success: false, message: 'A valid email is required' });
        }
        if (typeof password !== 'string' || password.length < 8) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
        }
        const wantsToBeAvailable = isAvailable === true || isAvailable === 'true';
        if (wantsToBeAvailable && (!Number(age) || !Number(weight))) {
            return res.status(400).json({ success:false, message:'Age and weight are required to register as an available donor' });
        }
        const [existingEmail, existingPhone] = await Promise.all([
            User.findOne({ email: normalizedEmail }),
            User.findOne({ phone: normalizedPhone })
        ]);
        if (existingEmail) return res.status(409).json({ success: false, message: 'Email already exists' });
        if (existingPhone) return res.status(409).json({ success: false, message: 'Phone number already exists' });

        const coordinates = validateCoordinates(latitude, longitude);
        if (hasCoordinateInput(latitude, longitude) && !coordinates) {
            return res.status(400).json({ success: false, message: 'Valid latitude and longitude are required' });
        }
        const hashedPassword = await bcrypt.hash(password, 12);

        // age/weight optional — empty/missing/invalid hole null, jate NaN cast error na hoy.
        const optionalNumber = (value) => {
            if (value === undefined || value === null || value === '') return null;
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : null;
        };
        const userData = {
            name: String(name).trim(), email: normalizedEmail, password: hashedPassword,
            phone: normalizedPhone, role: 'user', bloodGroup, age: optionalNumber(age),
            weight: optionalNumber(weight), division, district, thana, city: String(city).trim(),
            nidDocument: nidDocument || '', birthCertificateDocument: birthCertificateDocument || '',
            isAvailable:wantsToBeAvailable
        };
        if (coordinates) {
            userData.location = { type: 'Point', coordinates };
            userData.locationUpdatedAt = new Date();
            userData.locationAccuracy = Number.isFinite(Number(accuracy)) ? Math.max(0,Number(accuracy)) : null;
        }
        const newUser = await User.create(userData);

        res.status(201).json({ success: true, message: 'Registration successful', user: safeUser(newUser) });
    } catch (error) {
        if (error?.code === 11000) return res.status(409).json({ success: false, message: 'Email or phone number already exists' });
        return sendServerError(res, 'Registration failed', error);
    }
};

// user login handle korar jonno ei section use kora hoy, ar JWT token generate kora hoy.
// ei token pore profile update, request create ebong onno protected API access e authentication hisabe kaj kore.
const loginUser = async (req, res) => {
    try {
        const { email, password, latitude, longitude } = req.body;
        const user = await User.findOne({ email: (email || '').toLowerCase().trim() });
        if (!user) return res.status(401).json({ success: false, message: 'Invalid email or password' });

        const passwordMatched = await bcrypt.compare(password || '', user.password);
        if (!passwordMatched) return res.status(401).json({ success: false, message: 'Invalid email or password' });

        const coordinates = validateCoordinates(latitude, longitude);
        if (coordinates) {
            user.location = { type: 'Point', coordinates };
            user.locationUpdatedAt = new Date();
            user.locationAccuracy = Number.isFinite(Number(req.body.accuracy)) ? Math.max(0,Number(req.body.accuracy)) : null;
            await user.save();
        }

        if (user.role !== 'user' && user.role !== 'admin') { user.role = 'user'; await user.save(); }
        // 2FA enabled hole password valid holeo token deya hoy na — OTP challenge return hoy.
        if (user.twoFactorEnabled) {
            const security = require('./authSecurityController');
            const challenge = await security.beginLogin2FA(user.email);
            if (challenge) return res.json({ success: true, requires2FA: true, challenge: challenge.challenge, message: 'Two-factor code sent to your email' });
        }
        const token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '7d' });
        const security = require('./authSecurityController');
        const refreshToken = await security.issueRefreshToken(user._id, { ip: req.ip });
        res.json({ success: true, token, refreshToken, user: safeUser(user) });
    } catch (error) {
        return sendServerError(res, 'Login failed', error);
    }
};

// logged-in user er profile data database theke fetch korar jonno ei function use kora hoy.
// frontend dashboard ar profile page e current user information display korar jonno ei function kaj kore.
const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        res.json({ success: true, user: safeUser(user) });
    } catch (error) {
        return sendServerError(res, 'Profile read failed', error);
    }
};

// user er editable profile field update korar jonno ei block use kora hoy.
// donor profile update, blood group change, address change, donation history update er somoy ei section kaj kore.
const updateProfile = async (req, res) => {
    try {
        const allowed = ['name', 'phone', 'bloodGroup', 'age', 'weight', 'division', 'district', 'thana', 'city', 'nidDocument', 'birthCertificateDocument', 'lastDonationDate', 'avatar', 'preferredLanguage', 'shareLiveLocation'];
        const updates = {};
        allowed.forEach((key) => {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        });

        // health details (hemoglobin, diseases, medications) — nested validate kore update.
        if (req.body.health !== undefined) {
            const health = req.body.health || {};
            const hemoglobin = health.hemoglobin === '' || health.hemoglobin === null || health.hemoglobin === undefined ? null : Number(health.hemoglobin);
            if (hemoglobin !== null && (!Number.isFinite(hemoglobin) || hemoglobin < 0 || hemoglobin > 30)) {
                return res.status(400).json({ success: false, message: 'Hemoglobin must be between 0 and 30 g/dL' });
            }
            updates.health = {
                hemoglobin,
                diseases: Array.isArray(health.diseases) ? health.diseases.map((d) => String(d).slice(0, 60)).slice(0, 20) : [],
                medications: Array.isArray(health.medications) ? health.medications.map((m) => String(m).slice(0, 60)).slice(0, 20) : [],
                lastCheckupDate: health.lastCheckupDate ? new Date(health.lastCheckupDate) : null
            };
        }

        // weekly availability calendar slots.
        if (req.body.availabilitySlots !== undefined) {
            const slots = Array.isArray(req.body.availabilitySlots) ? req.body.availabilitySlots : [];
            const validDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
            const valid = slots.every((slot) => validDays.includes(slot?.day) && timePattern.test(String(slot?.from || '')) && timePattern.test(String(slot?.to || '')));
            if (!valid) return res.status(400).json({ success: false, message: 'Each availability slot needs a valid day and HH:MM from/to time' });
            updates.availabilitySlots = slots.slice(0, 14);
        }

        if (updates.avatar !== undefined) {
            const avatar = String(updates.avatar || '').trim();
            // data URL (base64 image) ba https URL accept hoy — size limit 400KB.
            const isDataUrl = avatar.startsWith('data:image/');
            const isHttps = avatar.startsWith('https://');
            if (avatar && !isDataUrl && !isHttps) return res.status(400).json({ success: false, message: 'Avatar must be an https URL or an image data URL' });
            if (isDataUrl && avatar.length > 400 * 1024) return res.status(400).json({ success: false, message: 'Avatar image must be under 400KB' });
            updates.avatar = avatar;
        }
        if (updates.preferredLanguage !== undefined && !['en', 'bn'].includes(updates.preferredLanguage)) {
            return res.status(400).json({ success: false, message: 'Language must be en or bn' });
        }
        if (updates.shareLiveLocation !== undefined) updates.shareLiveLocation = Boolean(updates.shareLiveLocation);

        if (updates.phone) {
            updates.phone = String(updates.phone).trim();
            const duplicate = await User.findOne({ phone: updates.phone, _id: { $ne: req.user.id } });
            if (duplicate) return res.status(409).json({ success: false, message: 'Phone number already exists' });
            updates.phoneVerified = false;
        }
        if (updates.age !== undefined) updates.age = updates.age === '' ? null : Number(updates.age);
        if (updates.weight !== undefined) updates.weight = updates.weight === '' ? null : Number(updates.weight);
        if (updates.lastDonationDate !== undefined) {
            if (updates.lastDonationDate === '') updates.lastDonationDate = null;
            else {
                const donationDate = new Date(updates.lastDonationDate);
                if (Number.isNaN(donationDate.getTime()) || donationDate > new Date()) return res.status(400).json({ success: false, message: 'Donation date cannot be in the future' });
                updates.lastDonationDate = donationDate;
                updates.isAvailable = false;
            }
        }

        const coordinates = validateCoordinates(req.body.latitude, req.body.longitude);
        if (hasCoordinateInput(req.body.latitude, req.body.longitude) && !coordinates) {
            return res.status(400).json({ success: false, message: 'Valid latitude and longitude are required' });
        }
        if (coordinates) {
            updates.location = { type: 'Point', coordinates };
            updates.locationUpdatedAt = new Date();
            updates.locationAccuracy = Number.isFinite(Number(req.body.accuracy)) ? Math.max(0,Number(req.body.accuracy)) : null;
        }

        const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true, runValidators: true }).select('-password');
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        res.json({ success: true, message: 'Profile updated successfully', user: safeUser(user) });
    } catch (error) {
        if (error?.code === 11000) return res.status(409).json({ success: false, message: 'Phone number already exists' });
        if (error?.name === 'ValidationError') return res.status(400).json({ success: false, message: error.message });
        return sendServerError(res, 'Profile update failed', error);
    }
};

// user er latest GPS coordinate database e store korar jonno ei controller use kora hoy.
// ei khatre nearby available donor search, emergency matching, ar location-based filtering aro accurate hoy.
const updateLocation = async (req, res) => {
    try {
        const coordinates = validateCoordinates(req.body.latitude, req.body.longitude);
        if (!coordinates) return res.status(400).json({ success: false, message: 'Valid latitude and longitude are required' });
        const user = await User.findByIdAndUpdate(req.user.id, {
            location: { type: 'Point', coordinates },
            locationUpdatedAt: new Date(),
            locationAccuracy: Number.isFinite(Number(req.body.accuracy)) ? Math.max(0,Number(req.body.accuracy)) : null
        }, { new: true }).select('-password');
        res.json({ success: true, message: 'Location updated successfully', user: safeUser(user) });
    } catch (error) {
        return sendServerError(res, 'Location update failed', error);
    }
};

// user donor hisabe available kina set korar jonno ei logic use kora hoy.
// donor eligibility na thakle ba ready na thakle request receive na korar jonno ei logic important role play kore.
const toggleAvailability = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        const requestedAvailability = Boolean(req.body.isAvailable);
        if (requestedAvailability && (!user.age || !user.weight)) {
            return res.status(400).json({ success: false, message: 'Add age and weight to your shared profile before becoming available as a donor' });
        }
        if (requestedAvailability && user.lastDonationDate) {
            const daysSinceDonation = (Date.now() - new Date(user.lastDonationDate).getTime()) / 86400000;
            if (daysSinceDonation < 90) {
                return res.status(400).json({ success: false, message: `You are not eligible yet. ${Math.ceil(90 - daysSinceDonation)} day(s) remaining.` });
            }
        }
        user.isAvailable = requestedAvailability;
        await user.save();
        res.json({ success: true, isAvailable: user.isAvailable, user: safeUser(user) });
    } catch (error) {
        return sendServerError(res, 'Availability update failed', error);
    }
};

const updateDonation = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        const date = new Date(req.body.lastDonationDate);
        if (Number.isNaN(date.getTime())) return res.status(400).json({ success: false, message: 'Valid donation date is required' });
        if (date > new Date()) return res.status(400).json({ success: false, message: 'Donation date cannot be in the future' });
        user.lastDonationDate = date;
        user.isAvailable = false;
        await user.save();
        res.json({ success: true, message: 'Donation information updated', user: safeUser(user) });
    } catch (error) {
        return sendServerError(res, 'Donation update failed', error);
    }
};

module.exports = { registerUser, loginUser, getProfile, updateProfile, updateLocation, toggleAvailability, updateDonation, safeUser, validateCoordinates };
