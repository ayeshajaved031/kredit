// ==============================================================
// Support Ticket Controller
// --------------------------------------------------------------
// Endpoints (under /api/tickets):
//   POST   /                    — startup opens a ticket (multipart)
//   GET    /                    — list (own for startup, all for admin)
//   GET    /:id                 — view one + reply thread
//   POST   /:id/replies         — startup or admin posts a reply
//   PATCH  /:id/status          — admin only — change status
//   PATCH  /:id/assign          — admin only — assign to admin user
//
// Authorization patterns:
//   - Startup endpoints filter by their own startupId, so they
//     can never see another startup's ticket (404 on miss).
//   - Reply endpoint allows BOTH startup (only on their own
//     ticket) and admin (any ticket).
//   - Status + assign are admin-only via requireRole.
// ==============================================================

const Startup = require("../models/Startup");
const SupportTicket = require("../models/SupportTicket");
const Notification = require("../models/Notification");
const User = require("../models/User");

const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const { ok } = require("../utils/response");
const { generateTicketId } = require("../utils/idGenerator");
const { publicUrlFor } = require("../middlewares/upload");
const { sendMail, templates } = require("../utils/mailer");

const MAX_ID_RETRIES = 3;

const safeMail = async (args) => {
  try { await sendMail(args); }
  catch (err) { console.error("[Mail] Failed:", err.message); }
};

const safeNotify = async (args) => {
  try { await Notification.create(args); }
  catch (err) { console.error("[Notification] Failed:", err.message); }
};

const truncate = (str, n) =>
  str.length > n ? str.slice(0, n - 1) + "…" : str;

// Helper: load the user's startup _id, or throw if not found
const getStartupId = async (user) => {
  if (user.role !== "startup") return null;
  const startup = await Startup.findOne({ userId: user._id }).select("_id");
  return startup ? startup._id : null;
};

// ==============================================================
// POST /api/tickets
// --------------------------------------------------------------
// Multipart: subject, description, category, priority?,
// relatedContractId?, attachment? (single image/pdf).
// ==============================================================
const createTicket = asyncHandler(async (req, res) => {
  // Only startups can open tickets via this endpoint. Admin staff
  // creating internal tickets is out of scope for the MVP.
  const startupId = await getStartupId(req.user);
  if (!startupId) {
    throw new AppError("Only startup users can open tickets", 403);
  }

  const file = req.file || null;

  // Generate unique ticket ID with retry
  let ticket = null;
  let lastErr = null;

  for (let attempt = 0; attempt < MAX_ID_RETRIES; attempt++) {
    try {
      ticket = await SupportTicket.create({
        ticketNumber: generateTicketId(),
        openedBy: req.user._id,
        startupId,
        category: req.body.category,
        subject: req.body.subject.trim(),
        description: req.body.description.trim(),
        priority: req.body.priority || "medium",
        initialAttachmentUrl: file ? publicUrlFor(req, file.path) : "",
        relatedContractId: req.body.relatedContractId || null,
        status: "open",
      });
      break;
    } catch (err) {
      if (err.code === 11000 && err.keyValue?.ticketNumber) {
        lastErr = err;
        continue;
      }
      throw err;
    }
  }

  if (!ticket) {
    throw lastErr || new AppError("Could not generate unique ticket ID", 500);
  }

  // Notify the user + email confirmation
  await safeNotify({
    userId: req.user._id,
    title: `Ticket ${ticket.ticketNumber} received`,
    message: `We're reviewing your ticket: "${truncate(ticket.subject, 80)}"`,
    type: "ticket",
    severity: "info",
    actionUrl: `/tickets/${ticket._id}`,
  });

  await safeMail({
    to: req.user.email,
    ...templates.ticketCreatedEmail({
      name: req.user.fullName,
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      category: ticket.category,
    }),
  });

  return ok(res, {
    status: 201,
    message: "Support ticket created. Our team will get back to you soon.",
    data: { ticket },
  });
});

