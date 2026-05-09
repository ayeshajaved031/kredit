// ==============================================================
// Vendor Validations
// --------------------------------------------------------------
// createVendor — used by POST  /api/vendors  (admin only)
// updateVendor — used by PUT   /api/vendors/:id (admin only)
//                Partial update — only validate fields that are
//                actually present in the body.
// ==============================================================

const VALID_CATEGORIES = [
  "cloud_infrastructure",
  "crm",
  "productivity",
  "design",
  "analytics",
  "communication",
  "developer_tools",
  "other",
];

const URL_RE = /^https?:\/\/.+/i;

const createVendor = (data) => {
  const errors = {};

  if (!data.name || typeof data.name !== "string" || data.name.trim().length < 2) {
    errors.name = "Vendor name is required (min 2 characters)";
  } else if (data.name.length > 80) {
    errors.name = "Vendor name cannot exceed 80 characters";
  }

  if (!data.category || !VALID_CATEGORIES.includes(data.category)) {
    errors.category = `Category must be one of: ${VALID_CATEGORIES.join(", ")}`;
  }

  if (data.description !== undefined && typeof data.description !== "string") {
    errors.description = "Description must be a string";
  } else if (data.description && data.description.length > 500) {
    errors.description = "Description cannot exceed 500 characters";
  }

  if (data.logoUrl && (typeof data.logoUrl !== "string" || !URL_RE.test(data.logoUrl))) {
    errors.logoUrl = "Logo URL must be a valid http(s) URL";
  }

  if (data.websiteUrl && (typeof data.websiteUrl !== "string" || !URL_RE.test(data.websiteUrl))) {
    errors.websiteUrl = "Website URL must be a valid http(s) URL";
  }

  if (data.typicalAnnualDiscountPercent !== undefined) {
    const n = Number(data.typicalAnnualDiscountPercent);
    if (!Number.isFinite(n) || n < 0 || n > 99) {
      errors.typicalAnnualDiscountPercent = "Discount percent must be between 0 and 99";
    }
  }

  return Object.keys(errors).length ? errors : null;
};

const updateVendor = (data) => {
  const errors = {};

  if (data.name !== undefined) {
    if (typeof data.name !== "string" || data.name.trim().length < 2) {
      errors.name = "Vendor name must be at least 2 characters";
    } else if (data.name.length > 80) {
      errors.name = "Vendor name cannot exceed 80 characters";
    }
  }

  if (data.category !== undefined && !VALID_CATEGORIES.includes(data.category)) {
    errors.category = `Category must be one of: ${VALID_CATEGORIES.join(", ")}`;
  }

  if (data.description !== undefined) {
    if (typeof data.description !== "string") {
      errors.description = "Description must be a string";
    } else if (data.description.length > 500) {
      errors.description = "Description cannot exceed 500 characters";
    }
  }

  if (data.logoUrl !== undefined && data.logoUrl && !URL_RE.test(data.logoUrl)) {
    errors.logoUrl = "Logo URL must be a valid http(s) URL";
  }

  if (data.websiteUrl !== undefined && data.websiteUrl && !URL_RE.test(data.websiteUrl)) {
    errors.websiteUrl = "Website URL must be a valid http(s) URL";
  }

  if (data.typicalAnnualDiscountPercent !== undefined) {
    const n = Number(data.typicalAnnualDiscountPercent);
    if (!Number.isFinite(n) || n < 0 || n > 99) {
      errors.typicalAnnualDiscountPercent = "Discount percent must be between 0 and 99";
    }
  }

  if (data.isActive !== undefined && typeof data.isActive !== "boolean") {
    errors.isActive = "isActive must be true or false";
  }

  return Object.keys(errors).length ? errors : null;
};

module.exports = { createVendor, updateVendor };
