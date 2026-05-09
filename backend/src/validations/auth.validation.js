// ==============================================================
// Auth Validations
// --------------------------------------------------------------
// Each validator takes a request body and returns either:
//   - null               — input is valid
//   - { field: msg, ... } — at least one field has an issue
//
// Plugged into routes via the `validate(...)` middleware factory
// from middlewares/validate.js.
//
// We deliberately don't use Joi/Zod — the rules are simple, the
// code is the documentation, and the team sees exactly what's
// being checked.
// ==============================================================

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const PHONE_RE = /^(\+92|0)?3\d{9}$/;
const NTN_RE = /^\d{7}$/;
const SECP_RE = /^[A-Z0-9-]{4,30}$/i;
const PASSWORD_MIN_LEN = 8;

const isStrongPassword = (pwd) => {
  if (typeof pwd !== "string") return false;
  if (pwd.length < PASSWORD_MIN_LEN) return false;
  // At least one letter, one number, one special char.
  if (!/[a-zA-Z]/.test(pwd)) return false;
  if (!/\d/.test(pwd)) return false;
  if (!/[^a-zA-Z0-9]/.test(pwd)) return false;
  return true;
};

const PASSWORD_HINT =
  `Password must be at least ${PASSWORD_MIN_LEN} characters and include letters, numbers, and a special character`;

// ---------------- registerStartup ----------------
// Used by POST /api/auth/register — registers a new startup user
// AND creates their company profile in one shot.
const registerStartup = (data) => {
  const errors = {};

  // User fields
  if (!data.fullName || data.fullName.trim().length < 2) {
    errors.fullName = "Full name is required (min 2 characters)";
  }
  if (!data.email || !EMAIL_RE.test(data.email)) {
    errors.email = "Valid email is required";
  }
  if (!isStrongPassword(data.password)) {
    errors.password = PASSWORD_HINT;
  }
  if (data.phone && !PHONE_RE.test(data.phone)) {
    errors.phone = "Phone must be a valid Pakistani number";
  }

  // Startup fields
  if (!data.companyName || data.companyName.trim().length < 2) {
    errors.companyName = "Company name is required";
  }
  if (!data.registrationType || !["NTN", "SECP"].includes(data.registrationType)) {
    errors.registrationType = "Registration type must be 'NTN' or 'SECP'";
  } else {
    const reg = (data.registrationNumber || "").trim();
    if (!reg) {
      errors.registrationNumber = "Registration number is required";
    } else if (data.registrationType === "NTN" && !NTN_RE.test(reg)) {
      errors.registrationNumber = "NTN must be 7 digits";
    } else if (data.registrationType === "SECP" && !SECP_RE.test(reg)) {
      errors.registrationNumber = "SECP number format is invalid";
    }
  }
  if (!data.address || typeof data.address !== "object") {
    errors.address = "Address is required";
  } else {
    if (!data.address.street) errors["address.street"] = "Street is required";
    if (!data.address.city) errors["address.city"] = "City is required";
    if (!data.address.province) errors["address.province"] = "Province is required";
  }

  return Object.keys(errors).length ? errors : null;
};

// ---------------- login ----------------
const login = (data) => {
  const errors = {};
  if (!data.email || !EMAIL_RE.test(data.email)) {
    errors.email = "Valid email is required";
  }
  if (!data.password || typeof data.password !== "string") {
    errors.password = "Password is required";
  }
  return Object.keys(errors).length ? errors : null;
};

// ---------------- changePassword ----------------
const changePassword = (data) => {
  const errors = {};
  if (!data.currentPassword) {
    errors.currentPassword = "Current password is required";
  }
  if (!isStrongPassword(data.newPassword)) {
    errors.newPassword = PASSWORD_HINT;
  } else if (data.newPassword === data.currentPassword) {
    errors.newPassword = "New password must differ from current password";
  }
  return Object.keys(errors).length ? errors : null;
};

// ---------------- forgotPassword ----------------
const forgotPassword = (data) => {
  if (!data.email || !EMAIL_RE.test(data.email)) {
    return { email: "Valid email is required" };
  }
  return null;
};

// ---------------- resetPassword ----------------
const resetPassword = (data) => {
  if (!isStrongPassword(data.newPassword)) {
    return { newPassword: PASSWORD_HINT };
  }
  return null;
};

module.exports = {
  registerStartup,
  login,
  changePassword,
  forgotPassword,
  resetPassword,
};
