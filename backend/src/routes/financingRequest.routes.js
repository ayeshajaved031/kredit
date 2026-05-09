// ==============================================================
// Financing Request Routes
// --------------------------------------------------------------
// All endpoints require authentication. Role-based authorization
// is handled inside the controllers because some endpoints serve
// both startup and admin roles with different behavior.
//
// Routes:
//   POST   /                  startup — submit (multipart, PDF upload)
//   GET    /                  any     — list (own for startup, all for admin)
//   GET    /admin/queue       admin   — pending requests, FIFO
//   GET    /:id               any     — view one (ownership-checked)
//   DELETE /:id               startup — withdraw own pending request
//
// IMPORTANT: route order matters! /admin/queue must be defined
// BEFORE /:id, otherwise Express interprets "admin" as an :id
// param and the ObjectId validator fails.
// ==============================================================

const express = require("express");

const financingRequestController = require("../controllers/financingRequest.controller");
const financingRequestValidation = require("../validations/financingRequest.validation");

const { validate, validateObjectIdParam } = require("../middlewares/validate");
const authenticate = require("../middlewares/authenticate");
const requireRole = require("../middlewares/requireRole");
const { vendorInvoiceUploader } = require("../middlewares/upload");
const { sensitiveLimiter } = require("../middlewares/rateLimiter");

const router = express.Router();

// All routes require auth
router.use(authenticate);

// Startup-only — submit
router.post(
  "/",
  requireRole("startup"),
  sensitiveLimiter,
  // Multer runs FIRST so multipart fields populate req.body for the validator.
  // single("invoice") expects exactly one file under field name "invoice".
  vendorInvoiceUploader.single("invoice"),
  validate(financingRequestValidation.submitRequest),
  financingRequestController.submit
);

// List — any role (controller filters by role)
router.get("/", financingRequestController.list);

// Admin-only convenience queue
router.get(
  "/admin/queue",
  requireRole("admin"),
  financingRequestController.adminQueue
);

// View one — ownership enforced in controller
router.get(
  "/:id",
  validateObjectIdParam("id"),
  financingRequestController.getOne
);

// Withdraw — startup only
router.delete(
  "/:id",
  requireRole("startup"),
  validateObjectIdParam("id"),
  financingRequestController.withdraw
);

module.exports = router;
