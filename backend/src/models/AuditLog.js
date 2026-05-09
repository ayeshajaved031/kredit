// ==============================================================
// AuditLog Model
// --------------------------------------------------------------
// Append-only log of sensitive actions. Anything that changes
// money, account status, or contract terms gets logged here.
//
// Why? In a financing platform, "who approved this?" and "who
// changed this credit limit?" are questions you'll be asked
// during disputes. Without an audit trail, your word is all
// you've got.
// ==============================================================

const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    actorRole: {
      type: String,
      enum: ["startup", "admin", "system"],
      required: true,
    },

    action: {
      type: String,
      required: true,
      enum: [
        // Auth
        "USER_REGISTER",
        "USER_LOGIN",
        "USER_LOGIN_FAILED",
        "USER_PASSWORD_RESET",

        // Admin user management
        "BLOCK_USER",
        "UNBLOCK_USER",
        "APPROVE_KYC",
        "REJECT_KYC",
        "UPDATE_CREDIT_LIMIT",

        // Financing
        "SUBMIT_REQUEST",
        "APPROVE_REQUEST",
        "REJECT_REQUEST",
        "WITHDRAW_REQUEST",

        // Contract
        "GENERATE_CONTRACT",
        "SIGN_CONTRACT",
        "ACTIVATE_CONTRACT",
        "MARK_CONTRACT_DEFAULTED",

        // Payment
        "PAYMENT_SUCCESS",
        "PAYMENT_FAILED",
        "VENDOR_PAID",
        "WAIVE_INSTALLMENT",

        // Vendor management
        "ADD_VENDOR",
        "UPDATE_VENDOR",
        "DEACTIVATE_VENDOR",
      ],
      index: true,
    },

    targetType: {
      type: String,
      enum: ["user", "startup", "request", "contract", "payment", "vendor", "system"],
      required: true,
    },

    targetId: { type: String, required: true },

    details: { type: mongoose.Schema.Types.Mixed, default: {} },

    ipAddress: { type: String, default: "" },
    userAgent: { type: String, default: "" },
  },
  { timestamps: true }
);

auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
