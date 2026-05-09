// ==============================================================
// Notification Controller
// --------------------------------------------------------------
// Endpoints (under /api/notifications, all authenticated):
//   GET    /                      — paginated list, filterable
//   GET    /unread-count          — single number, for the badge
//   PATCH  /:id/read              — mark one as read
//   PATCH  /read-all              — mark all unread as read
//   DELETE /:id                   — remove a notification
//
// Ownership: a user can only see and act on their own
// notifications. We always filter by userId on every query.
// Even admin users have their own notifications and can't read
// others' — that would be a privacy issue and isn't needed for
// any product flow.
// ==============================================================

const Notification = require("../models/Notification");

const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const { ok } = require("../utils/response");

// ==============================================================
// GET /api/notifications
// --------------------------------------------------------------
// Paginated. Filters:
//   ?unreadOnly=true     — only unread
//   ?type=payment        — by type
// Newest first.
// ==============================================================
const list = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 25, 100);
  const skip = Math.max(Number(req.query.skip) || 0, 0);

  const filter = { userId: req.user._id };

  if (req.query.unreadOnly === "true") {
    filter.readStatus = false;
  }

  if (req.query.type) {
    filter.type = req.query.type;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter),
    // Always return unread count alongside list — saves a second
    // round-trip from the frontend.
    Notification.countDocuments({ userId: req.user._id, readStatus: false }),
  ]);

  return ok(res, {
    data: {
      notifications,
      count: notifications.length,
      total,
      unreadCount,
      limit,
      skip,
    },
  });
});

// ==============================================================
// GET /api/notifications/unread-count
// --------------------------------------------------------------
// Lightweight endpoint for polling the bell-icon badge.
// ==============================================================
const unreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({
    userId: req.user._id,
    readStatus: false,
  });
  return ok(res, { data: { unreadCount: count } });
});

// ==============================================================
// PATCH /api/notifications/:id/read
// --------------------------------------------------------------
// Marks a single notification as read. Idempotent — already-read
// notifications return 200 (not 304/400) for simpler frontend.
// ==============================================================
const markRead = asyncHandler(async (req, res) => {
  // Filter on userId AS WELL AS _id so a user can't mark someone
  // else's notification as read.
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { $set: { readStatus: true } },
    { new: true }
  );

  if (!notification) {
    // 404 instead of 403 — same not-leaking-existence pattern as elsewhere
    throw new AppError("Notification not found", 404);
  }

  return ok(res, {
    message: "Notification marked as read",
    data: { notification },
  });
});

// ==============================================================
// PATCH /api/notifications/read-all
// --------------------------------------------------------------
// Bulk mark-all-as-read. Returns count of notifications updated
// so the frontend can update its badge optimistically.
// ==============================================================
const markAllRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { userId: req.user._id, readStatus: false },
    { $set: { readStatus: true } }
  );

  return ok(res, {
    message: "All notifications marked as read",
    data: { modifiedCount: result.modifiedCount || 0 },
  });
});

// ==============================================================
// DELETE /api/notifications/:id
// --------------------------------------------------------------
// Hard delete. Notifications aren't legally significant — unlike
// payments/contracts, they can be cleaned up freely.
// ==============================================================
const remove = asyncHandler(async (req, res) => {
  const result = await Notification.findOneAndDelete({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!result) {
    throw new AppError("Notification not found", 404);
  }

  return ok(res, { message: "Notification deleted" });
});

module.exports = {
  list,
  unreadCount,
  markRead,
  markAllRead,
  remove,
};
