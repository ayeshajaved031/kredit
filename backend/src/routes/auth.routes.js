// ==============================================================
// Auth Routes
// --------------------------------------------------------------
// Each route shows its middleware chain inline so it's clear
// which protections apply.
// ==============================================================

const express = require("express");

const authController = require("../controllers/auth.controller");
const authValidation = require("../validations/auth.validation");

const { validate } = require("../middlewares/validate");
const { authLimiter } = require("../middlewares/rateLimiter");
const authenticate = require("../middlewares/authenticate");

const router = express.Router();

// Public — registration and login are rate-limited (10/15min)
router.post(
  "/register",
  authLimiter,
  validate(authValidation.registerStartup),
  authController.register
);

router.post(
  "/login",
  authLimiter,
  validate(authValidation.login),
  authController.login
);

router.post(
  "/forgot-password",
  authLimiter,
  validate(authValidation.forgotPassword),
  authController.forgotPassword
);

router.post(
  "/reset-password/:token",
  authLimiter,
  validate(authValidation.resetPassword),
  authController.resetPassword
);

router.post("/verify-email/:token", authLimiter, authController.verifyEmail);

// Protected
router.post("/logout", authenticate, authController.logout);
router.get("/me", authenticate, authController.me);

router.put(
  "/change-password",
  authenticate,
  validate(authValidation.changePassword),
  authController.changePassword
);

module.exports = router;
