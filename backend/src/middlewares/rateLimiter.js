// ==============================================================
// Rate Limiters
// --------------------------------------------------------------
// Auth: 10 attempts / 15 min — blocks brute-force without
// locking out real users.
// Sensitive: 30 / minute — for financial actions like payment
// initiation, contract signing, file uploads.
// ==============================================================

const rateLimit = require("express-rate-limit");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts. Please try again later." },
});

const sensitiveLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please slow down." },
});

module.exports = { authLimiter, sensitiveLimiter };
