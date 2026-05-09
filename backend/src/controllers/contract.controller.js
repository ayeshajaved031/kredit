// ==============================================================
// Contract Controller
// --------------------------------------------------------------
// Endpoints (under /api/contracts):
//   GET    /                  list (own for startup, all for admin)
//   GET    /:id               get one (ownership-checked)
//   GET    /:id/schedule      get repayment schedule
//   GET    /:id/document      download terms as plain text
//   POST   /:id/sign          startup signs → activates contract
//
// The SIGN endpoint is the most complex flow in the entire
// platform. It must handle, in order:
//   1. Password re-verification
//   2. Idempotency — refuse to sign an already-active contract
//   3. Compute signature hash (links signer + contract + terms)
//   4. Generate the 12-row repayment schedule
//   5. Reserve credit on the startup (usedCredit += principal)
//   6. Activate the contract (status: draft → active)
//   7. Pay the vendor (simulated)
//   8. If vendor payment fails → ROLL BACK everything
//   9. Notify, email, audit-log
//
// Idempotency note: we re-load the contract inside the
// transaction with status='draft' as a guard, so a double-click
// races safely (second one sees status=active and aborts).
// ==============================================================

const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const MurabahaContract = require("../models/MurabahaContract");
const FinancingRequest = require("../models/FinancingRequest");
const RepaymentSchedule = require("../models/RepaymentSchedule");
const Startup = require("../models/Startup");
const User = require("../models/User");
const Notification = require("../models/Notification");
const AuditLog = require("../models/AuditLog");

const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const { ok } = require("../utils/response");
const { calculateMurabaha } = require("../utils/murabaha");
const { computeSignatureHash } = require("../utils/signature");
const { payVendor } = require("../utils/paymentGateway");
const { sendMail, templates } = require("../utils/mailer");

const audit = async ({ actorId, actorRole, action, targetType, targetId, details, req }) => {
  try {
    await AuditLog.create({
      actorId,
      actorRole,
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

const safeMail = async (args) => {
  try { await sendMail(args); }
  catch (err) { console.error("[Mail] Failed:", err.message); }
};

// Resolve the startup for the current user (or null if none)
const resolveStartup = async (user) => {
  if (user.role !== "startup") return null;
  return Startup.findOne({ userId: user._id });
};

// ==============================================================
// GET /api/contracts
// --------------------------------------------------------------
// Startup → own contracts. Admin → all.
// ?status= filter.
// ==============================================================
const list = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 25, 100);
  const skip = Math.max(Number(req.query.skip) || 0, 0);

  const filter = {};
  if (req.user.role === "startup") {
    const startup = await resolveStartup(req.user);
    if (!startup) {
      return ok(res, { data: { contracts: [], count: 0, total: 0, limit, skip } });
    }
    filter.startupId = startup._id;
  }
  if (req.query.status) {
    const valid = ["draft", "active", "completed", "defaulted", "cancelled"];
    if (!valid.includes(req.query.status)) {
      throw new AppError("Invalid status filter", 400);
    }
    filter.status = req.query.status;
  }

  const [contracts, total] = await Promise.all([
    MurabahaContract.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: "requestId",
        select: "requestId vendorNameSnapshot subscriptionDetails annualAmountPKR",
      })
      .populate({
        path: "startupId",
        select: req.user.role === "admin" ? "companyName registrationNumber" : "companyName",
      })
      .lean(),
    MurabahaContract.countDocuments(filter),
  ]);

  return ok(res, {
    data: { contracts, count: contracts.length, total, limit, skip },
  });
});

// ==============================================================
// GET /api/contracts/:id
// --------------------------------------------------------------
// Single contract with related data. Startups can only read
// their own — same 404-on-not-yours pattern as other endpoints.
// ==============================================================
const getOne = asyncHandler(async (req, res) => {
  const contract = await MurabahaContract.findById(req.params.id)
    .populate({
      path: "requestId",
      select: "requestId vendorNameSnapshot subscriptionDetails annualAmountPKR vendorInvoiceFileUrl",
    })
    .populate({
      path: "startupId",
      select: "companyName registrationNumber userId operationalAddress",
    });

  if (!contract) throw new AppError("Contract not found", 404);

  // Ownership check for startups
  if (req.user.role === "startup") {
    const ownerUserId = contract.startupId?.userId?.toString();
    if (!ownerUserId || ownerUserId !== req.user._id.toString()) {
      throw new AppError("Contract not found", 404);
    }
  }

  return ok(res, { data: { contract } });
});

