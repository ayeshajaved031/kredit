// ==============================================================
// Auth Middleware
// --------------------------------------------------------------
// Verifies JWT and attaches req.user. Rejects:
//   - missing/malformed Authorization header → 401
//   - invalid signature, expired token       → 401 (via errorHandler)
//   - user no longer exists                  → 401
//   - user is blocked                        → 403
//
// Looks up the user fresh on every request so an admin block
// takes effect immediately on the next API call.
// ==============================================================

const jwt = require("jsonwebtoken");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");

const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    throw new AppError("Authentication required", 401);
  }

  const token = header.slice(7);
  if (!token) throw new AppError("Authentication required", 401);

  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  const user = await User.findById(decoded.id);
  if (!user) throw new AppError("User no longer exists", 401);

  if (user.status === "blocked") {
    throw new AppError("Your account has been blocked. Contact support.", 403);
  }

  req.user = user;
  next();
});

module.exports = authenticate;
