// ==============================================================
// Notification Validations
// --------------------------------------------------------------
// Notifications are created server-side (auth controller, contract
// controller, etc.) — there's no public "create" endpoint. So the
// only validation we need is for query string filters.
// ==============================================================

const VALID_TYPES = [
  "kyc",
  "financing_request",
  "contract",
  "payment",
  "ticket",
  "account",
  "system",
];

// Query-string validator for GET /api/notifications
// Accepts: ?unreadOnly=true|false, ?type=<one of VALID_TYPES>
const listQuery = (data) => {
  const errors = {};

  if (data.type !== undefined && !VALID_TYPES.includes(data.type)) {
    errors.type = `Type must be one of: ${VALID_TYPES.join(", ")}`;
  }

  if (data.unreadOnly !== undefined && !["true", "false"].includes(data.unreadOnly)) {
    errors.unreadOnly = "unreadOnly must be 'true' or 'false'";
  }

  return Object.keys(errors).length ? errors : null;
};

module.exports = { listQuery };
