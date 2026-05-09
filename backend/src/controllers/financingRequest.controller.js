// ==============================================================
// Financing Request Controller
// --------------------------------------------------------------
// Endpoints (all under /api/financing-requests):
//   POST   /                  — startup submits new request
//   GET    /                  — startup lists own; admin lists all
//   GET    /:id               — view one (ownership-enforced)
//   DELETE /:id               — startup withdraws own pending request
//   GET    /admin/queue       — admin: pending requests, oldest first
//
// Eligibility rules at submission time:
//   1. User role = startup
//   2. Startup KYC status = "verified"
//   3. Startup status (user.status) = active (auth middleware checks)
//   4. Vendor exists AND isActive = true
//   5. annualAmountPKR <= startup.availableCredit
//   6. PDF file uploaded (multer enforces type + size already)
//
// Credit reservation policy:
//   We do NOT reserve credit at request submission. The startup
//   could submit multiple pending requests that together exceed
//   their limit; this is fine because admin reviews them one at
//   a time, and credit is only consumed when a contract is SIGNED
//   (Phase 6). Eligibility re-checked at approval-time too.
// ==============================================================

const fs = require("fs");

const FinancingRequest = require("../models/FinancingRequest");
const Startup = require("../models/Startup");
const Vendor = require("../models/Vendor");
const Notification = require("../models/Notification");
const AuditLog = require("../models/AuditLog");

const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const { ok } = require("../utils/response");
const { generateRequestId } = require("../utils/idGenerator");
const { publicUrlFor } = require("../middlewares/upload");

const MAX_ID_RETRIES = 3;

// Audit helper — fire-and-forget so request never fails on audit issues
const audit = async ({ actorId, actorRole, action, targetId, details, req }) => {
  try {
    await AuditLog.create({
      actorId,
      actorRole,
      action,
      targetType: "request",
      targetId: String(targetId),
      details: details || {},
      ipAddress: req?.ip || "",
      userAgent: req?.headers?.["user-agent"] || "",
    });
  } catch (err) {
    console.error("[AuditLog] Failed:", err.message);
  }
};

// Best-effort: clean up an uploaded file when request creation fails
// after multer has already saved it to disk.
const safeDeleteFile = (filePath) => {
  if (!filePath) return;
  try {
    fs.unlink(filePath, () => {}); // swallow errors
  } catch (_) {}
};

// ==============================================================
// POST /api/financing-requests   (startup, multipart/form-data)
// --------------------------------------------------------------
// Body fields (multipart text):
//   vendorId, annualAmountPKR, subscriptionDetails (JSON string)
// File:
//   vendorInvoice (PDF, multer single-file upload)
// ==============================================================
const submit = asyncHandler(async (req, res) => {
  // Multer attaches the file to req.file (since we use .single())
  const file = req.file;

  if (!file) {
    throw new AppError("Vendor invoice PDF is required", 400);
  }

  // From here on, if anything fails, we must clean up the uploaded file.
  try {
    // 1) Resolve startup profile
    const startup = await Startup.findOne({ userId: req.user._id });
    if (!startup) {
      throw new AppError("Startup profile not found", 404);
    }

    // 2) KYC check — must be verified
    if (startup.kycStatus !== "verified") {
      throw new AppError(
        `Cannot submit financing requests until KYC is verified (current: ${startup.kycStatus})`,
        403
      );
    }

    // 3) Vendor must exist and be active
    const vendor = await Vendor.findById(req.body.vendorId);
    if (!vendor) {
      throw new AppError("Vendor not found", 404);
    }
    if (!vendor.isActive) {
      throw new AppError("Vendor is no longer available for financing", 400);
    }

    // 4) Amount must fit available credit
    const annualAmount = Number(req.body.annualAmountPKR);
    const availableCredit = Math.max(
      0,
      startup.approvedCreditLimit - startup.usedCredit
    );
    if (annualAmount > availableCredit) {
      throw new AppError(
        `Requested amount exceeds available credit. Available: PKR ${availableCredit.toLocaleString()}`,
        400
      );
    }

    // 5) Parse subscription details (multipart sends it as a string)
    let subscriptionDetails = req.body.subscriptionDetails;
    if (typeof subscriptionDetails === "string") {
      subscriptionDetails = JSON.parse(subscriptionDetails);
    }

    // 6) Generate unique requestId — retry on rare collision
    let request = null;
    let lastErr = null;
    for (let attempt = 0; attempt < MAX_ID_RETRIES; attempt++) {
      try {
        request = await FinancingRequest.create({
          requestId: generateRequestId(),
          startupId: startup._id,
          vendorId: vendor._id,
          vendorNameSnapshot: vendor.name,
          annualAmountPKR: annualAmount,
          subscriptionDetails: {
            planName: subscriptionDetails.planName,
            planDescription: subscriptionDetails.planDescription || "",
            coveragePeriodMonths: subscriptionDetails.coveragePeriodMonths || 12,
          },
          vendorInvoiceFileUrl: publicUrlFor(req, file.path),
          vendorInvoiceFileName: file.originalname,
          status: "pending",
        });
        break;
      } catch (err) {
        // Only retry on duplicate-key for requestId
        if (err.code === 11000 && err.keyValue?.requestId) {
          lastErr = err;
          continue;
        }
        throw err;
      }
    }
    if (!request) {
      throw lastErr || new AppError("Could not generate unique request ID", 500);
    }

    // 7) Notify the user in-app
    await Notification.create({
      userId: req.user._id,
      title: "Financing request submitted",
      message: `Your request ${request.requestId} for ${vendor.name} is under review.`,
      type: "financing_request",
      severity: "info",
      actionUrl: `/financing-requests/${request._id}`,
      relatedRequestId: request._id,
    });

    // 8) Audit
    await audit({
      actorId: req.user._id,
      actorRole: "startup",
      action: "SUBMIT_REQUEST",
      targetId: request._id,
      details: {
        requestId: request.requestId,
        vendor: vendor.name,
        amount: annualAmount,
      },
      req,
    });

    return ok(res, {
      status: 201,
      message: "Financing request submitted. Our team will review it within 2 business days.",
      data: { request },
    });
  } catch (err) {
    // Roll back the uploaded file on any failure
    safeDeleteFile(file.path);
    throw err;
  }
});