// ==============================================================
// GET /api/contracts/:id/schedule
// --------------------------------------------------------------
// Returns the 12-row repayment schedule for the contract.
// Empty array if contract is still in draft (no schedule yet).
// ==============================================================
const getSchedule = asyncHandler(async (req, res) => {
  const contract = await MurabahaContract.findById(req.params.id).populate(
    "startupId",
    "userId companyName"
  );
  if (!contract) throw new AppError("Contract not found", 404);

  if (req.user.role === "startup") {
    if (!contract.startupId?.userId || contract.startupId.userId.toString() !== req.user._id.toString()) {
      throw new AppError("Contract not found", 404);
    }
  }

  const schedule = await RepaymentSchedule.find({ contractId: contract._id })
    .sort({ installmentNumber: 1 })
    .lean();

  return ok(res, {
    data: {
      contract: {
        _id: contract._id,
        contractId: contract.contractId,
        status: contract.status,
        totalPayable: contract.totalPayable,
        monthlyInstallment: contract.monthlyInstallment,
        paidInstallments: contract.paidInstallments,
        totalPaidAmount: contract.totalPaidAmount,
        nextDueDate: contract.nextDueDate,
        overdueCount: contract.overdueCount,
      },
      schedule,
      summary: {
        totalInstallments: schedule.length,
        paid: schedule.filter((s) => s.status === "paid").length,
        unpaid: schedule.filter((s) => s.status === "unpaid").length,
        overdue: schedule.filter((s) => s.status === "overdue").length,
      },
    },
  });
});

// ==============================================================
// GET /api/contracts/:id/document
// --------------------------------------------------------------
// Returns the contract's terms-and-conditions as plain text with
// Content-Disposition: attachment so the browser downloads it.
// In a future iteration we'd render this as a real PDF.
// ==============================================================
const getDocument = asyncHandler(async (req, res) => {
  const contract = await MurabahaContract.findById(req.params.id).populate(
    "startupId",
    "userId"
  );
  if (!contract) throw new AppError("Contract not found", 404);

  if (req.user.role === "startup") {
    if (!contract.startupId?.userId || contract.startupId.userId.toString() !== req.user._id.toString()) {
      throw new AppError("Contract not found", 404);
    }
  }

  const filename = `${contract.contractId}.txt`;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  // Append signing metadata at the bottom if signed
  let body = contract.termsAndConditions;
  if (contract.signedAt) {
    body += `\n\n---\nSIGNED ELECTRONICALLY\nSigned at: ${contract.signedAt.toISOString()}\nSignature hash: ${contract.signatureHash}\nIP address: ${contract.signatureIpAddress || "—"}\n`;
  }

  return res.send(body);
});

