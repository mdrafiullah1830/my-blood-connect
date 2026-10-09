const mongoose = require('mongoose');

// ei blood group list user er donor matching ar emergency request er jonno use kora hoy.
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// donor availability slot: kisomoy available thakte chai seta define kore.
const availabilitySlotSchema = new mongoose.Schema({
    day: { type: String, enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], required: true },
    from: { type: String, required: true },
    to: { type: String, required: true }
}, { _id: false });

// ei schema e user profile, donation status, location, ar blood related data store kora hoy.
const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true, minlength: 6 },
    phone: { type: String, required: true, unique: true, trim: true, minlength: 7, maxlength: 20 },
    role: { type: String, enum: ['user', 'donor', 'recipient', 'admin'], required: true, default: 'user' },
    bloodGroup: { type: String, enum: BLOOD_GROUPS, required: true },
    age: { type: Number, min: 1, max: 120, default: null },
    weight: { type: Number, min: 1, max: 300, default: null },
    division: { type: String, trim: true, default: '' },
    district: { type: String, trim: true, default: '' },
    thana: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, required: true, maxlength: 100 },
    nidDocument: { type: String, trim: true, default: '' },
    birthCertificateDocument: { type: String, trim: true, default: '' },
    avatar: { type: String, trim: true, default: '' },
    verified: { type: Boolean, default: false },
    verifiedAt: { type: Date, default: null },
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    twoFactorEnabled: { type: Boolean, default: false },
    preferredLanguage: { type: String, enum: ['en', 'bn'], default: 'en' },
    health: {
        hemoglobin: { type: Number, min: 0, max: 30, default: null },
        diseases: { type: [String], default: [] },
        medications: { type: [String], default: [] },
        lastCheckupDate: { type: Date, default: null }
    },
    availabilitySlots: { type: [availabilitySlotSchema], default: [] },
    donationCount: { type: Number, default: 0 },
    ratingSum: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    // location default point NO — 2dsphere index e empty Point insert korle insert fail hoy.
    // GPS na thakle ei field-i lekha hoy na, tai index shob user ke skip korte pare.
    location: {
        type: { type: String, enum: ['Point'] },
        coordinates: {
            type: [Number],
            default: undefined,
            validate: {
                validator: (value) => !value || (value.length === 2 && value[0] >= -180 && value[0] <= 180 && value[1] >= -90 && value[1] <= 90),
                message: 'Invalid GPS coordinates'
            }
        }
    },
    locationUpdatedAt: { type: Date, default: null },
    locationAccuracy: { type: Number, min: 0, default: null },
    lastDonationDate: { type: Date, default: null },
    isAvailable: { type: Boolean, default: false },
    shareLiveLocation: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

userSchema.index({ location: '2dsphere' });
userSchema.index({ bloodGroup: 1, isAvailable: 1 });
userSchema.index({ division: 1, district: 1, thana: 1 });

const User = mongoose.model('User', userSchema);

User.migrateToUnifiedAccounts = async () => {
    await User.updateMany({ role: 'recipient' }, { $set: { isAvailable: false } });
    await User.updateMany({ role: { $in: ['donor', 'recipient'] } }, { $set: { role: 'user' } });
    // admin role preserve kora hoy — admin ke user kora hobe na.
    await User.updateMany({ role: { $exists: false } }, { $set: { role: 'user' } });
};

// donor er average rating return kore.
User.averageRating = (user) => (user.ratingCount > 0 ? Number((user.ratingSum / user.ratingCount).toFixed(1)) : 0);

module.exports = User;
