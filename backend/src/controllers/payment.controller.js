// ==============================================================
// Payment Controller
// --------------------------------------------------------------
// Endpoints (under /api/payments):
//   GET   /                         — list (own for startup, all for admin)
//   GET   /:id                      — single payment
//   GET   /:id/receipt              — payment receipt as plain text
//   POST  /pay/:scheduleId          — startup manually pays an installment
//
// Manual pay flow:
//   - Ownership check on the schedule
//   - Idempotency check (already-paid rows are rejected)
//   - Delegates to repaymentEngine.processInstallment (same code
//     path as auto-cycle — guarantees behavior parity)
// ==============================================================

const RepaymentSchedule = require("../models/RepaymentSchedule");
const MurabahaContract = require("../models/MurabahaContract");
const Payment = require("../models/Payment");
const Startup = require("../models/Startup");

const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const { ok } = require("../utils/response");
const { processInstallment } = require("../utils/repaymentEngine");

// ==============================================================
// GET /api/payments
// --------------------------------------------------------------
// Pagination + filters: ?status=, ?contractId=, ?startupId= (admin)
// ==============================================================
const list = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 25, 100);
  const skip = Math.max(Number(req.query.skip) || 0, 0);

  const filter = {};

  if (req.user.role === "startup") {
    const startup = await Startup.findOne({ userId: req.user._id }).select("_id");
    if (!startup) {
      return ok(res, { data: { payments: [], count: 0, total: 0, limit, skip } });
    }
    filter.startupId = startup._id;
  } else if (req.query.startupId) {
    filter.startupId = req.query.startupId;
  }

  if (req.query.status) {
    if (!["pending", "successful", "failed"].includes(req.query.status)) {
      throw new AppError("Invalid status filter", 400);
    }
    filter.status = req.query.status;
  }

  if (req.query.contractId) filter.contractId = req.query.contractId;

  const [payments, total] = await Promise.all([
    Payment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({ path: "contractId", select: "contractId totalPayable installmentCount" })
      .lean(),
    Payment.countDocuments(filter),
  ]);

  return ok(res, {
    data: { payments, count: payments.length, total, limit, skip },
  });
});

// ==============================================================
// GET /api/payments/:id
// ==============================================================
const getOne = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id)
    .populate({ path: "contractId", select: "contractId totalPayable" })
    .populate({ path: "scheduleId", select: "installmentNumber dueDate amountDue lateFeeAmount" });

  if (!payment) throw new AppError("Payment not found", 404);

  // Ownership check
  if (req.user.role === "startup") {
    const startup = await Startup.findOne({ userId: req.user._id }).select("_id");
    if (!startup || payment.startupId.toString() !== startup._id.toString()) {
      throw new AppError("Payment not found", 404);
    }
  }

  return ok(res, { data: { payment } });
});

