// ==============================================================
// Startup Routes
// --------------------------------------------------------------
// All endpoints require:
//   1. authenticate          (valid JWT, user not blocked)
//   2. requireRole("startup") (must be a startup, not admin)
// ==============================================================

const express = require("express");

const startupController = require("../controllers/startup.controller");
const startupValidation = require("../validations/startup.validation");

const { validate } = require("../middlewares/validate");
const authenticate = require("../middlewares/authenticate");
const requireRole = require("../middlewares/requireRole");
const { kycUploader } = require("../middlewares/upload");

const router = express.Router();

// Apply auth + role guard to every route in this router.
router.use(authenticate, requireRole("startup"));

router.get("/me", startupController.getMyStartup);

router.put(
  "/me",
  validate(startupValidation.updateProfile),
  startupController.updateMyStartup
);

router.get("/me/kyc-status", startupController.getKycStatus);

// KYC upload — multer's .fields() accepts up to one file per
// named field. We allow all four document types in the same form.
router.post(
  "/me/kyc-documents",
  kycUploader.single("file"),
  startupController.uploadKycDocuments
);

module.exports = router;
