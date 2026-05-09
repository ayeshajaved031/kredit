// ==============================================================
// Response Helper
// --------------------------------------------------------------
// Centralizes API response shape. Every endpoint uses ok() or
// fail() so frontend always parses the same structure.
//
// Success: { success: true, message, data }
// Failure: { success: false, message, errors? }
// ==============================================================

const ok = (res, { status = 200, message = "OK", data = null } = {}) =>
  res.status(status).json({ success: true, message, data });

const fail = (res, { status = 400, message = "Error", errors = null } = {}) =>
  res.status(status).json({ success: false, message, errors });

module.exports = { ok, fail };
