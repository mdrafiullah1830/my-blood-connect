const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getProfile, updateProfile, updateLocation, toggleAvailability, updateDonation } = require('../controllers/authController');
const {
    sendPhoneOtp, verifyPhoneOtp, sendEmailVerification, verifyEmail,
    forgotPassword, resetPassword, toggle2FA, confirm2FAEnable,
    refreshSession, listSessions, revokeAllSessions, socialLogin, completeLogin2FA
} = require('../controllers/authSecurityController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/login/2fa', async (req, res) => {
    try {
        const result = await completeLogin2FA({ challenge: req.body.challenge, code: req.body.code });
        if (!result.ok) return res.status(result.status).json({ success: false, message: result.message });
        const jwt = require('jsonwebtoken');
        const { safeUser } = require('../controllers/authController');
        const security = require('../controllers/authSecurityController');
        const token = jwt.sign({ id: result.user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '7d' });
        const refreshToken = await security.issueRefreshToken(result.user._id, { ip: req.ip });
        return res.json({ success: true, token, refreshToken, user: safeUser(result.user) });
    } catch (error) {
        console.error('2FA login failed:', error);
        return res.status(500).json({ success: false, message: 'Two-factor verification failed' });
    }
});
router.post('/refresh', refreshSession);
router.post('/social', socialLogin);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/verify-email', verifyEmail);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.put('/update-location', protect, updateLocation);
router.patch('/availability', protect, toggleAvailability);
router.patch('/donation', protect, updateDonation);
router.post('/otp/phone/send', protect, sendPhoneOtp);
router.post('/otp/phone/verify', protect, verifyPhoneOtp);
router.post('/email/send-verification', protect, sendEmailVerification);
router.post('/2fa', protect, toggle2FA);
router.post('/2fa/confirm', protect, confirm2FAEnable);
router.get('/sessions', protect, listSessions);
router.delete('/sessions', protect, revokeAllSessions);

module.exports = router;
