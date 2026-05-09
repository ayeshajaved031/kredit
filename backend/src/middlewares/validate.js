// ==============================================================
// Validation Middleware
// --------------------------------------------------------------
// Generic validator factory. Each route attaches a small
// validator function from validations/*.js — no library
// dependency, fully readable.
// ==============================================================

const mongoose = require("mongoose");
const AppError = require("../utils/AppError");

// validatorFn(data) → errors object or null
const validate = (validatorFn, source = "body") => (req, _res, next) => {
  const errors = validatorFn(req[source] || {});
  if (errors && Object.keys(errors).length > 0) {
    return next(new AppError("Validation failed", 400, errors));
  }
  next();
};

const validateObjectIdParam = (paramName = "id") => (req, _res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params[paramName])) {
    return next(new AppError(`Invalid ${paramName}`, 400));
  }
  next();
};

module.exports = { validate, validateObjectIdParam };
