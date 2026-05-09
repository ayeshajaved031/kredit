// ==============================================================
// Startup Model
// --------------------------------------------------------------
// Company profile. Linked 1:1 to a User account (the founder/CTO
// who registered). Holds everything Kredit needs to evaluate
// creditworthiness: NTN, SECP, address, credit limit, KYC status.
//
// Created automatically during user registration when role is
// "startup". A user with role="admin" has no Startup document.
//
// Per the iteration doc: "creditworthy firms" — so a startup has
// an `approvedCreditLimit` (set by admin during KYC) and a
// `usedCredit` running total. usedCredit is auto-updated by the
// FinancingRequest controller whenever a contract is signed or
// fully repaid, so the dashboard can show "available credit".
// ==============================================================

const mongoose = require("mongoose");

const startupSchema = new mongoose.Schema(
  {
    // 1:1 link to User account
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    companyName: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
      maxlength: 120,
    },

    // SECP registration number OR NTN — the iteration doc treats
    // them as alternatives. We accept either. NTN is 7 digits,
    // SECP is alphanumeric, so we don't pin one regex.
    registrationNumber: {
      type: String,
      required: [true, "SECP registration or NTN is required"],
      trim: true,
      uppercase: true,
      unique: true,
      maxlength: 30,
    },

    registrationType: {
      type: String,
      enum: ["NTN", "SECP"],
      required: true,
    },

    operationalAddress: {
      street: { type: String, trim: true, required: true },
      city: { type: String, trim: true, required: true },
      province: {
        type: String,
        enum: ["Punjab", "Sindh", "KPK", "Balochistan", "ICT", "AJK", "GB"],
        required: true,
      },
      postalCode: { type: String, trim: true },
    },

    industry: {
      type: String,
      enum: [
        "software_house",
        "saas_startup",
        "blockchain",
        "ai_ml",
        "fintech",
        "ecommerce",
        "mobile_apps",
        "other",
      ],
      default: "other",
    },

    teamSize: {
      type: Number,
      min: 1,
      max: 10000,
      default: 1,
    },

    annualRevenuePKR: {
      type: Number,
      min: 0,
      default: 0,
    },

    // KYC review status. Once a user registers, they're "unverified"
    // until an admin reviews their documents and sets it to "verified".
    // Only verified startups can submit financing requests (enforced
    // in the financing-request controller).
    kycStatus: {
      type: String,
      enum: ["unverified", "under_review", "verified", "rejected"],
      default: "unverified",
      index: true,
    },

    // Credit limit set by admin during KYC review. Default falls back
    // to env var DEFAULT_CREDIT_LIMIT_PKR for new accounts.
    approvedCreditLimit: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Running total of credit currently locked in active contracts
    // (signed but not fully repaid). Available credit = approved - used.
    // Updated atomically in the financing-request controller.
    usedCredit: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Internal credit rating affecting markup percentage and
    // suspicious-activity decisions. Starts at 100, decreases on
    // missed/late payments, increases on consistent on-time payments.
    creditRating: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
    },

    // KYC documents — references to uploaded files (stored locally
    // for dev, easy to swap for S3/Cloudinary later).
    documents: {
      ntnCertificate: { type: String, default: null },
      secpCertificate: { type: String, default: null },
      bankStatement: { type: String, default: null },
      utilityBill: { type: String, default: null },
    },

    // Reason field used when admin rejects KYC or blocks a startup.
    adminNotes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

// Virtual: available credit at any moment.
startupSchema.virtual("availableCredit").get(function () {
  return Math.max(0, this.approvedCreditLimit - this.usedCredit);
});

startupSchema.set("toJSON", { virtuals: true });
startupSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Startup", startupSchema);
