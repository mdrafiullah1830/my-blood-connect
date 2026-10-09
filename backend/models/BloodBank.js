const mongoose = require('mongoose');

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// stock ekta embedded doc — prottek blood group er bag count store kore.
const stockSchema = new mongoose.Schema({
    bloodGroup: { type: String, enum: BLOOD_GROUPS, required: true },
    bags: { type: Number, min: 0, default: 0 },
    updatedAt: { type: Date, default: Date.now }
}, { _id: false });

// hospital/blood bank er information ar live stock tracking er jonno ei schema.
const bloodBankSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 150 },
    type: { type: String, enum: ['hospital', 'blood_bank', 'clinic'], default: 'hospital' },
    address: { type: String, required: true, trim: true, maxlength: 300 },
    city: { type: String, required: true, trim: true },
    district: { type: String, default: '', trim: true },
    division: { type: String, default: '', trim: true },
    phone: { type: String, default: '', maxlength: 20 },
    emergencyPhone: { type: String, default: '', maxlength: 20 },
    ambulancePhone: { type: String, default: '', maxlength: 20 },
    email: { type: String, default: '', lowercase: true },
    // 2dsphere index er jonno empty Point insert kora jay na — GPS thakle i ei field lekha hoy.
    location: {
        type: { type: String, enum: ['Point'] },
        coordinates: { type: [Number], default: undefined }
    },
    stock: { type: [stockSchema], default: [] },
    active: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

bloodBankSchema.index({ location: '2dsphere' });
bloodBankSchema.index({ city: 1, active: 1 });
bloodBankSchema.index({ name: 'text', address: 'text' });

module.exports = mongoose.model('BloodBank', bloodBankSchema);
