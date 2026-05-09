// ==============================================================
// Admin Reports Routes
// --------------------------------------------------------------
// Mounted at /api/admin/reports/*. All routes require admin role.
// All endpoints are read-only — no audit log entries written.
// ==============================================================

const express = require("express");

const reportController = require("../controllers/report.controller");
const authenticate = require("../middlewares/authenticate");
const requireRole = require("../middlewares/requireRole");

const router = express.Router();

router.use(authenticate, requireRole("admin"));

router.get("/portfolio-overview", reportController.portfolioOverview);
router.get("/monthly-disbursement", reportController.monthlyDisbursement);
router.get("/repayment-performance", reportController.repaymentPerformance);
router.get("/top-vendors", reportController.topVendors);
router.get("/audit-summary", reportController.auditSummary);

module.exports = router;