// ==============================================================
// GET /api/financing-requests   (auth required)
// --------------------------------------------------------------
// startup → returns their own requests
// admin   → returns all (supports ?status=pending&vendorId=...)
//
// Pagination via ?limit=&skip= (limit capped at 100).
// ==============================================================
const list = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 25, 100);
  const skip = Math.max(Number(req.query.skip) || 0, 0);

  const filter = {};

  if (req.user.role === "startup") {
    const startup = await Startup.findOne({ userId: req.user._id }).select("_id");
    if (!startup) {
      // Edge case — startup user with no profile. Return empty list.
      return ok(res, { data: { requests: [], count: 0, total: 0, limit, skip } });
    }
    filter.startupId = startup._id;
  }
  // Admin sees everything by default; can narrow with query params

  if (req.query.status) {
    const validStatuses = [
      "pending",
      "under_review",
      "approved",
      "rejected",
      "expired",
      "withdrawn",
    ];
    if (!validStatuses.includes(req.query.status)) {
      throw new AppError("Invalid status filter", 400);
    }
    filter.status = req.query.status;
  }

  if (req.query.vendorId && req.user.role === "admin") {
    filter.vendorId = req.query.vendorId;
  }

  const [requests, total] = await Promise.all([
    FinancingRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("vendorId", "name slug logoUrl category")
      .populate({
        path: "startupId",
        select: "companyName registrationNumber userId",
        // Only populate startup details for admins — hide other
        // startups' identities from each other.
        match: req.user.role === "admin" ? {} : null,
      })
      .lean(),
    FinancingRequest.countDocuments(filter),
  ]);

  return ok(res, {
    data: { requests, count: requests.length, total, limit, skip },
  });
});

// ==============================================================
// GET /api/financing-requests/:id   (auth required)
// --------------------------------------------------------------
// Ownership rule:
//   - startup → only their own request
//   - admin   → any request
// ==============================================================
const getOne = asyncHandler(async (req, res) => {
  const request = await FinancingRequest.findById(req.params.id)
    .populate("vendorId", "name slug logoUrl category websiteUrl")
    .populate("startupId", "companyName registrationNumber userId operationalAddress")
    .populate("contractId");

  if (!request) throw new AppError("Financing request not found", 404);

  // Ownership check for startup users
  if (req.user.role === "startup") {
    // request.startupId is now populated with the Startup doc
    const ownerUserId = request.startupId?.userId?.toString();
    if (!ownerUserId || ownerUserId !== req.user._id.toString()) {
      // Same 404 instead of 403 — don't leak existence
      throw new AppError("Financing request not found", 404);
    }
  }

  return ok(res, { data: { request } });
});

// ==============================================================
// DELETE /api/financing-requests/:id   (startup only, own only)
// --------------------------------------------------------------
// Withdraws a request. Allowed only while status = "pending".
// We mark it as "withdrawn" instead of deleting — keep the record
// for audit and analytics (e.g., "withdrawn rate by vendor").
// ==============================================================
const withdraw = asyncHandler(async (req, res) => {
  const request = await FinancingRequest.findById(req.params.id);
  if (!request) throw new AppError("Financing request not found", 404);

  // Ownership check
  const startup = await Startup.findOne({ userId: req.user._id }).select("_id");
  if (!startup || request.startupId.toString() !== startup._id.toString()) {
    throw new AppError("Financing request not found", 404);
  }

  if (request.status !== "pending") {
    throw new AppError(
      `Cannot withdraw a request that is ${request.status}`,
      400
    );
  }

  request.status = "withdrawn";
  await request.save();

  await audit({
    actorId: req.user._id,
    actorRole: "startup",
    action: "WITHDRAW_REQUEST",
    targetId: request._id,
    details: { requestId: request.requestId },
    req,
  });

  return ok(res, {
    message: "Financing request withdrawn",
    data: { request },
  });
});

// ==============================================================
// GET /api/financing-requests/admin/queue   (admin only)
// --------------------------------------------------------------
// Convenience endpoint — pending requests in FIFO order for admin
// to work through. Same as list() with ?status=pending sorted asc.
// ==============================================================
const adminQueue = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);

  const requests = await FinancingRequest.find({ status: "pending" })
    .sort({ createdAt: 1 }) // oldest first — FIFO
    .limit(limit)
    .populate("vendorId", "name logoUrl category")
    .populate("startupId", "companyName registrationNumber kycStatus approvedCreditLimit usedCredit")
    .lean();

  return ok(res, {
    data: { requests, count: requests.length },
  });
});

module.exports = {
  submit,
  list,
  getOne,
  withdraw,
  adminQueue,
};
