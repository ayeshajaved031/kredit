// ==============================================================
// Auth Controller
// --------------------------------------------------------------
// Handles registration, login, logout, email verification, and
// password reset flows. All endpoints return the standard
// { success, message, data } envelope.
//
// Security choices documented inline at each handler.
// ==============================================================

const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const mongoose = require("mongoose");

const User = require("../models/User");
const Startup = require("../models/Startup");
const AuditLog = require("../models/AuditLog");

const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const { ok } = require("../utils/response");
const { sign } = require("../utils/jwt");
const { sendMail, templates } = require("../utils/mailer");

const BCRYPT_ROUNDS = 12;
const FAILED_LOGIN_LIMIT = 5;
const LOCK_DURATION_MIN = 15;

// ---------------- Helpers ----------------

// Hash a one-time token (email-verify or password-reset) before
// storing it. The user receives the raw token by email; we only
// keep the hash. If our DB is compromised, the leaked hashes
// can't be replayed against the verify/reset endpoints.
const hashToken = (raw) =>
  crypto.createHash("sha256").update(raw).digest("hex");

// Generate a cryptographically random token (40 hex chars).
const randomToken = () => crypto.randomBytes(20).toString("hex");

const audit = async ({ actorId, actorRole, action, targetType, targetId, details, req }) => {
  // Best-effort — never block the response on audit-log failures.
  try {
    await AuditLog.create({
      actorId,
      actorRole,
      action,
      targetType,
      targetId: String(targetId),
      details: details || {},
      ipAddress: req?.ip || "",
      userAgent: req?.headers?.["user-agent"] || "",
    });
  } catch (err) {
    console.error("[AuditLog] Failed to write entry:", err.message);
  }
};

