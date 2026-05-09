// ==============================================================
// Payment Routes
// --------------------------------------------------------------
// All require auth. Manual pay is rate-limited.
// ==============================================================

const express = require("express");

const paymentController = require("../controllers/payment.controller");
const { validateObjectIdParam } = require("../middlewares/validate");
const authenticate = require("../middlewares/authenticate");
const requireRole = require("../middlewares/requireRole");
const { sensitiveLimiter } = require("../middlewares/rateLimiter");

const router = express.Router();

router.use(authenticate);

router.get("/", paymentController.list);

router.post(
  "/pay/:scheduleId",
  requireRole("startup"),
  sensitiveLimiter,
  validateObjectIdParam("scheduleId"),
  paymentController.payInstallment
);

router.get("/:id", validateObjectIdParam("id"), paymentController.getOne);
router.get(
  "/:id/receipt",
  validateObjectIdParam("id"),
  paymentController.getReceipt
);

module.exports = router;
