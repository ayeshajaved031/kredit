// ==============================================================
// User Model
// --------------------------------------------------------------
// One collection for all platform users — startup founders/CTOs/
// finance managers AND Kredit admins. The `role` field decides
// what they can access. This keeps auth simple (one login flow,
// one JWT shape) while role middleware gates the admin endpoints.
//
// A "User" is the human account. The "Startup" collection holds
// the company profile linked to a user (1:1). We separate them
// because:
//   - Admin users don't have a startup profile
//   - A future feature might let multiple users belong to the
//     same startup (founder + CFO sharing one company account)
// ==============================================================

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [80, "Name cannot exceed 80 characters"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },

    passwordHash: {
      type: String,
      required: true,
      // Never select by default — shouldn't leak in any response.
      select: false,
    },

    role: {
      type: String,
      enum: {
        values: ["startup", "admin"],
        message: "Role must be 'startup' or 'admin'",
      },
      default: "startup",
      index: true,
    },

    // Account lifecycle:
    //   pending  — registered, awaiting email verification
    //   active   — verified, can use the platform
    //   blocked  — admin-disabled (suspended for non-payment, fraud, etc.)
    status: {
      type: String,
      enum: ["pending", "active", "blocked"],
      default: "pending",
      index: true,
    },

    // Optional Pakistani phone — for SMS reminders later.
    phone: {
      type: String,
      trim: true,
      match: [/^(\+92|0)?3\d{9}$/, "Please provide a valid Pakistani phone number"],
    },

    // Email verification flow
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },

    // Password reset flow
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },

    // Audit fields
    lastLogin: { type: Date, default: null },
    failedLoginAttempts: { type: Number, default: 0, select: false },
    lockedUntil: { type: Date, default: null, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.passwordHash;
        delete ret.emailVerificationToken;
        delete ret.emailVerificationExpires;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpires;
        delete ret.failedLoginAttempts;
        delete ret.lockedUntil;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Convenience helper used by middleware
userSchema.methods.isActive = function () {
  return this.status === "active";
};

userSchema.methods.isLocked = function () {
  return this.lockedUntil && this.lockedUntil > new Date();
};

module.exports = mongoose.model("User", userSchema);
