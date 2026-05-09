// ==============================================================
// Admin Controller
// --------------------------------------------------------------
// Endpoints (all admin-only, mounted under /api/admin):
//
//   Dashboard:
//     GET  /dashboard/summary           — counts for home widgets
//
//   KYC review:
//     GET  /startups                    — list (?kycStatus filter)
//     GET  /startups/:id                — single startup with user
//     POST /startups/:id/kyc/approve    — approve + set credit limit
//     POST /startups/:id/kyc/reject     — reject with reason
//     PUT  /startups/:id/credit-limit   — adjust later
//
//   Request review:
//     POST /financing-requests/:id/approve  — runs Murabaha calc,
//                                             creates draft contract
//     POST /financing-requests/:id/reject
//
//   User management:
//     GET  /users                       — list users
//     POST /users/:id/block             — suspend
//     POST /users/:id/unblock           — reactivate
//
//   Audit:
//     GET  /audit-logs                  — recent admin actions
//
// All write actions are audit-logged. All money-affecting actions
// (approve request, change credit limit) re-validate eligibility
// because the data may have changed since the request was queued.
// ==============================================================

const mongoose = require("mongoose");

const User = require("../models/User");
const Startup = require("../models/Startup");
const FinancingRequest = require("../models/FinancingRequest");
const MurabahaContract = require("../models/MurabahaContract");
const Vendor = require("../models/Vendor");
const Notification = require("../models/Notification");
const AuditLog = require("../models/AuditLog");

const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const { ok } = require("../utils/response");
const { generateContractId } = require("../utils/idGenerator");
const { calculateMurabaha } = require("../utils/murabaha");
const { buildTerms } = require("../utils/contractTerms");
const { sendMail, templates } = require("../utils/mailer");
const { runDailyCycle } = require("../utils/repaymentEngine");

const DEFAULT_MARKUP = Number(process.env.MURABAHA_MARKUP_PERCENT || 10);
const DEFAULT_INSTALLMENTS = Number(process.env.MURABAHA_INSTALLMENTS || 12);
const MAX_ID_RETRIES = 3;

// ---------- helpers ----------

const audit = async ({ actorId, action, targetType, targetId, details, req }) => {
  try {
    await AuditLog.create({
      actorId,
      actorRole: "admin",
      action,
      targetType,
      targetId: String(targetId),
      details: details || {},
      ipAddress: req?.ip || "",
      userAgent: req?.headers?.["user-agent"] || "",
    });
  } catch (err) {
    console.error("[AuditLog] Failed:", err.message);
  }
};

const safeMail = async (mailArgs) => {
  try { await sendMail(mailArgs); }
  catch (err) { console.error("[Mail] Failed:", err.message); }
};

// ==============================================================
// GET /api/admin/dashboard/summary
// --------------------------------------------------------------
// Aggregated counts for the admin home page. Single round-trip
// to MongoDB using Promise.all so the dashboard loads fast.
// ==============================================================
const dashboardSummary = asyncHandler(async (_req, res) => {
  const [
    totalStartups,
    pendingKyc,
    underReviewKyc,
    pendingRequests,
    activeContracts,
    completedContracts,
    blockedUsers,
    totalVendors,
    activeVendors,
  ] = await Promise.all([
    Startup.countDocuments({}),
    Startup.countDocuments({ kycStatus: "unverified" }),
    Startup.countDocuments({ kycStatus: "under_review" }),
    FinancingRequest.countDocuments({ status: "pending" }),
    MurabahaContract.countDocuments({ status: "active" }),
    MurabahaContract.countDocuments({ status: "completed" }),
    User.countDocuments({ status: "blocked" }),
    Vendor.countDocuments({}),
    Vendor.countDocuments({ isActive: true }),
  ]);

  // Total credit issued across active contracts (denormalized read)
  const creditAggregate = await MurabahaContract.aggregate([
    { $match: { status: { $in: ["active", "completed"] } } },
    {
      $group: {
        _id: null,
        totalPrincipal: { $sum: "$principalAmount" },
        totalCollected: { $sum: "$totalPaidAmount" },
      },
    },
  ]);
  const credit = creditAggregate[0] || { totalPrincipal: 0, totalCollected: 0 };

  return ok(res, {
    data: {
      startups: { total: totalStartups, pendingKyc, underReviewKyc, blocked: blockedUsers },
      requests: { pending: pendingRequests },
      contracts: { active: activeContracts, completed: completedContracts },
      vendors: { total: totalVendors, active: activeVendors },
      portfolio: {
        totalPrincipalDeployed: credit.totalPrincipal,
        totalCollected: credit.totalCollected,
      },
    },
  });
});