// ==============================================================
// GET /api/tickets
// --------------------------------------------------------------
// Filters: ?status=, ?category=, ?priority=
// Pagination: ?limit=&skip=
// ==============================================================
const listTickets = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 25, 100);
  const skip = Math.max(Number(req.query.skip) || 0, 0);

  const filter = {};

  if (req.user.role === "startup") {
    const startupId = await getStartupId(req.user);
    if (!startupId) {
      return ok(res, { data: { tickets: [], count: 0, total: 0, limit, skip } });
    }
    filter.startupId = startupId;
  }

  if (req.query.status) {
    if (!["open", "in_progress", "resolved", "closed"].includes(req.query.status)) {
      throw new AppError("Invalid status filter", 400);
    }
    filter.status = req.query.status;
  }

  if (req.query.category) filter.category = req.query.category;
  if (req.query.priority) filter.priority = req.query.priority;

  const [tickets, total] = await Promise.all([
    SupportTicket.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: "startupId",
        select: req.user.role === "admin" ? "companyName registrationNumber" : "companyName",
      })
      .populate("assignedTo", "fullName email")
      // Exclude full reply array from list — we just want a preview
      .select("-replies")
      .lean(),
    SupportTicket.countDocuments(filter),
  ]);

  return ok(res, {
    data: { tickets, count: tickets.length, total, limit, skip },
  });
});

// ==============================================================
// GET /api/tickets/:id
// --------------------------------------------------------------
// Full ticket with reply thread. Ownership-checked for startups.
// ==============================================================
const getTicket = asyncHandler(async (req, res) => {
  const ticket = await SupportTicket.findById(req.params.id)
    .populate("startupId", "companyName registrationNumber userId")
    .populate("openedBy", "fullName email")
    .populate("assignedTo", "fullName email")
    .populate("replies.authorId", "fullName email role");

  if (!ticket) throw new AppError("Ticket not found", 404);

  if (req.user.role === "startup") {
    if (!ticket.startupId?.userId || ticket.startupId.userId.toString() !== req.user._id.toString()) {
      throw new AppError("Ticket not found", 404);
    }
  }

  return ok(res, { data: { ticket } });
});

// ==============================================================
// POST /api/tickets/:id/replies   (startup or admin)
// --------------------------------------------------------------
// Adds a reply to the thread. Body: { message }, optional file
// attachment via multipart.
//
// Authorization:
//   - Startup → only on own ticket
//   - Admin   → any ticket
//
// Side effects:
//   - Notifies the OTHER party (if startup posts → notify
//     ticket.assignedTo if any, else broadcast to admins via
//     opening; if admin posts → notify the ticket.openedBy)
//   - Reopens a resolved/closed ticket if startup replies
// ==============================================================
const addReply = asyncHandler(async (req, res) => {
  const ticket = await SupportTicket.findById(req.params.id).populate(
    "startupId",
    "userId companyName"
  );
  if (!ticket) throw new AppError("Ticket not found", 404);

  // Ownership for startups
  if (req.user.role === "startup") {
    if (!ticket.startupId?.userId || ticket.startupId.userId.toString() !== req.user._id.toString()) {
      throw new AppError("Ticket not found", 404);
    }
  }

  const file = req.file || null;
  const message = req.body.message.trim();

  ticket.replies.push({
    authorId: req.user._id,
    authorRole: req.user.role,
    message,
    attachmentUrl: file ? publicUrlFor(req, file.path) : "",
    createdAt: new Date(),
  });

  // Auto-reopen if startup replies on a resolved/closed ticket
  if (req.user.role === "startup" && ["resolved", "closed"].includes(ticket.status)) {
    ticket.status = "open";
    ticket.resolvedAt = null;
  }

  // Auto-progress: when admin first replies on an "open" ticket,
  // bump it to "in_progress" so the queue is accurate.
  if (req.user.role === "admin" && ticket.status === "open") {
    ticket.status = "in_progress";
    if (!ticket.assignedTo) {
      ticket.assignedTo = req.user._id;
    }
  }

  await ticket.save();

  // Notify the other party
  if (req.user.role === "startup") {
    // Notify assigned admin if any, else nothing in-app (admins
    // see new ticket activity via the admin queue).
    if (ticket.assignedTo) {
      await safeNotify({
        userId: ticket.assignedTo,
        title: `New reply on ticket ${ticket.ticketNumber}`,
        message: truncate(message, 120),
        type: "ticket",
        severity: "info",
        actionUrl: `/admin/tickets/${ticket._id}`,
      });
    }
  } else {
    // Admin replied — notify the user who opened the ticket
    await safeNotify({
      userId: ticket.openedBy,
      title: `Kredit Support replied on ${ticket.ticketNumber}`,
      message: truncate(message, 120),
      type: "ticket",
      severity: "info",
      actionUrl: `/tickets/${ticket._id}`,
    });

    // Also email the requester
    const requester = await User.findById(ticket.openedBy).select(
      "fullName email"
    );
    if (requester) {
      await safeMail({
        to: requester.email,
        ...templates.ticketReplyEmail({
          name: requester.fullName,
          ticketNumber: ticket.ticketNumber,
          replyAuthorRole: "admin",
          snippet: truncate(message, 200),
        }),
      });
    }
  }

  // Return full populated ticket for convenience
  const populated = await SupportTicket.findById(ticket._id)
    .populate("openedBy", "fullName email")
    .populate("assignedTo", "fullName email")
    .populate("replies.authorId", "fullName email role");

  return ok(res, {
    message: "Reply added",
    data: { ticket: populated },
  });
});

