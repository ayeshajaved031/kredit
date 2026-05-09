// ==============================================================
// Financing Request Validations
// --------------------------------------------------------------
// submitRequest — used by POST /api/financing-requests
//
// Note: file upload validation (PDF type, size) is handled by
// multer in middlewares/upload.js. This validator only covers
// the JSON form fields.
//
// When the request comes in as multipart/form-data, multer
// populates req.body with the text fields and req.file with the
// uploaded file. So this validator works on req.body either way.
// ==============================================================

const mongoose = require("mongoose");

const submitRequest = (data) => {
  const errors = {};

  if (!data.vendorId || !mongoose.Types.ObjectId.isValid(data.vendorId)) {
    errors.vendorId = "Valid vendor ID is required";
  }

  // annualAmountPKR — comes through as a string from multipart, so
  // we coerce to Number and validate.
  const amount = Number(data.annualAmountPKR);
  if (!Number.isFinite(amount) || amount <= 0) {
    errors.annualAmountPKR = "Annual amount must be a positive number";
  } else if (amount < 10000) {
    // Sanity floor — financing PKR 500 doesn't make sense and is
    // probably a unit error.
    errors.annualAmountPKR = "Annual amount must be at least PKR 10,000";
  } else if (amount > 50000000) {
    // Sanity ceiling — PKR 5 crore is well above any startup we'd
    // serve at MVP scale.
    errors.annualAmountPKR = "Annual amount cannot exceed PKR 50,000,000";
  }

  if (!data.subscriptionDetails) {
    errors.subscriptionDetails = "Subscription details are required";
  } else {
    let parsed = data.subscriptionDetails;
    // Multipart strings need parsing — accept either a JSON string
    // or an already-parsed object (req.body might be either depending
    // on form encoding).
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        errors.subscriptionDetails = "Subscription details must be valid JSON";
        return errors;
      }
    }

    if (!parsed.planName || typeof parsed.planName !== "string" || !parsed.planName.trim()) {
      errors["subscriptionDetails.planName"] = "Plan name is required";
    }

    if (parsed.coveragePeriodMonths !== undefined) {
      const months = Number(parsed.coveragePeriodMonths);
      if (!Number.isInteger(months) || months < 1 || months > 36) {
        errors["subscriptionDetails.coveragePeriodMonths"] =
          "Coverage period must be 1-36 months";
      }
    }

    if (parsed.planDescription && parsed.planDescription.length > 500) {
      errors["subscriptionDetails.planDescription"] =
        "Plan description cannot exceed 500 characters";
    }
  }

  return Object.keys(errors).length ? errors : null;
};

module.exports = { submitRequest };
