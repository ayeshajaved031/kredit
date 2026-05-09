// ==============================================================
// Role Middleware
// --------------------------------------------------------------
// Restricts a route to specific role(s). Mount AFTER authenticate.
//
//   router.get("/admin/users", authenticate, requireRole("admin"), handler);
// ==============================================================

const AppError = require("../utils/AppError");

const requireRole = (...allowedRoles) => (req, _res, next) => {
  if (!req.user) {
    return next(new AppError("Authentication required", 401));
  }
  if (!allowedRoles.includes(req.user.role)) {
    return next(new AppError("You do not have permission for this action", 403));
  }
  next();
};

module.exports = requireRole;
