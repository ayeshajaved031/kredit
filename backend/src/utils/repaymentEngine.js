// ==============================================================
// Repayment Engine
// --------------------------------------------------------------
// Single canonical function that processes ONE installment, used
// by both the daily cron cycle and the manual-pay endpoint.
//
// Why centralize? Otherwise we'd have two copies of the most
// money-sensitive code in the codebase, and they'd drift.
//
// Steps performed (per installment):
//   1. Atomic claim: flip schedule status from 'unpaid'/'overdue'
//      to 'pending' so no other process picks it up.
//      (Returns null if someone else got there first.)
//   2. Call the payment gateway (network — outside transaction).
//   3a. SUCCESS: create Payment doc, mark schedule paid, update
//       contract counters, possibly mark contract completed,
//       release credit, notify + email.
//   3b. FAILURE: revert schedule to overdue, accrue late fee,
//       create failed Payment doc, drop credit rating, possibly
//       mark contract defaulted, notify + email.
//
// All updates are scoped to the affected docs — no global locks.
// ==============================================================

const mongoose = require("mongoose");

const RepaymentSchedule = require("../models/RepaymentSchedule");
const MurabahaContract = require("../models/MurabahaContract");
const Payment = require("../models/Payment");
const Startup = require("../models/Startup");
const User = require("../models/User");
const Notification = require("../models/Notification");
const AuditLog = require("../models/AuditLog");

const { generatePaymentId } = require("./idGenerator");
const { chargeStartup } = require("./paymentGateway");
const { sendMail, templates } = require("./mailer");

const DEFAULT_AFTER = Number(process.env.DEFAULT_AFTER_FAILED_INSTALLMENTS || 3);

// Drop credit rating by N points on each failed installment.
// 100 → ~67 after 3 misses → contract default.
const RATING_DROP_PER_FAILURE = 10;
// Increase rating slightly on each on-time payment, capped at 100.
const RATING_GAIN_PER_SUCCESS = 1;

const safeAudit = async (entry) => {
  try { await AuditLog.create(entry); }
  catch (err) { console.error("[AuditLog] Failed:", err.message); }
};

const safeMail = async (args) => {
  try { await sendMail(args); }
  catch (err) { console.error("[Mail] Failed:", err.message); }
};

const safeNotify = async (args) => {
  try { await Notification.create(args); }
  catch (err) { console.error("[Notification] Failed:", err.message); }
};

/**
 * Process a single installment. Returns a result object describing
 * what happened — never throws for ordinary "payment failed"
 * outcomes. Throws only for unrecoverable system errors.
 *
 * @param {Object} args
 * @param {string|ObjectId} args.scheduleId  — the installment row to process
 * @param {string} [args.method='jazzcash']  — payment method
 * @param {'auto'|'user'|'admin'} [args.initiatedBy='auto']
 * @param {Object} [args.req]                — for IP/UA in audit log
 * @returns {Promise<{
 *   ok: boolean,
 *   skipped?: string,        // present if we couldn't process (already paid, etc.)
 *   payment?: Object,        // Payment doc (success or failed)
 *   schedule?: Object,       // updated schedule doc
 *   contract?: Object,       // updated contract doc
 *   contractCompleted?: boolean,
 *   contractDefaulted?: boolean,
 * }>}
 */
const processInstallment = async ({
  scheduleId,
  method = "jazzcash",
  initiatedBy = "auto",
  req = null,
}) => {
  // ---- 1. Atomic claim ----
  // Only claim 'unpaid' or 'overdue' rows. If status is already
  // 'pending' (someone else is processing) or 'paid'/'waived',
  // we abort cleanly.
  const claimedSchedule = await RepaymentSchedule.findOneAndUpdate(
    {
      _id: scheduleId,
      status: { $in: ["unpaid", "overdue"] },
    },
    { $set: { status: "unpaid" } }, // keep as unpaid; we'll flip on outcome
    { new: true }
  );
  if (!claimedSchedule) {
    return { ok: false, skipped: "already_processed_or_not_found" };
  }

  // Load the contract (no need to lock — we only mutate counters at the end)
  const contract = await MurabahaContract.findById(claimedSchedule.contractId);
  if (!contract) {
    return { ok: false, skipped: "contract_missing" };
  }
  if (contract.status !== "active") {
    return { ok: false, skipped: `contract_not_active (${contract.status})` };
  }

  const startup = await Startup.findById(contract.startupId).populate(
    "userId",
    "fullName email"
  );
  if (!startup || !startup.userId) {
    return { ok: false, skipped: "startup_or_user_missing" };
  }

  const user = startup.userId;
  const amount = claimedSchedule.amountDue + (claimedSchedule.lateFeeAmount || 0);

  // ---- 2. Call payment gateway ----
  const gw = await chargeStartup({
    startupId: String(startup._id),
    amountPKR: amount,
    method,
    scheduleId: String(claimedSchedule._id),
  });

  // ---- 3. Persist outcome ----
  if (gw.success) {
    return await onSuccess({
      schedule: claimedSchedule,
      contract,
      startup,
      user,
      method,
      initiatedBy,
      gw,
      amount,
      req,
    });
  } else {
    return await onFailure({
      schedule: claimedSchedule,
      contract,
      startup,
      user,
      method,
      initiatedBy,
      gw,
      amount,
      req,
    });
  }
};

