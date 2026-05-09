// ==============================================================
// Notification Routes
// --------------------------------------------------------------
// All routes require auth. The user's own _id is the implicit
// filter — a user can never see/edit/delete someone else's
// notifications.
// ==============================================================

const express = require("express");

const notificationController = require("../controllers/notification.controller");
const notificationValidation = require("../validations/notification.validation");

const { validate, validateObjectIdParam } = require("../middlewares/validate");
const authenticate = require("../middlewares/authenticate");

const router = express.Router();

router.use(authenticate);

// IMPORTANT: literal paths before `:id` routes — Express matches
// in order, so /unread-count and /read-all must come first.
router.get("/unread-count", notificationController.unreadCount);
router.patch("/read-all", notificationController.markAllRead);

router.get(
  "/",
  validate(notificationValidation.listQuery, "query"),
  notificationController.list
);

router.patch(
  "/:id/read",
  validateObjectIdParam("id"),
  notificationController.markRead
);

router.delete(
  "/:id",
  validateObjectIdParam("id"),
  notificationController.remove
);

module.exports = router;
