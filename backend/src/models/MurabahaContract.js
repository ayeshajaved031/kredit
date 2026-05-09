// ==============================================================
// MurabahaContract Model
// --------------------------------------------------------------
// The Shariah-compliant financing contract generated when an
// admin approves a financing request.
//
// Murabaha mechanics (from the iteration doc):
//   1. Kredit "buys" the SaaS subscription as an asset at the
//      vendor's annual price (principal).
//   2. Kredit resells the same asset to the startup at a fixed
//      higher total price (principal + markup).
//   3. Startup repays the total in 12 equal monthly installments.
//   4. Markup is fixed and disclosed up front — no interest, no
//      compounding. This is the key compliance requirement.
//
// We store all the calculated numbers (principal, markup, total,
// monthly installment) on the contract itself so they're locked
// at signing time and immune to later config/env changes.
//
// Lifecycle:
//   draft   — generated, awaiting startup signature
//   active  — startup signed, Kredit has paid the vendor
//   completed — all 12 installments paid
//   defaulted — startup missed enough installments to trigger default
//   cancelled — withdrawn before signing
// ==============================================================

const mongoose = require("mongoose");

const murabahaContractSchema = new mongoose.Schema(
  {
    contractId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      // Format: KMC-YYYYMMDD-XXXXXX (Kredit Murabaha Contract)
    },

    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FinancingRequest",
      required: true,
      unique: true, // one contract per request
    },

    startupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Startup",
      required: true,
      index: true,
    },

    // ----- Money fields (all PKR, locked at contract creation) -----
    principalAmount: {
      type: Number,
      required: true,
      min: 1,
    },

    markupPercent: {
      type: Number,
      required: true,
      min: 0,
      max: 50, // sanity ceiling
    },

    markupAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    totalPayable: {
      type: Number,
      required: true,
      min: 1,
    },

    monthlyInstallment: {
      type: Number,
      required: true,
      min: 1,
    },

    installmentCount: {
      type: Number,
      default: 12,
      min: 1,
      max: 36,
    },

    // ----- Vendor payment tracking -----
    // Once contract is signed, Kredit pays the vendor. We log
    // when and how the vendor was paid for audit purposes.
    vendorPaymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
    vendorPaidAt: { type: Date, default: null },
    vendorPaymentReference: { type: String, default: "" },

    // ----- Repayment progress (denormalized for fast dashboard) -----
    // These are kept in sync by the Payment controller. Source of
    // truth is still the RepaymentSchedule collection, but reading
    // these counters avoids running an aggregation on every page.
    paidInstallments: { type: Number, default: 0, min: 0 },
    totalPaidAmount: { type: Number, default: 0, min: 0 },
    nextDueDate: { type: Date, default: null },
    overdueCount: { type: Number, default: 0, min: 0 },

    // ----- Lifecycle -----
    status: {
      type: String,
      enum: ["draft", "active", "completed", "defaulted", "cancelled"],
      default: "draft",
      index: true,
    },

    // ----- Signing data -----
    signedAt: { type: Date, default: null },
    signatureHash: { type: String, default: "" }, // hash of sig + password confirmation
    signatureIpAddress: { type: String, default: "" },

    // First installment due 30 days after activation
    activatedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },

    // ----- Legal terms snapshot -----
    // We store the contract terms text at the moment of signing so
    // future template changes don't affect old contracts.
    termsAndConditions: { type: String, required: true },

    latePaymentFeePercent: { type: Number, default: 2 }, // 2% of installment
  },
  { timestamps: true }
);

murabahaContractSchema.index({ startupId: 1, status: 1 });

module.exports = mongoose.model("MurabahaContract", murabahaContractSchema);
