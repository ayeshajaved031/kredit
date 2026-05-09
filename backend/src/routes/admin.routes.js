// ==============================================================
// Admin Routes
// --------------------------------------------------------------
// Everything mounted under /api/admin requires:
//   1. authenticate          (valid JWT)
//   2. requireRole("admin")  (must be admin)
//
// Route grouping:
//   /dashboard/*             — summaries
//   /startups/*              — KYC review + credit limit
//   /financing-requests/*    — approve/reject
//   /users/*                 — block/unblock
//   /audit-logs              — sensitive-action log
// ==============================================================

const express = require("express");

const adminController = require("../controllers/admin.controller");
const adminValidation = require("../validations/admin.validation");

const reportRoutes = require("./report.routes");

const { validate, validateObjectIdParam } = require("../middlewares/validate");
const authenticate = require("../middlewares/authenticate");
const requireRole = require("../middlewares/requireRole");
const { sensitiveLimiter } = require("../middlewares/rateLimiter");

const router = express.Router();

// Apply auth + role guard to all admin routes
router.use(authenticate, requireRole("admin"));

// ---------- Reports (sub-router) ----------
// Mounted FIRST so /reports/* never collides with future :id routes.
// reportRoutes already applies its own authenticate+requireRole, but
// re-applying via this parent's `router.use` is fine — middlewares
// run idempotently and the inner ones short-circuit cleanly.
router.use("/reports", reportRoutes);

// ---------- Dashboard ----------
router.get("/dashboard/summary", adminController.dashboardSummary);

// ---------- Startups (KYC) ----------
router.get("/startups", adminController.listStartups);
router.get("/startups/:id", validateObjectIdParam("id"), adminController.getStartup);

router.post(
  "/startups/:id/kyc/approve",
  sensitiveLimiter,
  validateObjectIdParam("id"),
  validate(adminValidation.approveKyc),
  adminController.approveKyc
);

router.post(
  "/startups/:id/kyc/reject",
  sensitiveLimiter,
  validateObjectIdParam("id"),
  validate(adminValidation.rejectKyc),
  adminController.rejectKyc
);

router.put(
  "/startups/:id/credit-limit",
  sensitiveLimiter,
  validateObjectIdParam("id"),
  validate(adminValidation.updateCreditLimit),
  adminController.updateCreditLimit
);

// ---------- Financing Requests ----------
router.post(
  "/financing-requests/:id/approve",
  sensitiveLimiter,
  validateObjectIdParam("id"),
  validate(adminValidation.approveRequest),
  adminController.approveRequest
);

router.post(
  "/financing-requests/:id/reject",
  sensitiveLimiter,
  validateObjectIdParam("id"),
  validate(adminValidation.rejectRequest),
  adminController.rejectRequest
);

// ---------- Users ----------
router.get("/users", adminController.listUsers);

router.post(
  "/users/:id/block",
  sensitiveLimiter,
  validateObjectIdParam("id"),
  validate(adminValidation.blockUser),
  adminController.blockUser
);

router.post(
  "/users/:id/unblock",
  sensitiveLimiter,
  validateObjectIdParam("id"),
  adminController.unblockUser
);

// ---------- Audit Logs ----------
router.get("/audit-logs", adminController.listAuditLogs);

// ---------- Repayment Cycle ----------
router.post(
  "/repayments/run-daily-cycle",
  sensitiveLimiter,
  adminController.runRepaymentCycle
);

module.exports = router;
