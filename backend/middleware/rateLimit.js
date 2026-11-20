const rateLimit = require('express-rate-limit');

// Rate limiting is OFF unless ENABLE_RATE_LIMIT=true (owner's decision: low traffic for now).
// Per-OTP attempt limits (5 tries) and resend cooldowns are separate and always on.
const ENABLED = process.env.ENABLE_RATE_LIMIT === 'true';
const passthrough = (req, res, next) => next();

const make = (limit, windowMs = 15 * 60 * 1000, message = 'Too many requests, please try again later') =>
  !ENABLED ? passthrough : rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message },
  });

module.exports = {
  ENABLED,
  authLimiter: make(10),      // login, register, forgot-password, resend-otp
  otpLimiter: make(15),       // verify-otp, reset-password
  apiLimiter: make(300),      // everything under /api
  publicLimiter: make(60),
};
