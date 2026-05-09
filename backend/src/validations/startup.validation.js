// ==============================================================
// Startup Validations
// --------------------------------------------------------------
// Validators for startup profile updates. The KYC document upload
// itself is validated by multer (file type + size); these
// validators only cover JSON body fields.
// ==============================================================

const VALID_PROVINCES = ["Punjab", "Sindh", "KPK", "Balochistan", "ICT", "AJK", "GB"];
const VALID_INDUSTRIES = [
  "software_house",
  "saas_startup",
  "blockchain",
  "ai_ml",
  "fintech",
  "ecommerce",
  "mobile_apps",
  "other",
];

const updateProfile = (data) => {
  const errors = {};

  if (data.companyName !== undefined) {
    if (typeof data.companyName !== "string" || data.companyName.trim().length < 2) {
      errors.companyName = "Company name must be at least 2 characters";
    }
  }

  if (data.industry !== undefined && !VALID_INDUSTRIES.includes(data.industry)) {
    errors.industry = `Industry must be one of: ${VALID_INDUSTRIES.join(", ")}`;
  }

  if (data.teamSize !== undefined) {
    const n = Number(data.teamSize);
    if (!Number.isInteger(n) || n < 1 || n > 10000) {
      errors.teamSize = "Team size must be an integer between 1 and 10000";
    }
  }

  if (data.annualRevenuePKR !== undefined) {
    const n = Number(data.annualRevenuePKR);
    if (!Number.isFinite(n) || n < 0) {
      errors.annualRevenuePKR = "Annual revenue must be a non-negative number";
    }
  }

  if (data.operationalAddress !== undefined) {
    const a = data.operationalAddress;
    if (!a || typeof a !== "object") {
      errors.operationalAddress = "Address must be an object";
    } else {
      if (a.street !== undefined && (typeof a.street !== "string" || !a.street.trim())) {
        errors["operationalAddress.street"] = "Street is required";
      }
      if (a.city !== undefined && (typeof a.city !== "string" || !a.city.trim())) {
        errors["operationalAddress.city"] = "City is required";
      }
      if (a.province !== undefined && !VALID_PROVINCES.includes(a.province)) {
        errors["operationalAddress.province"] =
          `Province must be one of: ${VALID_PROVINCES.join(", ")}`;
      }
    }
  }

  return Object.keys(errors).length ? errors : null;
};

module.exports = { updateProfile };
