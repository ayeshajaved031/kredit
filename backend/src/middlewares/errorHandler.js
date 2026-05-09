// ==============================================================
// Error Middleware (centralized)
// --------------------------------------------------------------
// Single point of error → response conversion. Distinguishes:
//   - operational errors (AppError, Mongoose, JWT) → friendly client message
//   - unknown errors → generic 500, no stack trace leakage
// ==============================================================

const AppError = require("../utils/AppError");
const { fail } = require("../utils/response");

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.originalUrl}`, err);

  if (err instanceof AppError) {
    return fail(res, {
      status: err.statusCode,
      message: err.message,
      errors: err.errors,
    });
  }

  if (err.name === "ValidationError") {
    const errors = Object.fromEntries(
      Object.entries(err.errors).map(([key, val]) => [key, val.message])
    );
    return fail(res, { status: 400, message: "Validation failed", errors });
  }

  if (err.name === "CastError") {
    return fail(res, {
      status: 400,
      message: `Invalid ${err.path}: ${err.value}`,
    });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    return fail(res, { status: 409, message: `Duplicate value for '${field}'` });
  }

  if (err.name === "JsonWebTokenError") {
    return fail(res, { status: 401, message: "Invalid token" });
  }
  if (err.name === "TokenExpiredError") {
    return fail(res, { status: 401, message: "Token expired" });
  }

  // Multer errors (file upload)
  if (err.name === "MulterError") {
    return fail(res, { status: 400, message: err.message });
  }

  return fail(res, {
    status: 500,
    message: "Something went wrong on the server",
  });
};

module.exports = errorHandler;
