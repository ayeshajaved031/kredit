// ==============================================================
// Startup Controller
// --------------------------------------------------------------
// Self-service endpoints for a startup user to manage their
// company profile and submit KYC documents.
//
// Admin-side review (approve/reject KYC, set credit limit) lives
// in admin.controller.js, not here.
// ==============================================================

const Startup = require("../models/Startup");
const Notification = require("../models/Notification");

const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const { ok } = require("../utils/response");
const { sendMail, templates } = require("../utils/mailer");
const { publicUrlFor } = require("../middlewares/upload");

// Fields a startup is allowed to update on themselves. NOT in
// this list (deliberately): registrationNumber, registrationType,
// kycStatus, approvedCreditLimit, usedCredit, creditRating.
// Those are admin-only or system-managed.
const EDITABLE_FIELDS = [
  "companyName",
  "industry",
  "teamSize",
  "annualRevenuePKR",
  "operationalAddress",
];

// ==============================================================
// GET /api/startup/me
// --------------------------------------------------------------
// Returns the logged-in user's startup profile.
// ==============================================================
const getMyStartup = asyncHandler(async (req, res) => {
  const startup = await Startup.findOne({ userId: req.user._id });
  if (!startup) {
    throw new AppError("Startup profile not found for this account", 404);
  }
  return ok(res, { data: { startup: startup.toJSON() } });
});

// ==============================================================
// PUT /api/startup/me
// --------------------------------------------------------------
// Updates editable profile fields. Whitelisted — anything not in
// EDITABLE_FIELDS is silently ignored, even if the client tries
// to send it.
// ==============================================================
const updateMyStartup = asyncHandler(async (req, res) => {
  const startup = await Startup.findOne({ userId: req.user._id });
  if (!startup) throw new AppError("Startup profile not found", 404);

  for (const field of EDITABLE_FIELDS) {
    if (req.body[field] !== undefined) {
      startup[field] = req.body[field];
    }
  }

  await startup.save();
  return ok(res, {
    message: "Profile updated",
    data: { startup: startup.toJSON() },
  });
});

// ==============================================================
// POST /api/startup/me/kyc-documents
// --------------------------------------------------------------
// Multipart upload for KYC documents. Frontend sends one or more
// of:  ntnCertificate, secpCertificate, bankStatement, utilityBill
// (each a single file).
//
// On first submission, kycStatus flips to "under_review" so admin
// sees it in the queue.
// ==============================================================
const uploadKycDocuments = asyncHandler(async (req, res) => {
  const startup = await Startup.findOne({ userId: req.user._id });
  if (!startup) throw new AppError("Startup profile not found", 404);

  // multer's `.fields()` populates req.files as an object:
  //   { ntnCertificate: [File], bankStatement: [File], ... }
  const files = req.files || {};
  const uploaded = {};

  for (const key of ["ntnCertificate", "secpCertificate", "bankStatement", "utilityBill"]) {
    if (files[key] && files[key][0]) {
      const url = publicUrlFor(req, files[key][0].path);
      startup.documents[key] = url;
      uploaded[key] = url;
    }
  }

  if (Object.keys(uploaded).length === 0) {
    throw new AppError("At least one document must be uploaded", 400);
  }

  // Flip status to under_review if not already verified
  if (startup.kycStatus === "unverified" || startup.kycStatus === "rejected") {
    startup.kycStatus = "under_review";
  }
  await startup.save();

  // Notify the user in-app
  await Notification.create({
    userId: req.user._id,
    title: "KYC documents received",
    message: "Our team will review them within 2 business days.",
    type: "kyc",
    severity: "info",
    actionUrl: "/startup/profile",
  });

  // Confirmation email (best-effort)
  try {
    await sendMail({
      to: req.user.email,
      ...templates.kycReceivedEmail({ name: req.user.fullName }),
    });
  } catch (err) {
    console.error("[Mail] KYC confirmation failed:", err.message);
  }

  return ok(res, {
    message: "KYC documents uploaded successfully",
    data: {
      kycStatus: startup.kycStatus,
      uploaded,
      documents: startup.documents,
    },
  });
});

// ==============================================================
// GET /api/startup/me/kyc-status
// --------------------------------------------------------------
// Lightweight endpoint for the dashboard to poll KYC status
// without pulling the entire profile.
// ==============================================================
const getKycStatus = asyncHandler(async (req, res) => {
  const startup = await Startup.findOne({ userId: req.user._id }).select(
    "kycStatus approvedCreditLimit usedCredit adminNotes documents"
  );
  if (!startup) throw new AppError("Startup profile not found", 404);

  return ok(res, {
    data: {
      kycStatus: startup.kycStatus,
      approvedCreditLimit: startup.approvedCreditLimit,
      usedCredit: startup.usedCredit,
      availableCredit: Math.max(0, startup.approvedCreditLimit - startup.usedCredit),
      adminNotes: startup.adminNotes,
      documents: startup.documents,
    },
  });
});

module.exports = {
  getMyStartup,
  updateMyStartup,
  uploadKycDocuments,
  getKycStatus,
};
