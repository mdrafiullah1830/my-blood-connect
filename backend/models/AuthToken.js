const mongoose = require('mongoose');

// OTP, password-reset token, email-verification token, refresh session — shob ei collection e.
// ei vabe auth er notun security feature guloke ek jaygay track kora hoy.
const authTokenSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: {
        type: String,
        enum: ['otp_phone', 'otp_email', 'otp_2fa', 'password_reset', 'email_verify', 'refresh'],
        required: true
    },
    token: { type: String, required: true, index: true },
    code: { type: String, default: '' },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    used: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true }
});

authTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('AuthToken', authTokenSchema);
