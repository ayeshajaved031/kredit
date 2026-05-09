// ==============================================================
// JWT Helper
// --------------------------------------------------------------
// Single source of truth for token signing. Every place we issue
// a JWT goes through here, so the payload shape and expiry policy
// stay consistent.
//
// Payload:
//   {
//     id:    user._id (string),
//     role:  'startup' | 'admin',
//     iat:   issued-at (auto),
//     exp:   expires-at (auto, JWT_EXPIRES_IN env var)
//   }
//
// We deliberately keep the payload minimal — no email, no name,
// no sensitive fields. The auth middleware always re-fetches the
// user fresh from MongoDB, so anything beyond `id` would just be
// a stale snapshot. Smaller payload = smaller header = less
// network overhead on every request.
// ==============================================================

const jwt = require("jsonwebtoken");

const sign = (user) =>
  jwt.sign(
    { id: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );

const verify = (token) => jwt.verify(token, process.env.JWT_SECRET);

module.exports = { sign, verify };
