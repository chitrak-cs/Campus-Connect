const rateLimit = require('express-rate-limit');

const make = (limit, windowMs = 15 * 60 * 1000, message = 'Too many requests, please try again later') =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message },
  });

module.exports = {
  authLimiter: make(10),      // login, register, forgot-password, resend-otp
  otpLimiter: make(15),       // verify-otp, reset-password
  apiLimiter: make(300),      // everything under /api
  publicLimiter: make(60),
};
