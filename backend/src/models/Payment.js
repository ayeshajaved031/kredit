// ==============================================================
// Payment Model
// --------------------------------------------------------------
// Every payment attempt — successful or failed — gets a row.
// Linked to a specific RepaymentSchedule installment.
//
// Why store failed attempts? Two reasons:
//   1. Audit trail — we need to prove what happened during disputes.
//   2. Suspicious-activity / credit-rating logic uses failed
//      attempt counts (e.g., 3 failed in a day = credit rating
//      drop, per the iteration doc Flow 5).
//
// Payment gateway is simulated for the MVP (utils/paymentGateway.js)
// returning success/failure based on test inputs. The schema is
// already shaped to match real JazzCash/PayFast/Stripe responses
// so the gateway can be swapped later without schema changes.
// ==============================================================

const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    paymentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      // Format: PAY-YYYYMMDD-XXXXXX
    },

    contractId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MurabahaContract",
      required: true,
      index: true,
    },

    scheduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RepaymentSchedule",
      required: true,
      index: true,
    },

    startupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Startup",
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 1,
    },

    method: {
      type: String,
      enum: ["jazzcash", "easypaisa", "payfast", "bank_transfer", "manual_admin"],
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "successful", "failed"],
      required: true,
      index: true,
    },

    // Whether this was an automatic monthly deduction or a manual
    // payment initiated by the startup
    initiatedBy: {
      type: String,
      enum: ["auto", "user", "admin"],
      default: "auto",
    },

    // Gateway-side details for reconciliation
    gatewayReference: { type: String, default: "" },
    gatewayResponseCode: { type: String, default: "" },
    gatewayResponseMessage: { type: String, default: "" },

    // For failed payments — reason from gateway
    failureReason: { type: String, default: "" },

    // Receipt URL (PDF generated server-side and stored). Optional
    // for failed payments.
    receiptUrl: { type: String, default: "" },
  },
  { timestamps: true }
);

paymentSchema.index({ startupId: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Payment", paymentSchema);