// ==============================================================
// POST /api/contracts/:id/sign  (startup, sensitive)
// --------------------------------------------------------------
// THE big orchestration. See file header for the full sequence.
// ==============================================================
const sign = asyncHandler(async (req, res) => {
  const { password, typedName, acceptedTerms } = req.body;

  // 1. Load contract + startup + user (with hash)
  const contract = await MurabahaContract.findById(req.params.id).populate({
    path: "requestId",
    select: "vendorNameSnapshot annualAmountPKR subscriptionDetails",
  });
  if (!contract) throw new AppError("Contract not found", 404);

  const startup = await Startup.findById(contract.startupId).populate(
    "userId",
    "fullName email"
  );
  if (!startup) throw new AppError("Startup profile not found", 404);

  // 1a. Ownership — only the contract's startup can sign
  if (startup.userId._id.toString() !== req.user._id.toString()) {
    throw new AppError("Contract not found", 404);
  }

  // 2. Idempotency — must be in draft to be signable
  if (contract.status !== "draft") {
    throw new AppError(
      `This contract cannot be signed (current status: ${contract.status})`,
      400
    );
  }

  // 3. Password re-verification (second-factor confirmation)
  const userWithHash = await User.findById(req.user._id).select("+passwordHash");
  if (!userWithHash) throw new AppError("User account not found", 404);
  const passwordMatches = await bcrypt.compare(password, userWithHash.passwordHash);
  if (!passwordMatches) {
    await audit({
      actorId: req.user._id,
      actorRole: "startup",
      action: "USER_LOGIN_FAILED", // re-using; could add a dedicated SIGN_FAILED
      targetType: "contract",
      targetId: contract._id,
      details: { reason: "password_mismatch_at_signing", contractId: contract.contractId },
      req,
    });
    throw new AppError("Password is incorrect", 401);
  }

  // 4. Typed name confirmation — case-insensitive trim match
  const typed = String(typedName).trim().toLowerCase();
  const real = String(req.user.fullName).trim().toLowerCase();
  if (typed !== real) {
    throw new AppError(
      `Typed name does not match the name on your account (${req.user.fullName})`,
      400
    );
  }

  if (acceptedTerms !== true) {
    throw new AppError("You must accept the contract terms", 400);
  }

  // 5. Re-check startup eligibility one more time before reserving credit
  // (admin may have changed credit limit between approval and signing)
  const availableCredit = Math.max(
    0,
    startup.approvedCreditLimit - startup.usedCredit
  );
  if (contract.principalAmount > availableCredit) {
    throw new AppError(
      `Cannot sign — your available credit (PKR ${availableCredit.toLocaleString()}) no longer covers this contract (PKR ${contract.principalAmount.toLocaleString()}). Please contact support.`,
      400
    );
  }

  // 6. Compute signature hash
  const signedAt = new Date();
  const signatureHash = computeSignatureHash({
    contractId: contract.contractId,
    userId: req.user._id.toString(),
    signedAt,
    termsAndConditions: contract.termsAndConditions,
  });

  // 7. ATOMIC ACTIVATION
  // We do schedule + credit reservation + status flip inside a
  // single transaction. Vendor payment happens AFTER the
  // transaction commits — that way, if vendor payment fails we
  // roll back via a follow-up update (status→draft, release credit,
  // delete schedule). This separation is necessary because vendor
  // payment is a network call that must happen outside a Mongo
  // transaction (transactions can't span external systems).

  // 7a. Recompute the schedule (we don't trust whatever was on the
  // contract — recalculation guarantees the schedule matches the
  // stored money fields exactly).
  const calc = calculateMurabaha({
    principal: contract.principalAmount,
    markupPercent: contract.markupPercent,
    installmentCount: contract.installmentCount,
  });

  const session = await mongoose.startSession();
  let scheduleDocs = null;
  let activatedContract = null;

  try {
    await session.withTransaction(async () => {
      // Re-fetch the contract WITHIN the transaction with the draft
      // guard. This makes the operation idempotent under concurrent
      // requests — the second one sees status≠draft and aborts.
      const fresh = await MurabahaContract.findOneAndUpdate(
        { _id: contract._id, status: "draft" },
        {
          $set: {
            status: "active",
            signedAt,
            signatureHash,
            signatureIpAddress: req.ip || "",
            activatedAt: signedAt,
            nextDueDate: calc.schedule[0].dueDate,
          },
        },
        { new: true, session }
      );
      if (!fresh) {
        // Someone else (or a re-click) already activated it.
        throw new AppError("Contract was already signed", 409);
      }
      activatedContract = fresh;

      // Generate schedule rows
      const rows = calc.schedule.map((s) => ({
        contractId: contract._id,
        startupId: startup._id,
        installmentNumber: s.installmentNumber,
        amountDue: s.amountDue,
        dueDate: s.dueDate,
        status: "unpaid",
      }));
      scheduleDocs = await RepaymentSchedule.insertMany(rows, { session });

      // Reserve credit on the startup
      await Startup.updateOne(
        { _id: startup._id },
        { $inc: { usedCredit: contract.principalAmount } },
        { session }
      );
    });
  } catch (err) {
    // Standalone Mongo fallback — best-effort manual atomicity.
    if (err.codeName === "IllegalOperation" || /Transaction numbers/.test(err.message || "")) {
      const fresh = await MurabahaContract.findOneAndUpdate(
        { _id: contract._id, status: "draft" },
        {
          $set: {
            status: "active",
            signedAt,
            signatureHash,
            signatureIpAddress: req.ip || "",
            activatedAt: signedAt,
            nextDueDate: calc.schedule[0].dueDate,
          },
        },
        { new: true }
      );
      if (!fresh) throw new AppError("Contract was already signed", 409);
      activatedContract = fresh;

      try {
        const rows = calc.schedule.map((s) => ({
          contractId: contract._id,
          startupId: startup._id,
          installmentNumber: s.installmentNumber,
          amountDue: s.amountDue,
          dueDate: s.dueDate,
          status: "unpaid",
        }));
        scheduleDocs = await RepaymentSchedule.insertMany(rows);
        await Startup.updateOne(
          { _id: startup._id },
          { $inc: { usedCredit: contract.principalAmount } }
        );
      } catch (innerErr) {
        // Manual rollback
        await MurabahaContract.updateOne(
          { _id: contract._id },
          { $set: { status: "draft", signedAt: null, signatureHash: "", activatedAt: null, nextDueDate: null } }
        );
        await RepaymentSchedule.deleteMany({ contractId: contract._id });
        throw innerErr;
      }
    } else {
      throw err;
    }
  } finally {
    session.endSession();
  }

  // 8. Pay the vendor — outside any transaction
  const payment = await payVendor({
    vendorName: contract.requestId.vendorNameSnapshot,
    amountPKR: contract.principalAmount,
    contractId: contract.contractId,
  });

  if (!payment.success) {
    // ROLL BACK: status→draft, release credit, delete schedule
    await Promise.all([
      MurabahaContract.updateOne(
        { _id: contract._id },
        {
          $set: {
            status: "draft",
            signedAt: null,
            signatureHash: "",
            signatureIpAddress: "",
            activatedAt: null,
            nextDueDate: null,
            vendorPaymentStatus: "failed",
            vendorPaymentReference: payment.reference,
          },
        }
      ),
      RepaymentSchedule.deleteMany({ contractId: contract._id }),
      Startup.updateOne(
        { _id: startup._id },
        { $inc: { usedCredit: -contract.principalAmount } }
      ),
    ]);

    await Notification.create({
      userId: req.user._id,
      title: "Contract activation failed",
      message: `We couldn't pay ${contract.requestId.vendorNameSnapshot}. Your contract is back to draft. ${payment.message}`,
      type: "contract",
      severity: "error",
      relatedContractId: contract._id,
    });

    await safeMail({
      to: req.user.email,
      ...templates.vendorPaymentFailedEmail({
        name: req.user.fullName,
        contractId: contract.contractId,
        vendorName: contract.requestId.vendorNameSnapshot,
        reason: payment.message,
      }),
    });

    await audit({
      actorId: req.user._id,
      actorRole: "startup",
      action: "PAYMENT_FAILED",
      targetType: "contract",
      targetId: contract._id,
      details: {
        stage: "vendor_payment",
        reference: payment.reference,
        code: payment.code,
        message: payment.message,
      },
      req,
    });

    throw new AppError(
      `Vendor payment failed: ${payment.message}. Your contract has been rolled back. Please try again or contact support.`,
      502
    );
  }

  // 9. Vendor paid — finalize
  await MurabahaContract.updateOne(
    { _id: contract._id },
    {
      $set: {
        vendorPaymentStatus: "completed",
        vendorPaidAt: new Date(),
        vendorPaymentReference: payment.reference,
      },
    }
  );

  // Notification + email + audit
  await Notification.create({
    userId: req.user._id,
    title: "Contract activated 🎉",
    message: `Your contract ${contract.contractId} is active. We've paid ${contract.requestId.vendorNameSnapshot}. First installment due ${calc.schedule[0].dueDate.toISOString().split("T")[0]}.`,
    type: "contract",
    severity: "success",
    actionUrl: `/contracts/${contract._id}`,
    relatedContractId: contract._id,
  });

  await safeMail({
    to: req.user.email,
    ...templates.contractActivatedEmail({
      name: req.user.fullName,
      contractId: contract.contractId,
      vendorName: contract.requestId.vendorNameSnapshot,
      totalPayable: contract.totalPayable,
      monthlyInstallment: contract.monthlyInstallment,
      firstDueDate: calc.schedule[0].dueDate.toISOString().split("T")[0],
    }),
  });

  await audit({
    actorId: req.user._id,
    actorRole: "startup",
    action: "SIGN_CONTRACT",
    targetType: "contract",
    targetId: contract._id,
    details: {
      contractId: contract.contractId,
      principal: contract.principalAmount,
      totalPayable: contract.totalPayable,
    },
    req,
  });

  await audit({
    actorId: req.user._id,
    actorRole: "startup",
    action: "ACTIVATE_CONTRACT",
    targetType: "contract",
    targetId: contract._id,
    details: { contractId: contract.contractId, scheduleRows: scheduleDocs.length },
    req,
  });

  await audit({
    actorId: req.user._id,
    actorRole: "system",
    action: "VENDOR_PAID",
    targetType: "contract",
    targetId: contract._id,
    details: {
      vendor: contract.requestId.vendorNameSnapshot,
      amount: contract.principalAmount,
      reference: payment.reference,
      simulated: payment.simulated,
    },
    req,
  });

  // Fetch the latest snapshot for the response
  const finalContract = await MurabahaContract.findById(contract._id)
    .populate("requestId", "requestId vendorNameSnapshot")
    .populate("startupId", "companyName");

  return ok(res, {
    message: "Contract signed and activated. Vendor has been paid.",
    data: {
      contract: finalContract,
      schedule: scheduleDocs,
      vendorPayment: {
        reference: payment.reference,
        amount: contract.principalAmount,
        vendor: contract.requestId.vendorNameSnapshot,
      },
    },
  });
});

module.exports = {
  list,
  getOne,
  getSchedule,
  getDocument,
  sign,
};
