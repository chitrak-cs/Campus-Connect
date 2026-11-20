const express = require('express');
const router = express.Router();
const {
  register, login, getMe, updateProfile, verifyOtp, resendOtp,
  forgotPassword, resetPassword, changePassword, uploadAvatar,
} = require('../controllers/authController');
const { avatarUpload } = require('../config/cloudinary');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { authLimiter, otpLimiter } = require('../middleware/rateLimit');
const schemas = require('../validation/schemas');

router.post('/register', authLimiter, validate(schemas.register), register);
router.post('/login', authLimiter, validate(schemas.login), login);
router.post('/verify-otp', otpLimiter, validate(schemas.verifyOtp), verifyOtp);
router.post('/resend-otp', authLimiter, validate(schemas.resendOtp), resendOtp);
router.post('/forgot-password', authLimiter, validate(schemas.forgotPassword), forgotPassword);
router.post('/reset-password', otpLimiter, validate(schemas.resetPassword), resetPassword);
router.get('/me', protect, getMe);
router.put('/password', protect, otpLimiter, validate(schemas.changePassword), changePassword);
router.post('/avatar', protect, authLimiter, avatarUpload.single('avatar'), uploadAvatar);
router.put('/profile', protect, validate(schemas.updateProfile), updateProfile);

module.exports = router;