// ==============================================================
// PATCH /api/tickets/:id/status   (admin only)
// --------------------------------------------------------------
// Body: { status: 'in_progress' | 'resolved' | 'closed' | 'open' }
// ==============================================================
const updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  const ticket = await SupportTicket.findById(req.params.id);
  if (!ticket) throw new AppError("Ticket not found", 404);

  const previous = ticket.status;
  if (previous === status) {
    return ok(res, {
      message: `Ticket is already ${status}`,
      data: { ticket },
    });
  }

  ticket.status = status;
  if (status === "resolved") {
    ticket.resolvedAt = new Date();
  } else if (status === "open" || status === "in_progress") {
    ticket.resolvedAt = null;
  }
  await ticket.save();

  // Notify + email the requester on resolution
  if (status === "resolved") {
    const requester = await User.findById(ticket.openedBy).select(
      "fullName email"
    );
    await safeNotify({
      userId: ticket.openedBy,
      title: `Ticket ${ticket.ticketNumber} resolved`,
      message: `Your ticket "${truncate(ticket.subject, 80)}" has been marked as resolved.`,
      type: "ticket",
      severity: "success",
      actionUrl: `/tickets/${ticket._id}`,
    });
    if (requester) {
      await safeMail({
        to: requester.email,
        ...templates.ticketResolvedEmail({
          name: requester.fullName,
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
        }),
      });
    }
  }

  return ok(res, {
    message: `Ticket status updated to ${status}`,
    data: { ticket, previousStatus: previous },
  });
});

// ==============================================================
// PATCH /api/tickets/:id/assign   (admin only)
// --------------------------------------------------------------
// Body: { assignedTo: <admin user _id> | null }
// Passing null unassigns.
// ==============================================================
const assignTicket = asyncHandler(async (req, res) => {
  const { assignedTo } = req.body;

  const ticket = await SupportTicket.findById(req.params.id);
  if (!ticket) throw new AppError("Ticket not found", 404);

  if (assignedTo) {
    const target = await User.findById(assignedTo).select("role");
    if (!target) throw new AppError("Assignee not found", 404);
    if (target.role !== "admin") {
      throw new AppError("Tickets can only be assigned to admin users", 400);
    }
  }

  ticket.assignedTo = assignedTo || null;
  if (assignedTo && ticket.status === "open") {
    ticket.status = "in_progress";
  }
  await ticket.save();

  return ok(res, {
    message: assignedTo ? "Ticket assigned" : "Ticket unassigned",
    data: { ticket },
  });
});

module.exports = {
  createTicket,
  listTickets,
  getTicket,
  addReply,
  updateStatus,
  assignTicket,
};
