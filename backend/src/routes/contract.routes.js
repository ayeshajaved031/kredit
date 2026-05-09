// ==============================================================
// Contract Routes
// --------------------------------------------------------------
// All require authentication. Sign endpoint is rate-limited
// (it's a sensitive financial action).
// ==============================================================

const express = require("express");

const contractController = require("../controllers/contract.controller");
const contractValidation = require("../validations/contract.validation");

const { validate, validateObjectIdParam } = require("../middlewares/validate");
const authenticate = require("../middlewares/authenticate");
const requireRole = require("../middlewares/requireRole");
const { sensitiveLimiter } = require("../middlewares/rateLimiter");

const router = express.Router();

router.use(authenticate);

router.get("/", contractController.list);

router.get(
  "/:id",
  validateObjectIdParam("id"),
  contractController.getOne
);

router.get(
  "/:id/schedule",
  validateObjectIdParam("id"),
  contractController.getSchedule
);

router.get(
  "/:id/document",
  validateObjectIdParam("id"),
  contractController.getDocument
);

router.post(
  "/:id/sign",
  requireRole("startup"),
  sensitiveLimiter,
  validateObjectIdParam("id"),
  validate(contractValidation.signContract),
  contractController.sign
);

module.exports = router;