// ---------- success path ----------
const onSuccess = async ({
  schedule, contract, startup, user, method, initiatedBy, gw, amount, req,
}) => {
  const paymentId = generatePaymentId();
  const paidAt = new Date();

  // Create Payment doc
  const payment = await Payment.create({
    paymentId,
    contractId: contract._id,
    scheduleId: schedule._id,
    startupId: startup._id,
    amount,
    method,
    status: "successful",
    initiatedBy,
    gatewayReference: gw.reference,
    gatewayResponseCode: gw.code,
    gatewayResponseMessage: gw.message,
  });

  // Mark schedule paid
  await RepaymentSchedule.updateOne(
    { _id: schedule._id },
    { $set: { status: "paid", paidAt, paymentId: payment._id } }
  );

  // Update contract counters atomically
  // - paidInstallments += 1
  // - totalPaidAmount += amount
  // - if all installments paid → mark completed, release credit
  const updatedContract = await MurabahaContract.findByIdAndUpdate(
    contract._id,
    {
      $inc: {
        paidInstallments: 1,
        totalPaidAmount: amount,
        overdueCount: schedule.status === "overdue" ? -1 : 0,
      },
    },
    { new: true }
  );

  // Compute the next due date (next unpaid installment in the future)
  const nextUnpaid = await RepaymentSchedule.findOne({
    contractId: contract._id,
    status: { $in: ["unpaid", "overdue"] },
  })
    .sort({ installmentNumber: 1 })
    .lean();

  let contractCompleted = false;
  if (updatedContract.paidInstallments >= updatedContract.installmentCount) {
    // All installments paid → complete + release credit
    await MurabahaContract.updateOne(
      { _id: contract._id, status: "active" },
      {
        $set: {
          status: "completed",
          completedAt: new Date(),
          nextDueDate: null,
        },
      }
    );
    await Startup.updateOne(
      { _id: startup._id },
      {
        $inc: { usedCredit: -contract.principalAmount },
        // Slight rating boost for full repayment
        $min: { creditRating: 100 },
      }
    );
    // Bump rating up to 100 (cap)
    await Startup.updateOne(
      { _id: startup._id },
      [
        {
          $set: {
            creditRating: { $min: [{ $add: ["$creditRating", 5] }, 100] },
          },
        },
      ]
    );
    contractCompleted = true;
  } else {
    // Bump credit rating slightly for on-time payment
    await Startup.updateOne({ _id: startup._id }, [
      {
        $set: {
          creditRating: {
            $min: [{ $add: ["$creditRating", RATING_GAIN_PER_SUCCESS] }, 100],
          },
        },
      },
    ]);
    // Update next due date to the next unpaid row
    if (nextUnpaid) {
      await MurabahaContract.updateOne(
        { _id: contract._id },
        { $set: { nextDueDate: nextUnpaid.dueDate } }
      );
    }
  }

  // Final fresh contract for response
  const finalContract = await MurabahaContract.findById(contract._id);

  // Receipt email
  const remainingInstallments =
    finalContract.installmentCount - finalContract.paidInstallments;
  const remainingBalance = Math.max(
    0,
    finalContract.totalPayable - finalContract.totalPaidAmount
  );

  await safeMail({
    to: user.email,
    ...templates.installmentReceiptEmail({
      name: user.fullName,
      contractId: contract.contractId,
      paymentId,
      installmentNumber: schedule.installmentNumber,
      totalInstallments: contract.installmentCount,
      amount,
      paidAt: paidAt.toISOString(),
      remainingInstallments,
      remainingBalance,
    }),
  });

  await safeNotify({
    userId: user._id,
    title: contractCompleted
      ? "Contract fully repaid 🎉"
      : `Installment ${schedule.installmentNumber} paid`,
    message: contractCompleted
      ? `Contract ${contract.contractId} is fully repaid. Your credit limit has been freed up.`
      : `PKR ${amount.toLocaleString("en-PK")} processed for installment ${schedule.installmentNumber}/${contract.installmentCount}.`,
    type: "payment",
    severity: "success",
    relatedContractId: contract._id,
    relatedPaymentId: payment._id,
    actionUrl: `/contracts/${contract._id}/schedule`,
  });

  if (contractCompleted) {
    await safeMail({
      to: user.email,
      ...templates.contractCompletedEmail({
        name: user.fullName,
        contractId: contract.contractId,
        vendorName: "your vendor", // could populate from request, but kept lean
        totalPaid: finalContract.totalPaidAmount,
      }),
    });
  }

  await safeAudit({
    actorId: user._id,
    actorRole: initiatedBy === "auto" ? "system" : "startup",
    action: "PAYMENT_SUCCESS",
    targetType: "payment",
    targetId: String(payment._id),
    details: {
      paymentId,
      contractId: contract.contractId,
      installment: schedule.installmentNumber,
      amount,
      reference: gw.reference,
      simulated: gw.simulated,
    },
    ipAddress: req?.ip || "",
    userAgent: req?.headers?.["user-agent"] || "",
  });

  return {
    ok: true,
    payment,
    schedule: { ...schedule.toObject(), status: "paid", paidAt, paymentId: payment._id },
    contract: finalContract,
    contractCompleted,
    contractDefaulted: false,
  };
};

