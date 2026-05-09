// ==============================================================
// Admin Validations
// --------------------------------------------------------------
// All admin write actions get explicit validators. Most are short
// because the bulk of business validation happens in the
// controllers (e.g., "is this startup actually pending KYC?").
// ==============================================================

const approveKyc = (data) => {
  const errors = {};

  const limit = Number(data.approvedCreditLimit);
  if (!Number.isFinite(limit) || limit <= 0) {
    errors.approvedCreditLimit = "Approved credit limit must be a positive number";
  } else if (limit < 50000) {
    errors.approvedCreditLimit = "Credit limit must be at least PKR 50,000";
  } else if (limit > 100000000) {
    errors.approvedCreditLimit = "Credit limit cannot exceed PKR 100,000,000";
  }

  if (data.adminNotes !== undefined && typeof data.adminNotes !== "string") {
    errors.adminNotes = "Admin notes must be a string";
  } else if (data.adminNotes && data.adminNotes.length > 1000) {
    errors.adminNotes = "Admin notes cannot exceed 1000 characters";
  }

  return Object.keys(errors).length ? errors : null;
};

const rejectKyc = (data) => {
  const errors = {};

  if (!data.reason || typeof data.reason !== "string" || !data.reason.trim()) {
    errors.reason = "Rejection reason is required";
  } else if (data.reason.length > 1000) {
    errors.reason = "Reason cannot exceed 1000 characters";
  }

  return Object.keys(errors).length ? errors : null;
};

const approveRequest = (data) => {
  const errors = {};

  // Markup percent is OPTIONAL — defaults to env MURABAHA_MARKUP_PERCENT.
  // When provided, it must be sane.
  if (data.markupPercent !== undefined) {
    const m = Number(data.markupPercent);
    if (!Number.isFinite(m) || m < 0 || m > 50) {
      errors.markupPercent = "Markup percent must be between 0 and 50";
    }
  }

  if (data.adminNotes !== undefined && typeof data.adminNotes !== "string") {
    errors.adminNotes = "Admin notes must be a string";
  } else if (data.adminNotes && data.adminNotes.length > 1000) {
    errors.adminNotes = "Admin notes cannot exceed 1000 characters";
  }

  return Object.keys(errors).length ? errors : null;
};

const rejectRequest = (data) => {
  if (!data.reason || typeof data.reason !== "string" || !data.reason.trim()) {
    return { reason: "Rejection reason is required" };
  }
  if (data.reason.length > 1000) {
    return { reason: "Reason cannot exceed 1000 characters" };
  }
  return null;
};

const blockUser = (data) => {
  if (!data.reason || typeof data.reason !== "string" || !data.reason.trim()) {
    return { reason: "Reason for blocking is required" };
  }
  if (data.reason.length > 500) {
    return { reason: "Reason cannot exceed 500 characters" };
  }
  return null;
};

const updateCreditLimit = (data) => {
  const errors = {};
  const limit = Number(data.approvedCreditLimit);

  if (!Number.isFinite(limit) || limit < 0) {
    errors.approvedCreditLimit = "Credit limit must be a non-negative number";
  } else if (limit > 100000000) {
    errors.approvedCreditLimit = "Credit limit cannot exceed PKR 100,000,000";
  }

  if (data.adminNotes !== undefined && typeof data.adminNotes !== "string") {
    errors.adminNotes = "Admin notes must be a string";
  }

  return Object.keys(errors).length ? errors : null;
};

module.exports = {
  approveKyc,
  rejectKyc,
  approveRequest,
  rejectRequest,
  blockUser,
  updateCreditLimit,
};
