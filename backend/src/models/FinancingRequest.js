// ==============================================================
// FinancingRequest Model
// --------------------------------------------------------------
// The application a startup submits to finance a SaaS subscription
// through Kredit. Lifecycle:
//
//   pending      → just submitted, awaiting admin review
//   under_review → admin has opened it
//   approved     → admin approved, contract auto-generated next
//   rejected     → admin rejected (with reason in adminNotes)
//   expired      → approved but startup didn't sign within deadline
//
// On approval, a MurabahaContract is created and this request is
// effectively "closed" — startups can't edit a request after
// submission, only withdraw it while still pending.
//
// requestId format: REQ-YYYYMMDD-XXXXXX (human-readable, unique)
// ==============================================================

const mongoose = require("mongoose");

const financingRequestSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    startupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Startup",
      required: true,
      index: true,
    },

    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },

    // Snapshot of vendor name at request time — protects against
    // vendor renames affecting historical records.
    vendorNameSnapshot: { type: String, required: true },

    // Annual cost of the SaaS subscription (what Kredit will pay
    // the vendor). This is the principal Kredit advances. Markup
    // is added on top during contract generation.
    annualAmountPKR: {
      type: Number,
      required: [true, "Annual amount is required"],
      min: [1, "Amount must be greater than zero"],
    },

    // Subscription details for record-keeping
    subscriptionDetails: {
      planName: { type: String, trim: true, required: true },
      // For example AWS "Reserved Instance — t3.medium, 1-year, all-upfront"
      planDescription: { type: String, trim: true, default: "" },
      coveragePeriodMonths: {
        type: Number,
        default: 12,
        min: 1,
        max: 36,
      },
    },

    // The startup uploads the vendor's actual invoice/quote PDF.
    // We store the local file path; in production this points to
    // a Cloudinary/S3 URL.
    vendorInvoiceFileUrl: {
      type: String,
      required: [true, "Vendor invoice PDF is required"],
    },

    vendorInvoiceFileName: { type: String, default: "" },

    status: {
      type: String,
      enum: ["pending", "under_review", "approved", "rejected", "expired", "withdrawn"],
      default: "pending",
      index: true,
    },

    // Admin who reviewed (if any) and their notes
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: { type: Date, default: null },
    adminNotes: { type: String, trim: true, default: "" },

    // If approved, link to the resulting contract
    contractId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MurabahaContract",
      default: null,
    },
  },
  { timestamps: true }
);

// Common admin query: "all pending requests, oldest first" (FIFO review)
financingRequestSchema.index({ status: 1, createdAt: 1 });

// Common startup query: "my requests, newest first"
financingRequestSchema.index({ startupId: 1, createdAt: -1 });

module.exports = mongoose.model("FinancingRequest", financingRequestSchema);
