const express = require('express');
const router = express.Router();
const { register, login, getMe, updateProfile, verifyOtp, resendOtp } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { authLimiter, otpLimiter } = require('../middleware/rateLimit');
const schemas = require('../validation/schemas');

router.post('/register', authLimiter, validate(schemas.register), register);
router.post('/login', authLimiter, validate(schemas.login), login);
router.post('/verify-otp', otpLimiter, validate(schemas.verifyOtp), verifyOtp);
router.post('/resend-otp', authLimiter, validate(schemas.resendOtp), resendOtp);
router.get('/me', protect, getMe);
router.put('/profile', protect, validate(schemas.updateProfile), updateProfile);

module.exports = router;