// ==============================================================
// GET /api/admin/startups
// --------------------------------------------------------------
// Paginated list. Filters:
//   ?kycStatus=unverified|under_review|verified|rejected
//   ?search=<companyName partial match>
// ==============================================================
const listStartups = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 25, 100);
  const skip = Math.max(Number(req.query.skip) || 0, 0);

  const filter = {};
  if (req.query.kycStatus) {
    const valid = ["unverified", "under_review", "verified", "rejected"];
    if (!valid.includes(req.query.kycStatus)) {
      throw new AppError("Invalid kycStatus filter", 400);
    }
    filter.kycStatus = req.query.kycStatus;
  }

  if (req.query.search) {
    // Case-insensitive partial match on company name. Escape regex
    // chars so user input can't break the query.
    const safe = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.companyName = { $regex: safe, $options: "i" };
  }

  const [startups, total] = await Promise.all([
    Startup.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", "fullName email status emailVerified createdAt lastLogin")
      .lean(),
    Startup.countDocuments(filter),
  ]);

  return ok(res, {
    data: { startups, count: startups.length, total, limit, skip },
  });
});

// ==============================================================
// GET /api/admin/startups/:id
// --------------------------------------------------------------
// Single startup with full context (user, contracts count, etc.).
// ==============================================================
const getStartup = asyncHandler(async (req, res) => {
  const startup = await Startup.findById(req.params.id).populate(
    "userId",
    "fullName email phone status emailVerified createdAt lastLogin"
  );
  if (!startup) throw new AppError("Startup not found", 404);

  const [requestCounts, contractCounts] = await Promise.all([
    FinancingRequest.aggregate([
      { $match: { startupId: startup._id } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    MurabahaContract.aggregate([
      { $match: { startupId: startup._id } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);

  return ok(res, {
    data: {
      startup,
      requestCounts: Object.fromEntries(requestCounts.map((r) => [r._id, r.count])),
      contractCounts: Object.fromEntries(contractCounts.map((c) => [c._id, c.count])),
    },
  });
});

// ==============================================================
// POST /api/admin/startups/:id/kyc/approve
// --------------------------------------------------------------
// Approves KYC, sets credit limit, sends notification + email.
// Allowed only when current status is unverified or under_review.
// ==============================================================
const approveKyc = asyncHandler(async (req, res) => {
  const { approvedCreditLimit, adminNotes } = req.body;

  const startup = await Startup.findById(req.params.id).populate(
    "userId",
    "fullName email"
  );
  if (!startup) throw new AppError("Startup not found", 404);

  if (startup.kycStatus === "verified") {
    throw new AppError("KYC is already verified for this startup", 400);
  }

  startup.kycStatus = "verified";
  startup.approvedCreditLimit = Number(approvedCreditLimit);
  if (adminNotes !== undefined) startup.adminNotes = adminNotes;
  await startup.save();

  await Notification.create({
    userId: startup.userId._id,
    title: "KYC approved 🎉",
    message: `You've been approved for a credit limit of PKR ${Number(approvedCreditLimit).toLocaleString("en-PK")}. You can now submit financing requests.`,
    type: "kyc",
    severity: "success",
    actionUrl: "/dashboard",
  });

  await safeMail({
    to: startup.userId.email,
    ...templates.kycApprovedEmail({
      name: startup.userId.fullName,
      creditLimitPKR: approvedCreditLimit,
    }),
  });

  await audit({
    actorId: req.user._id,
    action: "APPROVE_KYC",
    targetType: "startup",
    targetId: startup._id,
    details: {
      companyName: startup.companyName,
      creditLimit: approvedCreditLimit,
    },
    req,
  });

  return ok(res, {
    message: "KYC approved",
    data: { startup },
  });
});

// ==============================================================
// POST /api/admin/startups/:id/kyc/reject
// --------------------------------------------------------------
// Marks KYC as rejected with a reason. Startup can re-upload to
// re-trigger review.
// ==============================================================
const rejectKyc = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  const startup = await Startup.findById(req.params.id).populate(
    "userId",
    "fullName email"
  );
  if (!startup) throw new AppError("Startup not found", 404);

  if (startup.kycStatus === "verified") {
    throw new AppError("Cannot reject — KYC is already verified", 400);
  }

  startup.kycStatus = "rejected";
  startup.adminNotes = reason;
  await startup.save();

  await Notification.create({
    userId: startup.userId._id,
    title: "KYC needs attention",
    message: reason.length > 200 ? reason.slice(0, 200) + "…" : reason,
    type: "kyc",
    severity: "warning",
    actionUrl: "/startup/profile",
  });

  await safeMail({
    to: startup.userId.email,
    ...templates.kycRejectedEmail({ name: startup.userId.fullName, reason }),
  });

  await audit({
    actorId: req.user._id,
    action: "REJECT_KYC",
    targetType: "startup",
    targetId: startup._id,
    details: { reason },
    req,
  });

  return ok(res, { message: "KYC rejected", data: { startup } });
});

// ==============================================================
// PUT /api/admin/startups/:id/credit-limit
// --------------------------------------------------------------
// Adjust an already-approved credit limit. Cannot drop below
// usedCredit (would put the startup in an impossible state).
// ==============================================================
const updateCreditLimit = asyncHandler(async (req, res) => {
  const { approvedCreditLimit, adminNotes } = req.body;
  const newLimit = Number(approvedCreditLimit);

  const startup = await Startup.findById(req.params.id);
  if (!startup) throw new AppError("Startup not found", 404);

  if (newLimit < startup.usedCredit) {
    throw new AppError(
      `New limit (PKR ${newLimit.toLocaleString()}) cannot be lower than already-used credit (PKR ${startup.usedCredit.toLocaleString()})`,
      400
    );
  }

  const previous = startup.approvedCreditLimit;
  startup.approvedCreditLimit = newLimit;
  if (adminNotes !== undefined) startup.adminNotes = adminNotes;
  await startup.save();

  await audit({
    actorId: req.user._id,
    action: "UPDATE_CREDIT_LIMIT",
    targetType: "startup",
    targetId: startup._id,
    details: { previous, newLimit },
    req,
  });

  return ok(res, { message: "Credit limit updated", data: { startup } });
});

// ==============================================================
// POST /api/admin/financing-requests/:id/approve
// --------------------------------------------------------------
// THE BIG ONE. Approves a pending financing request and
// generates a draft Murabaha contract. The contract is created
// in "draft" status — it doesn't take effect until the startup
// signs it (Phase 5).
//
// Re-validates eligibility (KYC still verified, vendor still
// active, amount still within available credit) because the
// world may have changed since the request was queued.
//
// Wrapped in a transaction so request + contract are created
// atomically. If contract creation fails, request stays pending.
// ==============================================================
const approveRequest = asyncHandler(async (req, res) => {
  const { markupPercent, adminNotes } = req.body;
  const effectiveMarkup =
    markupPercent !== undefined ? Number(markupPercent) : DEFAULT_MARKUP;

  // Load the request with vendor + startup hydrated for re-validation
  const request = await FinancingRequest.findById(req.params.id)
    .populate("vendorId")
    .populate({
      path: "startupId",
      populate: { path: "userId", select: "fullName email" },
    });

  if (!request) throw new AppError("Financing request not found", 404);

  if (!["pending", "under_review"].includes(request.status)) {
    throw new AppError(
      `Cannot approve a request that is ${request.status}`,
      400
    );
  }

  const startup = request.startupId;
  const vendor = request.vendorId;

  if (!startup || !vendor) {
    throw new AppError("Request data is incomplete (startup or vendor missing)", 500);
  }

  // Re-check eligibility — these may have changed since submission
  if (startup.kycStatus !== "verified") {
    throw new AppError(
      `Cannot approve — startup KYC is currently ${startup.kycStatus}`,
      400
    );
  }
  if (!vendor.isActive) {
    throw new AppError("Cannot approve — vendor is no longer active", 400);
  }

  const availableCredit = Math.max(
    0,
    startup.approvedCreditLimit - startup.usedCredit
  );
  if (request.annualAmountPKR > availableCredit) {
    throw new AppError(
      `Cannot approve — request amount (PKR ${request.annualAmountPKR.toLocaleString()}) exceeds startup's available credit (PKR ${availableCredit.toLocaleString()}). Increase the credit limit first.`,
      400
    );
  }

  // ---- Run the Murabaha calculator ----
  const calc = calculateMurabaha({
    principal: request.annualAmountPKR,
    markupPercent: effectiveMarkup,
    installmentCount: DEFAULT_INSTALLMENTS,
  });

  // ---- Generate the contract (with retry on ID collision) ----
  let contract = null;
  let lastErr = null;
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      // Update request status
      request.status = "approved";
      request.reviewedBy = req.user._id;
      request.reviewedAt = new Date();
      if (adminNotes !== undefined) request.adminNotes = adminNotes;

      // Create the contract — try a few times in case of ID collision
      for (let attempt = 0; attempt < MAX_ID_RETRIES; attempt++) {
        try {
          const contractId = generateContractId();
          const docs = await MurabahaContract.create(
            [
              {
                contractId,
                requestId: request._id,
                startupId: startup._id,
                principalAmount: calc.principal,
                markupPercent: calc.markupPercent,
                markupAmount: calc.markupAmount,
                totalPayable: calc.totalPayable,
                monthlyInstallment: calc.monthlyInstallment,
                installmentCount: calc.installmentCount,
                status: "draft",
                latePaymentFeePercent: 2,
                termsAndConditions: buildTerms({
                  contractId,
                  startupName: startup.companyName,
                  vendorName: vendor.name,
                  subscriptionPlan: request.subscriptionDetails.planName,
                  principal: calc.principal,
                  markupPercent: calc.markupPercent,
                  markupAmount: calc.markupAmount,
                  totalPayable: calc.totalPayable,
                  monthlyInstallment: calc.monthlyInstallment,
                  installmentCount: calc.installmentCount,
                  latePaymentFeePercent: 2,
                }),
              },
            ],
            { session }
          );
          contract = docs[0];
          break;
        } catch (err) {
          if (err.code === 11000 && err.keyValue?.contractId) {
            lastErr = err;
            continue;
          }
          throw err;
        }
      }
      if (!contract) throw lastErr || new Error("Failed to generate contract ID");

      request.contractId = contract._id;
      await request.save({ session });
    });
  } catch (err) {
    // Standalone Mongo (no replica set) — fall back to non-transactional.
    if (err.codeName === "IllegalOperation" || /Transaction numbers/.test(err.message || "")) {
      // Retry without transaction
      for (let attempt = 0; attempt < MAX_ID_RETRIES; attempt++) {
        try {
          const contractId = generateContractId();
          contract = await MurabahaContract.create({
            contractId,
            requestId: request._id,
            startupId: startup._id,
            principalAmount: calc.principal,
            markupPercent: calc.markupPercent,
            markupAmount: calc.markupAmount,
            totalPayable: calc.totalPayable,
            monthlyInstallment: calc.monthlyInstallment,
            installmentCount: calc.installmentCount,
            status: "draft",
            latePaymentFeePercent: 2,
            termsAndConditions: buildTerms({
              contractId,
              startupName: startup.companyName,
              vendorName: vendor.name,
              subscriptionPlan: request.subscriptionDetails.planName,
              principal: calc.principal,
              markupPercent: calc.markupPercent,
              markupAmount: calc.markupAmount,
              totalPayable: calc.totalPayable,
              monthlyInstallment: calc.monthlyInstallment,
              installmentCount: calc.installmentCount,
              latePaymentFeePercent: 2,
            }),
          });
          break;
        } catch (innerErr) {
          if (innerErr.code === 11000 && innerErr.keyValue?.contractId) continue;
          throw innerErr;
        }
      }
      if (!contract) throw new AppError("Could not generate unique contract ID", 500);

      request.status = "approved";
      request.reviewedBy = req.user._id;
      request.reviewedAt = new Date();
      if (adminNotes !== undefined) request.adminNotes = adminNotes;
      request.contractId = contract._id;
      await request.save();
    } else {
      throw err;
    }
  } finally {
    session.endSession();
  }

  // ---- Notify + email + audit ----
  await Notification.create({
    userId: startup.userId._id,
    title: "Financing approved — contract ready to sign",
    message: `Your request ${request.requestId} for ${vendor.name} has been approved. Review and sign the Murabaha contract from your dashboard.`,
    type: "financing_request",
    severity: "success",
    actionUrl: `/contracts/${contract._id}`,
    relatedRequestId: request._id,
    relatedContractId: contract._id,
  });

  await safeMail({
    to: startup.userId.email,
    ...templates.requestApprovedEmail({
      name: startup.userId.fullName,
      requestId: request.requestId,
      vendorName: vendor.name,
      totalPayable: calc.totalPayable,
      monthlyInstallment: calc.monthlyInstallment,
    }),
  });

  await audit({
    actorId: req.user._id,
    action: "APPROVE_REQUEST",
    targetType: "request",
    targetId: request._id,
    details: {
      requestId: request.requestId,
      contractId: contract.contractId,
      principal: calc.principal,
      markupPercent: calc.markupPercent,
      totalPayable: calc.totalPayable,
    },
    req,
  });

  await audit({
    actorId: req.user._id,
    action: "GENERATE_CONTRACT",
    targetType: "contract",
    targetId: contract._id,
    details: {
      contractId: contract.contractId,
      principal: calc.principal,
      totalPayable: calc.totalPayable,
    },
    req,
  });

  return ok(res, {
    status: 201,
    message: "Request approved and contract generated. Awaiting startup signature.",
    data: { request, contract },
  });
});

// ==============================================================
// POST /api/admin/financing-requests/:id/reject
// --------------------------------------------------------------
// Marks a request as rejected with a reason. Startup is notified.
// ==============================================================
const rejectRequest = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  const request = await FinancingRequest.findById(req.params.id)
    .populate("vendorId", "name")
    .populate({
      path: "startupId",
      populate: { path: "userId", select: "fullName email" },
    });

  if (!request) throw new AppError("Financing request not found", 404);

  if (!["pending", "under_review"].includes(request.status)) {
    throw new AppError(
      `Cannot reject a request that is ${request.status}`,
      400
    );
  }

  request.status = "rejected";
  request.reviewedBy = req.user._id;
  request.reviewedAt = new Date();
  request.adminNotes = reason;
  await request.save();

  const startup = request.startupId;
  const vendor = request.vendorId;

  await Notification.create({
    userId: startup.userId._id,
    title: "Financing request not approved",
    message: reason.length > 200 ? reason.slice(0, 200) + "…" : reason,
    type: "financing_request",
    severity: "error",
    actionUrl: `/financing-requests/${request._id}`,
    relatedRequestId: request._id,
  });

  await safeMail({
    to: startup.userId.email,
    ...templates.requestRejectedEmail({
      name: startup.userId.fullName,
      requestId: request.requestId,
      vendorName: vendor.name,
      reason,
    }),
  });

  await audit({
    actorId: req.user._id,
    action: "REJECT_REQUEST",
    targetType: "request",
    targetId: request._id,
    details: { requestId: request.requestId, reason },
    req,
  });

  return ok(res, { message: "Request rejected", data: { request } });
});