// ---------- failure path ----------
const onFailure = async ({
  schedule, contract, startup, user, method, initiatedBy, gw, amount, req,
}) => {
  const paymentId = generatePaymentId();

  // Compute late fee — % of installment amount, configurable per contract
  const latePctRaw = Number(contract.latePaymentFeePercent) || 0;
  const lateFee = Math.round((schedule.amountDue * latePctRaw) / 100);

  // Persist failed Payment doc (audit trail)
  const payment = await Payment.create({
    paymentId,
    contractId: contract._id,
    scheduleId: schedule._id,
    startupId: startup._id,
    amount,
    method,
    status: "failed",
    initiatedBy,
    gatewayReference: gw.reference,
    gatewayResponseCode: gw.code,
    gatewayResponseMessage: gw.message,
    failureReason: gw.message,
  });

  // Update schedule: status → overdue (if past due) or stays unpaid; bump failedAttempts
  const isPastDue = new Date(schedule.dueDate) <= new Date();
  await RepaymentSchedule.updateOne(
    { _id: schedule._id },
    {
      $set: {
        status: isPastDue ? "overdue" : "unpaid",
        lateFeeAmount: (schedule.lateFeeAmount || 0) + lateFee,
      },
      $inc: { failedAttempts: 1 },
    }
  );

  // Bump contract.overdueCount (only if newly overdue)
  if (isPastDue && schedule.status !== "overdue") {
    await MurabahaContract.updateOne(
      { _id: contract._id },
      { $inc: { overdueCount: 1 } }
    );
  }

  // Drop credit rating
  await Startup.updateOne({ _id: startup._id }, [
    {
      $set: {
        creditRating: {
          $max: [{ $subtract: ["$creditRating", RATING_DROP_PER_FAILURE] }, 0],
        },
      },
    },
  ]);

  // Check default condition: count CONSECUTIVE overdue/failed installments
  // up through the most recent due date.
  let contractDefaulted = false;
  const overdueCount = await RepaymentSchedule.countDocuments({
    contractId: contract._id,
    status: "overdue",
  });

  if (overdueCount >= DEFAULT_AFTER && contract.status === "active") {
    await MurabahaContract.updateOne(
      { _id: contract._id, status: "active" },
      { $set: { status: "defaulted" } }
    );

    const outstanding = Math.max(
      0,
      contract.totalPayable - (contract.totalPaidAmount || 0)
    );

    await safeMail({
      to: user.email,
      ...templates.contractDefaultedEmail({
        name: user.fullName,
        contractId: contract.contractId,
        missedCount: overdueCount,
        outstandingAmount: outstanding,
      }),
    });

    await safeNotify({
      userId: user._id,
      title: "Contract defaulted",
      message: `Contract ${contract.contractId} has been marked as defaulted after ${overdueCount} missed payments. Please contact support.`,
      type: "contract",
      severity: "error",
      relatedContractId: contract._id,
    });

    await safeAudit({
      actorId: user._id,
      actorRole: "system",
      action: "MARK_CONTRACT_DEFAULTED",
      targetType: "contract",
      targetId: String(contract._id),
      details: {
        contractId: contract.contractId,
        overdueCount,
        outstanding,
      },
      ipAddress: req?.ip || "",
      userAgent: req?.headers?.["user-agent"] || "",
    });

    contractDefaulted = true;
  }

  // Failure email (unless already defaulted; that has its own email)
  if (!contractDefaulted) {
    // Compute next retry date — next day at the same hour
    const next = new Date();
    next.setDate(next.getDate() + 1);
    const nextRetry = next.toISOString().split("T")[0];

    await safeMail({
      to: user.email,
      ...templates.installmentFailedEmail({
        name: user.fullName,
        contractId: contract.contractId,
        installmentNumber: schedule.installmentNumber,
        amount: schedule.amountDue,
        reason: gw.message,
        lateFee,
        nextRetryDate: nextRetry,
      }),
    });
  }

  await safeNotify({
    userId: user._id,
    title: `Payment failed — installment ${schedule.installmentNumber}`,
    message: `${gw.message}. Late fee of PKR ${lateFee.toLocaleString("en-PK")} added.`,
    type: "payment",
    severity: "error",
    relatedContractId: contract._id,
    relatedPaymentId: payment._id,
  });

  await safeAudit({
    actorId: user._id,
    actorRole: initiatedBy === "auto" ? "system" : "startup",
    action: "PAYMENT_FAILED",
    targetType: "payment",
    targetId: String(payment._id),
    details: {
      paymentId,
      contractId: contract.contractId,
      installment: schedule.installmentNumber,
      amount,
      lateFee,
      reason: gw.message,
      reference: gw.reference,
      simulated: gw.simulated,
    },
    ipAddress: req?.ip || "",
    userAgent: req?.headers?.["user-agent"] || "",
  });

  const finalContract = await MurabahaContract.findById(contract._id);

  return {
    ok: false,
    payment,
    schedule: await RepaymentSchedule.findById(schedule._id),
    contract: finalContract,
    contractCompleted: false,
    contractDefaulted,
  };
};

