// ==============================================================
// Vendor Routes
// --------------------------------------------------------------
// Public:
//   GET    /                — active vendors only
//
// Admin-only (require auth + role):
//   GET    /all             — full list including inactive
//   GET    /:id             — single vendor
//   POST   /                — create
//   PUT    /:id             — update
//   DELETE /:id             — soft-deactivate
// ==============================================================

const express = require("express");

const vendorController = require("../controllers/vendor.controller");
const vendorValidation = require("../validations/vendor.validation");

const { validate, validateObjectIdParam } = require("../middlewares/validate");
const authenticate = require("../middlewares/authenticate");
const requireRole = require("../middlewares/requireRole");

const router = express.Router();

// Public — no auth required
router.get("/", vendorController.listActive);

// Admin section — apply auth+role to everything below
router.use(authenticate, requireRole("admin"));

router.get("/all", vendorController.listAll);
router.get("/:id", validateObjectIdParam("id"), vendorController.getById);

router.post(
  "/",
  validate(vendorValidation.createVendor),
  vendorController.create
);

router.put(
  "/:id",
  validateObjectIdParam("id"),
  validate(vendorValidation.updateVendor),
  vendorController.update
);

router.delete(
  "/:id",
  validateObjectIdParam("id"),
  vendorController.deactivate
);

module.exports = router;