// ==============================================================
// POST /api/auth/register
// --------------------------------------------------------------
// Registers a new STARTUP user (admins are created via seed
// script — never via public registration).
//
// Atomic operation: creates BOTH the User and the Startup in a
// single MongoDB transaction. If either fails, neither is saved.
//
// Returns 201 + a JWT so the user can immediately access their
// (limited, KYC-pending) account. Email verification email is
// sent in the background.
// ==============================================================
const register = asyncHandler(async (req, res) => {
  const {
    fullName,
    email,
    password,
    phone,
    companyName,
    registrationType,
    registrationNumber,
    address,
    industry,
    teamSize,
    annualRevenuePKR,
  } = req.body;

  // Pre-flight uniqueness checks (we'd hit the unique index anyway,
  // but doing them explicitly gives clearer error messages).
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedRegNumber = registrationNumber.trim().toUpperCase();

  const [existingUser, existingStartup] = await Promise.all([
    User.findOne({ email: normalizedEmail }).lean(),
    Startup.findOne({ registrationNumber: normalizedRegNumber }).lean(),
  ]);
  if (existingUser) {
    throw new AppError("An account with this email already exists", 409);
  }
  if (existingStartup) {
    throw new AppError(
      "A company with this registration number is already registered",
      409
    );
  }

  // Hash password BEFORE the transaction so we don't hold an open
  // transaction while bcrypt is grinding.
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // Generate email-verification token + 24h expiry.
  const rawVerifyToken = randomToken();
  const verifyTokenHash = hashToken(rawVerifyToken);
  const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // Atomic create — User + Startup in one transaction.
  // Falls back to non-transactional create if the deployment is on
  // a single-node MongoDB (transactions need a replica set).
  // Atlas free-tier IS a replica set, so this works in production.
  let user;
  let startup;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const userDocs = await User.create(
        [
          {
            fullName: fullName.trim(),
            email: normalizedEmail,
            passwordHash,
            phone: phone || undefined,
            role: "startup",
            status: "pending", // becomes "active" after email verification
            emailVerificationToken: verifyTokenHash,
            emailVerificationExpires: verifyExpiry,
          },
        ],
        { session }
      );
      user = userDocs[0];

      const startupDocs = await Startup.create(
        [
          {
            userId: user._id,
            companyName: companyName.trim(),
            registrationType,
            registrationNumber: normalizedRegNumber,
            operationalAddress: address,
            industry: industry || "other",
            teamSize: teamSize || 1,
            annualRevenuePKR: annualRevenuePKR || 0,
            kycStatus: "unverified",
            approvedCreditLimit: 0, // admin sets this after KYC
          },
        ],
        { session }
      );
      startup = startupDocs[0];
    });
  } catch (err) {
    // Standalone MongoDB? Fall back to non-transactional flow.
    // This keeps local dev simple even without a replica set.
    if (err.codeName === "IllegalOperation" || /Transaction numbers/.test(err.message || "")) {
      user = await User.create({
        fullName: fullName.trim(),
        email: normalizedEmail,
        passwordHash,
        phone: phone || undefined,
        role: "startup",
        status: "pending",
        emailVerificationToken: verifyTokenHash,
        emailVerificationExpires: verifyExpiry,
      });
      try {
        startup = await Startup.create({
          userId: user._id,
          companyName: companyName.trim(),
          registrationType,
          registrationNumber: normalizedRegNumber,
          operationalAddress: address,
          industry: industry || "other",
          teamSize: teamSize || 1,
          annualRevenuePKR: annualRevenuePKR || 0,
          kycStatus: "unverified",
          approvedCreditLimit: 0,
        });
      } catch (innerErr) {
        // Rollback: if Startup creation failed, delete the orphan user.
        await User.deleteOne({ _id: user._id });
        throw innerErr;
      }
    } else {
      throw err;
    }
  } finally {
    session.endSession();
  }

  // Send verification email (best-effort — registration succeeds
  // even if email fails; user can request a resend later).
  const verifyUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/verify-email/${rawVerifyToken}`;
  try {
    await sendMail({
      to: user.email,
      ...templates.verificationEmail({ name: user.fullName, verifyUrl }),
    });
  } catch (mailErr) {
    console.error("[Mail] Verification email failed:", mailErr.message);
  }

  await audit({
    actorId: user._id,
    actorRole: "startup",
    action: "USER_REGISTER",
    targetType: "user",
    targetId: user._id,
    details: { email: user.email, companyName: startup.companyName },
    req,
  });

  // Issue JWT immediately so the frontend can show the KYC-pending
  // dashboard without a second login round-trip.
  const token = sign(user);

  return ok(res, {
    status: 201,
    message: "Registration successful. Please verify your email.",
    data: {
      token,
      user: user.toJSON(),
      startup: startup.toJSON(),
    },
  });
});

// ==============================================================
// POST /api/auth/login
// --------------------------------------------------------------
// Verifies credentials, issues JWT. Implements progressive
// lockout: 5 failed attempts within a session → 15-minute lock.
//
// We always return the SAME error message for "no such user" and
// "wrong password" — leaking which one is invalid helps attackers
// enumerate valid email addresses.
// ==============================================================
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
    "+passwordHash +failedLoginAttempts +lockedUntil"
  );

  // Generic "invalid credentials" — no email enumeration.
  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  if (user.isLocked()) {
    const remainingMin = Math.ceil((user.lockedUntil - Date.now()) / 60000);
    throw new AppError(
      `Account locked due to too many failed attempts. Try again in ${remainingMin} minute(s).`,
      423
    );
  }

  if (user.status === "blocked") {
    throw new AppError("Your account has been blocked. Contact support.", 403);
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= FAILED_LOGIN_LIMIT) {
      user.lockedUntil = new Date(Date.now() + LOCK_DURATION_MIN * 60_000);
      user.failedLoginAttempts = 0; // reset for after the lock expires
    }
    await user.save();

    await audit({
      actorId: user._id,
      actorRole: user.role,
      action: "USER_LOGIN_FAILED",
      targetType: "user",
      targetId: user._id,
      details: { reason: "wrong_password" },
      req,
    });

    throw new AppError("Invalid email or password", 401);
  }

  // Success — reset counters, stamp lastLogin.
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  user.lastLogin = new Date();
  await user.save();

  await audit({
    actorId: user._id,
    actorRole: user.role,
    action: "USER_LOGIN",
    targetType: "user",
    targetId: user._id,
    req,
  });

  const token = sign(user);

  // Attach startup if user is a startup role
  let startup = null;
  if (user.role === "startup") {
    startup = await Startup.findOne({ userId: user._id });
  }

  return ok(res, {
    message: "Login successful",
    data: {
      token,
      user: user.toJSON(),
      startup: startup ? startup.toJSON() : null,
    },
  });
});

// ==============================================================
// POST /api/auth/logout
// --------------------------------------------------------------
// Stateless JWT — logout is essentially a client-side action
// (drop the token). We return 200 as a success signal so the
// frontend can clear local state without ambiguity.
//
// True server-side revocation would require a token blacklist;
// out of scope for this MVP.
// ==============================================================
const logout = asyncHandler(async (_req, res) => {
  return ok(res, { message: "Logged out" });
});

// ==============================================================
// GET /api/auth/me
// --------------------------------------------------------------
// Returns the authenticated user's account + startup profile.
// Frontend calls this on app load to hydrate auth state.
// ==============================================================
const me = asyncHandler(async (req, res) => {
  let startup = null;
  if (req.user.role === "startup") {
    startup = await Startup.findOne({ userId: req.user._id });
  }
  return ok(res, {
    data: {
      user: req.user.toJSON(),
      startup: startup ? startup.toJSON() : null,
    },
  });
});

// ==============================================================
// POST /api/auth/verify-email/:token
// --------------------------------------------------------------
// Confirms email ownership. Marks user as active. The raw token
// is hashed and matched against the stored hash — see hashToken().
// ==============================================================
const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.params;
  if (!token) throw new AppError("Verification token is required", 400);

  const tokenHash = hashToken(token);
  const user = await User.findOne({
    emailVerificationToken: tokenHash,
    emailVerificationExpires: { $gt: new Date() },
  }).select("+emailVerificationToken +emailVerificationExpires");

  if (!user) {
    throw new AppError("Verification link is invalid or has expired", 400);
  }

  user.emailVerified = true;
  user.status = "active";
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  return ok(res, {
    message: "Email verified. Your account is now active.",
    data: { user: user.toJSON() },
  });
});

// ==============================================================
// POST /api/auth/forgot-password
// --------------------------------------------------------------
// Generates a 1-hour reset token, emails the link.
//
// We always return the same success message regardless of whether
// the email exists — this prevents email enumeration.
// ==============================================================
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email: email.toLowerCase().trim() });

  if (user) {
    const rawToken = randomToken();
    user.passwordResetToken = hashToken(rawToken);
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password/${rawToken}`;
    try {
      await sendMail({
        to: user.email,
        ...templates.passwordResetEmail({ name: user.fullName, resetUrl }),
      });
    } catch (mailErr) {
      console.error("[Mail] Reset email failed:", mailErr.message);
    }
  }

  // Same response shape whether the email existed or not.
  return ok(res, {
    message: "If an account exists for that email, a reset link has been sent.",
  });
});