// ==============================================================
// GET /api/admin/users
// --------------------------------------------------------------
// Paginated users list with optional role and status filters.
// ==============================================================
const listUsers = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 25, 100);
  const skip = Math.max(Number(req.query.skip) || 0, 0);

  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) {
    const safe = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { email: { $regex: safe, $options: "i" } },
      { fullName: { $regex: safe, $options: "i" } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  return ok(res, { data: { users, count: users.length, total, limit, skip } });
});

// ==============================================================
// POST /api/admin/users/:id/block
// --------------------------------------------------------------
// Suspends a user. They keep existing data but lose API access
// (auth middleware rejects blocked users on the next request).
// Admin cannot block themselves or another admin.
// ==============================================================
const blockUser = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const target = await User.findById(req.params.id);
  if (!target) throw new AppError("User not found", 404);

  if (target._id.toString() === req.user._id.toString()) {
    throw new AppError("You cannot block your own account", 400);
  }
  if (target.role === "admin") {
    throw new AppError("Admin accounts cannot be blocked from this endpoint", 403);
  }

  if (target.status === "blocked") {
    return ok(res, { message: "User is already blocked", data: { user: target } });
  }

  target.status = "blocked";
  await target.save();

  await Notification.create({
    userId: target._id,
    title: "Account suspended",
    message: reason.length > 200 ? reason.slice(0, 200) + "…" : reason,
    type: "account",
    severity: "error",
  });

  await safeMail({
    to: target.email,
    ...templates.accountBlockedEmail({ name: target.fullName, reason }),
  });

  await audit({
    actorId: req.user._id,
    action: "BLOCK_USER",
    targetType: "user",
    targetId: target._id,
    details: { reason, email: target.email },
    req,
  });

  return ok(res, { message: "User blocked", data: { user: target } });
});

