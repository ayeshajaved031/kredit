// ==============================================================
// Support Ticket Routes
// --------------------------------------------------------------
// Mix of role permissions:
//   - Create / list own / view own / reply own  → startup
//   - List all / view any / reply any           → admin
//   - Update status / assign                    → admin only
// ==============================================================

const express = require("express");

const ticketController = require("../controllers/ticket.controller");
const ticketValidation = require("../validations/ticket.validation");

const { validate, validateObjectIdParam } = require("../middlewares/validate");
const authenticate = require("../middlewares/authenticate");
const requireRole = require("../middlewares/requireRole");
const { ticketAttachmentUploader } = require("../middlewares/upload");
const { sensitiveLimiter } = require("../middlewares/rateLimiter");

const router = express.Router();

router.use(authenticate);

// Create — startup only, multipart with optional attachment.
// Multer runs first so the validator sees the parsed body.
router.post(
  "/",
  requireRole("startup"),
  sensitiveLimiter,
  ticketAttachmentUploader.single("attachment"),
  validate(ticketValidation.createTicket),
  ticketController.createTicket
);

// List — both roles, behavior differs in controller
router.get("/", ticketController.listTickets);

// View one — both roles
router.get(
  "/:id",
  validateObjectIdParam("id"),
  ticketController.getTicket
);

// Reply — both roles, ownership enforced in controller
router.post(
  "/:id/replies",
  validateObjectIdParam("id"),
  ticketAttachmentUploader.single("attachment"),
  validate(ticketValidation.addReply),
  ticketController.addReply
);

// Status update — admin only
router.patch(
  "/:id/status",
  requireRole("admin"),
  validateObjectIdParam("id"),
  validate(ticketValidation.updateStatus),
  ticketController.updateStatus
);

// Assign — admin only
router.patch(
  "/:id/assign",
  requireRole("admin"),
  validateObjectIdParam("id"),
  validate(ticketValidation.assignTicket),
  ticketController.assignTicket
);

module.exports = router;