// ==============================================================
// POST /api/auth/reset-password/:token
// --------------------------------------------------------------
// Sets a new password using a valid reset token.
// ==============================================================
const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  const tokenHash = hashToken(token);
  const user = await User.findOne({
    passwordResetToken: tokenHash,
    passwordResetExpires: { $gt: new Date() },
  }).select("+passwordResetToken +passwordResetExpires");

  if (!user) {
    throw new AppError("Reset link is invalid or has expired", 400);
  }

  user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  await user.save();

  await audit({
    actorId: user._id,
    actorRole: user.role,
    action: "USER_PASSWORD_RESET",
    targetType: "user",
    targetId: user._id,
    req,
  });

  return ok(res, { message: "Password reset successful. You can now log in." });
});

// ==============================================================
// PUT /api/auth/change-password (authenticated)
// --------------------------------------------------------------
// Changes password for a logged-in user. Requires the current
// password for confirmation.
// ==============================================================
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select("+passwordHash");
  if (!user) throw new AppError("User not found", 404);

  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) throw new AppError("Current password is incorrect", 401);

  user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await user.save();

  return ok(res, { message: "Password changed successfully" });
});

module.exports = {
  register,
  login,
  logout,
  me,
  verifyEmail,
  forgotPassword,
  resetPassword,
  changePassword,
};