// ==============================================================
// POST /api/admin/users/:id/unblock
// --------------------------------------------------------------
// Reactivates a blocked user. Status returns to 'active' (NOT
// 'pending') because they were already verified earlier.
// ==============================================================
const unblockUser = asyncHandler(async (req, res) => {
  const target = await User.findById(req.params.id);
  if (!target) throw new AppError("User not found", 404);

  if (target.status !== "blocked") {
    return ok(res, { message: "User is not blocked", data: { user: target } });
  }

  target.status = "active";
  target.failedLoginAttempts = 0;
  target.lockedUntil = null;
  await target.save();

  await Notification.create({
    userId: target._id,
    title: "Account reactivated",
    message: "Your Kredit account has been reactivated. You can log in again.",
    type: "account",
    severity: "success",
  });

  await audit({
    actorId: req.user._id,
    action: "UNBLOCK_USER",
    targetType: "user",
    targetId: target._id,
    details: { email: target.email },
    req,
  });

  return ok(res, { message: "User unblocked", data: { user: target } });
});

// ==============================================================
// GET /api/admin/audit-logs
// --------------------------------------------------------------
// Recent audit log entries. Supports filtering by action and
// targetType. Newest first.
// ==============================================================
const listAuditLogs = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const skip = Math.max(Number(req.query.skip) || 0, 0);

  const filter = {};
  if (req.query.action) filter.action = req.query.action;
  if (req.query.targetType) filter.targetType = req.query.targetType;

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("actorId", "fullName email role")
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  return ok(res, { data: { logs, count: logs.length, total, limit, skip } });
});

// ==============================================================
// POST /api/admin/repayments/run-daily-cycle
// --------------------------------------------------------------
// Manually triggers the daily repayment cycle. Useful for demos
// (instead of waiting for the cron) and as a fallback if the
// cron didn't run.
//
// Returns a stats object: { remindersSent, chargesAttempted, ... }
// ==============================================================
const runRepaymentCycle = asyncHandler(async (req, res) => {
  const stats = await runDailyCycle({ now: new Date() });

  await audit({
    actorId: req.user._id,
    action: "PAYMENT_SUCCESS", // re-using; could add MANUAL_RUN_CYCLE later
    targetType: "system",
    targetId: "repayment_cycle",
    details: { trigger: "manual", stats },
    req,
  });

  return ok(res, {
    message: "Daily repayment cycle complete",
    data: { stats },
  });
});

module.exports = {
  dashboardSummary,
  listStartups,
  getStartup,
  approveKyc,
  rejectKyc,
  updateCreditLimit,
  approveRequest,
  rejectRequest,
  listUsers,
  blockUser,
  unblockUser,
  listAuditLogs,
  runRepaymentCycle,
};