// ==============================================================
// GET /api/payments/:id/receipt
// --------------------------------------------------------------
// Plain-text receipt download. Real product would render PDF.
// ==============================================================
const getReceipt = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id)
    .populate({ path: "contractId", select: "contractId totalPayable installmentCount totalPaidAmount paidInstallments" })
    .populate({ path: "scheduleId", select: "installmentNumber dueDate amountDue lateFeeAmount" })
    .populate({ path: "startupId", select: "companyName userId registrationNumber" });

  if (!payment) throw new AppError("Payment not found", 404);

  // Ownership check
  if (req.user.role === "startup") {
    const startup = await Startup.findOne({ userId: req.user._id }).select("_id");
    if (!startup || payment.startupId._id.toString() !== startup._id.toString()) {
      throw new AppError("Payment not found", 404);
    }
  }

  if (payment.status !== "successful") {
    throw new AppError("Receipts are only available for successful payments", 400);
  }

  const fmt = (n) => `PKR ${Number(n || 0).toLocaleString("en-PK")}`;
  const c = payment.contractId;
  const s = payment.scheduleId;
  const p = payment.startupId;

  const body = `
KREDIT PAYMENT RECEIPT

Payment ID:        ${payment.paymentId}
Date processed:    ${payment.createdAt.toISOString()}
Status:            ${payment.status.toUpperCase()}

Paid by:           ${p?.companyName || "—"}
Reg. number:       ${p?.registrationNumber || "—"}

Contract:          ${c?.contractId || "—"}
Installment:       ${s?.installmentNumber || "—"} of ${c?.installmentCount || "—"}
Originally due:    ${s?.dueDate ? new Date(s.dueDate).toISOString().split("T")[0] : "—"}

Installment amount: ${fmt(s?.amountDue)}
Late fee:           ${fmt(s?.lateFeeAmount)}
TOTAL CHARGED:      ${fmt(payment.amount)}

Method:            ${payment.method}
Gateway reference: ${payment.gatewayReference}

Total paid to date: ${fmt(c?.totalPaidAmount)} of ${fmt(c?.totalPayable)}
Installments paid:  ${c?.paidInstallments || 0} of ${c?.installmentCount || 0}

Thank you for your payment.
Kredit (Pvt.) Ltd.
`.trim();

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${payment.paymentId}-receipt.txt"`
  );
  return res.send(body);
});

// ==============================================================
// POST /api/payments/pay/:scheduleId  (startup, sensitive)
// --------------------------------------------------------------
// Startup manually pays an installment. Allowed for:
//   - upcoming unpaid installments (paying ahead)
//   - overdue installments (catching up)
//
// Optional body: { method: 'jazzcash' | 'easypaisa' | 'payfast' | 'bank_transfer' }
// ==============================================================
const payInstallment = asyncHandler(async (req, res) => {
  const validMethods = ["jazzcash", "easypaisa", "payfast", "bank_transfer"];
  const method = req.body?.method && validMethods.includes(req.body.method)
    ? req.body.method
    : "jazzcash";

  // Ownership check — load schedule, verify it belongs to this startup
  const schedule = await RepaymentSchedule.findById(req.params.scheduleId);
  if (!schedule) throw new AppError("Installment not found", 404);

  const startup = await Startup.findOne({ userId: req.user._id }).select("_id");
  if (!startup || schedule.startupId.toString() !== startup._id.toString()) {
    throw new AppError("Installment not found", 404);
  }

  if (schedule.status === "paid") {
    throw new AppError("This installment has already been paid", 400);
  }
  if (schedule.status === "waived") {
    throw new AppError("This installment has been waived", 400);
  }

  // Verify the parent contract is still active
  const contract = await MurabahaContract.findById(schedule.contractId).select(
    "status contractId"
  );
  if (!contract) throw new AppError("Contract not found", 404);
  if (contract.status !== "active") {
    throw new AppError(
      `Cannot pay — contract status is ${contract.status}`,
      400
    );
  }

  // Delegate to the repayment engine
  const result = await processInstallment({
    scheduleId: schedule._id,
    method,
    initiatedBy: "user",
    req,
  });

  if (result.skipped) {
    throw new AppError(
      `Payment could not be processed: ${result.skipped}`,
      409
    );
  }

  if (!result.ok) {
    // Payment was processed (recorded) but failed at the gateway
    return ok(res, {
      status: 402, // payment required
      message: "Payment failed at the gateway. A late fee may apply.",
      data: {
        payment: result.payment,
        schedule: result.schedule,
        contract: result.contract,
        gatewayMessage: result.payment.gatewayResponseMessage,
      },
    });
  }

  return ok(res, {
    message: result.contractCompleted
      ? "Payment successful — contract fully repaid."
      : "Payment successful.",
    data: {
      payment: result.payment,
      schedule: result.schedule,
      contract: result.contract,
      contractCompleted: result.contractCompleted,
    },
  });
});

module.exports = {
  list,
  getOne,
  getReceipt,
  payInstallment,
};
