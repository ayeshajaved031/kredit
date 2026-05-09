// ==============================================================
// Vendor Model
// --------------------------------------------------------------
// SaaS vendors that Kredit will pay on behalf of startups
// (AWS, Salesforce, HubSpot, etc.). Managed by admins — startups
// pick from this list when submitting a financing request.
//
// Why a collection instead of an enum? Two reasons:
//   1. Admins can add new vendors without code deployment.
//   2. We can store vendor-specific metadata (typical discount %,
//      preferred payment method, contact info for vendor billing).
// ==============================================================

const mongoose = require("mongoose");

const vendorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      maxlength: 80,
    },

    slug: {
      type: String,
      required: true,
      lowercase: true,
      unique: true,
      // auto-generated from name in pre-save hook
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    category: {
      type: String,
      enum: [
        "cloud_infrastructure", // AWS, Azure, GCP
        "crm", // Salesforce, HubSpot
        "productivity", // Slack, Notion, Linear
        "design", // Figma, Adobe
        "analytics", // Mixpanel, Amplitude
        "communication", // Zoom, Twilio
        "developer_tools", // GitHub, Vercel, MongoDB Atlas
        "other",
      ],
      required: true,
    },

    logoUrl: {
      type: String,
      trim: true,
      default: "",
    },

    websiteUrl: {
      type: String,
      trim: true,
      default: "",
    },

    // Typical annual discount this vendor offers vs monthly billing.
    // Used to display "estimated savings" on the financing form.
    typicalAnnualDiscountPercent: {
      type: Number,
      min: 0,
      max: 99,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Auto-generate slug from name
vendorSchema.pre("validate", function (next) {
  if (this.name && (!this.slug || this.isModified("name"))) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
  next();
});

module.exports = mongoose.model("Vendor", vendorSchema);
