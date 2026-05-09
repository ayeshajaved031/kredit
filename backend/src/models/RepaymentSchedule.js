// ==============================================================
// RepaymentSchedule Model
// --------------------------------------------------------------
// One document per installment. A 12-month contract produces 12
// schedule rows, generated atomically when the contract becomes
// active (after startup signs).
//
// This is the source of truth for "what's due when". The contract
// has denormalized counters for fast reads, but those are derived
// from this collection.
//
// Why per-row instead of an array on the contract?
//   - Easier to query "all overdue across all contracts" for admin
//   - Easier to attach a Payment record to a specific installment
//   - Per-row indexes make due-date scheduling cheap
// ==============================================================

const mongoose = require("mongoose");

const repaymentScheduleSchema = new mongoose.Schema(
  {
    contractId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MurabahaContract",
      required: true,
      index: true,
    },

    startupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Startup",
      required: true,
      index: true,
    },

    installmentNumber: {
      type: Number,
      required: true,
      min: 1,
    },

    amountDue: {
      type: Number,
      required: true,
      min: 1,
    },

    dueDate: {
      type: Date,
      required: true,
      index: true,
    },

    // Lifecycle:
    //   unpaid    — not yet attempted
    //   paid      — successfully paid (linked Payment doc)
    //   overdue   — due date passed without successful payment
    //   waived    — admin manually waived (rare; audit-logged)
    status: {
      type: String,
      enum: ["unpaid", "paid", "overdue", "waived"],
      default: "unpaid",
      index: true,
    },

    // Set when status becomes "paid"
    paidAt: { type: Date, default: null },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },

    // Late fee accrued if status flipped to overdue
    lateFeeAmount: { type: Number, default: 0, min: 0 },

    // Number of failed payment attempts on this installment
    failedAttempts: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// Compound: for "list this contract's schedule in order"
repaymentScheduleSchema.index({ contractId: 1, installmentNumber: 1 }, { unique: true });

// For the cron-style "find all due today" scheduler
repaymentScheduleSchema.index({ status: 1, dueDate: 1 });

module.exports = mongoose.model("RepaymentSchedule", repaymentScheduleSchema);