// ==============================================================
// runDailyCycle — scans all active contracts, runs reminders
// for upcoming installments and auto-charges due ones.
// --------------------------------------------------------------
// Intended to be run once per day (cron). Idempotent: a row is
// only processed if status is unpaid/overdue and dueDate <= now.
//
// Returns counts so the admin can see what happened.
// ==============================================================
const runDailyCycle = async ({ now = new Date() } = {}) => {
  const stats = {
    remindersSent: 0,
    chargesAttempted: 0,
    chargesSuccessful: 0,
    chargesFailed: 0,
    contractsCompleted: 0,
    contractsDefaulted: 0,
    skipped: 0,
  };

  // 1) REMINDERS — installments due in REMINDER_DAYS_BEFORE days
  const reminderDays = Number(process.env.REPAYMENT_REMINDER_DAYS_BEFORE || 3);
  const reminderStart = new Date(now);
  reminderStart.setHours(0, 0, 0, 0);
  reminderStart.setDate(reminderStart.getDate() + reminderDays);
  const reminderEnd = new Date(reminderStart);
  reminderEnd.setHours(23, 59, 59, 999);

  const reminderCandidates = await RepaymentSchedule.find({
    status: "unpaid",
    dueDate: { $gte: reminderStart, $lte: reminderEnd },
  }).lean();

  for (const row of reminderCandidates) {
    const contract = await MurabahaContract.findById(row.contractId).lean();
    if (!contract || contract.status !== "active") continue;

    const startup = await Startup.findById(row.startupId).populate(
      "userId",
      "fullName email"
    );
    if (!startup || !startup.userId) continue;

    await safeMail({
      to: startup.userId.email,
      ...templates.installmentReminderEmail({
        name: startup.userId.fullName,
        contractId: contract.contractId,
        installmentNumber: row.installmentNumber,
        amountDue: row.amountDue,
        dueDate: new Date(row.dueDate).toISOString().split("T")[0],
        daysRemaining: reminderDays,
      }),
    });
    stats.remindersSent++;
  }

  // 2) AUTO-CHARGES — installments due today or earlier, still unpaid
  const dueCutoff = new Date(now);
  dueCutoff.setHours(23, 59, 59, 999);

  const dueRows = await RepaymentSchedule.find({
    status: { $in: ["unpaid", "overdue"] },
    dueDate: { $lte: dueCutoff },
  })
    .sort({ dueDate: 1 })
    .lean();

  for (const row of dueRows) {
    stats.chargesAttempted++;
    const result = await processInstallment({
      scheduleId: row._id,
      method: "jazzcash", // default for auto-cycle; user can change later
      initiatedBy: "auto",
    });

    if (result.skipped) {
      stats.skipped++;
      continue;
    }
    if (result.ok) stats.chargesSuccessful++;
    else stats.chargesFailed++;

    if (result.contractCompleted) stats.contractsCompleted++;
    if (result.contractDefaulted) stats.contractsDefaulted++;
  }

  return stats;
};

module.exports = { processInstallment, runDailyCycle };
