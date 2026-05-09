// ==============================================================
// SupportTicket Model
// --------------------------------------------------------------
// Customer-support tickets opened by startups. Reviewed and
// resolved by Kredit admin staff.
//
// Workflow (iteration doc Flow 7):
//   1. Startup opens ticket with category, description, optional
//      screenshot.
//   2. Backend assigns a ticket number, emails confirmation.
//   3. Admin reviews via admin panel, replies, and marks resolved.
// ==============================================================

const mongoose = require("mongoose");

const ticketReplySchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    authorRole: {
      type: String,
      enum: ["startup", "admin"],
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    attachmentUrl: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const supportTicketSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      // Format: TKT-YYYYMMDD-XXXX
    },

    openedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    startupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Startup",
      required: true,
      index: true,
    },

    category: {
      type: String,
      enum: [
        "billing_issue",
        "contract_question",
        "technical_problem",
        "kyc_query",
        "payment_failure",
        "other",
      ],
      required: true,
    },

    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    initialAttachmentUrl: { type: String, default: "" },

    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },

    status: {
      type: String,
      enum: ["open", "in_progress", "resolved", "closed"],
      default: "open",
      index: true,
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Optional link if the ticket relates to a specific contract
    relatedContractId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MurabahaContract",
      default: null,
    },

    replies: [ticketReplySchema],

    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

supportTicketSchema.index({ startupId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("SupportTicket", supportTicketSchema);
