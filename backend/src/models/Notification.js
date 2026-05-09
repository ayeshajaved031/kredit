// ==============================================================
// Notification Model
// --------------------------------------------------------------
// In-app notifications shown to users. Created by:
//   - financing-request controller (status changes)
//   - contract controller (signed, vendor paid)
//   - payment controller (success, failure, reminder)
//   - admin actions (KYC approved, account blocked)
//
// Email notifications go through utils/mailer.js separately —
// most notification events fire BOTH a Notification doc and an
// email.
// ==============================================================

const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    type: {
      type: String,
      enum: [
        "kyc",
        "financing_request",
        "contract",
        "payment",
        "ticket",
        "account",
        "system",
      ],
      required: true,
      index: true,
    },

    severity: {
      type: String,
      enum: ["info", "success", "warning", "error"],
      default: "info",
    },

    readStatus: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Deep-link data — the frontend uses these to route the user
    // to the relevant page when they click the notification.
    actionUrl: { type: String, default: "" },

    relatedRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FinancingRequest",
      default: null,
    },
    relatedContractId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MurabahaContract",
      default: null,
    },
    relatedPaymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, readStatus: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
