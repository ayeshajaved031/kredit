// ==============================================================
// Admin Reports Controller
// --------------------------------------------------------------
// Five aggregation-driven reports. All admin-only, all read-only.
//
//   GET /api/admin/reports/portfolio-overview
//   GET /api/admin/reports/monthly-disbursement
//   GET /api/admin/reports/repayment-performance
//   GET /api/admin/reports/top-vendors
//   GET /api/admin/reports/audit-summary
//
// Why aggregations instead of "find + count in JS"?
//   - Scales: aggregation runs in Mongo, hits indexes
//   - Atomic snapshot of the data
//   - One round-trip per report (we even Promise.all multiple
//     pipelines for the overview)
//
// Time zone note: dates are stored UTC. Monthly buckets are also
// UTC. Pakistan is UTC+5, so "October" boundaries shift by 5h —
// fine for an MVP report, but documented here for future fixes.
// ==============================================================

const mongoose = require("mongoose");

const MurabahaContract = require("../models/MurabahaContract");
const FinancingRequest = require("../models/FinancingRequest");
const RepaymentSchedule = require("../models/RepaymentSchedule");
const Payment = require("../models/Payment");
const Startup = require("../models/Startup");
const AuditLog = require("../models/AuditLog");

const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const { ok } = require("../utils/response");

// ---------- helpers ----------

// Subtract `n` months from a date, returning a Date at the FIRST
// of that month at 00:00 UTC. Used as a default report start.
const monthsAgo = (n) => {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCMonth(d.getUTCMonth() - n);
  return d;
};

const daysAgo = (n) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
};

// Build a "YYYY-MM" key for grouping in JS post-processing
const ymKey = (date) => {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

// Fill in missing months in a series so charts show flat zeros
// instead of a gap.
const fillMonthlyGaps = (series, fromDate, toDate, defaults) => {
  const byKey = Object.fromEntries(series.map((s) => [s.month, s]));
  const out = [];
  const cursor = new Date(fromDate);
  cursor.setUTCDate(1);
  cursor.setUTCHours(0, 0, 0, 0);
  while (cursor <= toDate) {
    const key = ymKey(cursor);
    out.push(byKey[key] || { month: key, ...defaults });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return out;
};

// ==============================================================
// GET /api/admin/reports/portfolio-overview
// --------------------------------------------------------------
// Single dashboard snapshot. All counts and totals in one call.
// ==============================================================
const portfolioOverview = asyncHandler(async (_req, res) => {
  const [
    contractStatusCounts,
    contractMoney,
    requestStatusCounts,
    overdueScheduleCount,
    overdueAmountAgg,
    activeContracts,
    defaultedContracts,
    totalContracts,
    kycCounts,
    startupTotals,
  ] = await Promise.all([
    // contracts grouped by status
    MurabahaContract.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),

    // money: principal deployed (active+completed), total collected, outstanding
    MurabahaContract.aggregate([
      {
        $match: { status: { $in: ["active", "completed", "defaulted"] } },
      },
      {
        $group: {
          _id: null,
          totalPrincipalDeployed: { $sum: "$principalAmount" },
          totalPayable: { $sum: "$totalPayable" },
          totalCollected: { $sum: "$totalPaidAmount" },
        },
      },
    ]),

    // financing requests by status (for funnel view)
    FinancingRequest.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),

    // overdue installments
    RepaymentSchedule.countDocuments({ status: "overdue" }),

    // outstanding overdue amount
    RepaymentSchedule.aggregate([
      { $match: { status: "overdue" } },
      {
        $group: {
          _id: null,
          totalOverdueAmount: {
            $sum: { $add: ["$amountDue", { $ifNull: ["$lateFeeAmount", 0] }] },
          },
        },
      },
    ]),

    // counts for default-rate calc
    MurabahaContract.countDocuments({ status: "active" }),
    MurabahaContract.countDocuments({ status: "defaulted" }),
    MurabahaContract.countDocuments({
      status: { $in: ["active", "completed", "defaulted"] },
    }),

    // KYC funnel
    Startup.aggregate([
      { $group: { _id: "$kycStatus", count: { $sum: 1 } } },
    ]),

    // total approved credit + used credit across the platform
    Startup.aggregate([
      {
        $group: {
          _id: null,
          totalApprovedCredit: { $sum: "$approvedCreditLimit" },
          totalUsedCredit: { $sum: "$usedCredit" },
        },
      },
    ]),
  ]);

  const contractsByStatus = Object.fromEntries(
    contractStatusCounts.map((c) => [c._id, c.count])
  );
  const requestsByStatus = Object.fromEntries(
    requestStatusCounts.map((r) => [r._id, r.count])
  );
  const startupsByKyc = Object.fromEntries(
    kycCounts.map((k) => [k._id, k.count])
  );

  const money = contractMoney[0] || {
    totalPrincipalDeployed: 0,
    totalPayable: 0,
    totalCollected: 0,
  };

  const credit = startupTotals[0] || {
    totalApprovedCredit: 0,
    totalUsedCredit: 0,
  };

  const overdueAmount =
    (overdueAmountAgg[0] || {}).totalOverdueAmount || 0;

  // Default rate over contracts that have actually been issued
  // (active + completed + defaulted).
  const defaultRatePct =
    totalContracts > 0
      ? Number(((defaultedContracts / totalContracts) * 100).toFixed(2))
      : 0;

  return ok(res, {
    data: {
      portfolio: {
        totalPrincipalDeployed: money.totalPrincipalDeployed,
        totalPayable: money.totalPayable,
        totalCollected: money.totalCollected,
        outstanding: Math.max(0, money.totalPayable - money.totalCollected),
        overdueInstallments: overdueScheduleCount,
        overdueAmount,
      },
      credit: {
        totalApprovedCredit: credit.totalApprovedCredit,
        totalUsedCredit: credit.totalUsedCredit,
        availableCreditAcrossPlatform: Math.max(
          0,
          credit.totalApprovedCredit - credit.totalUsedCredit
        ),
      },
      contracts: {
        ...{ draft: 0, active: 0, completed: 0, defaulted: 0, cancelled: 0 },
        ...contractsByStatus,
        defaultRatePct,
      },
      requests: {
        ...{
          pending: 0,
          under_review: 0,
          approved: 0,
          rejected: 0,
          expired: 0,
          withdrawn: 0,
        },
        ...requestsByStatus,
      },
      startups: {
        ...{ unverified: 0, under_review: 0, verified: 0, rejected: 0 },
        ...startupsByKyc,
      },
    },
  });
});

// ==============================================================
// GET /api/admin/reports/monthly-disbursement?months=12
// --------------------------------------------------------------
// Time series: how much Kredit DISBURSED to vendors per month
// (sum of contract.principalAmount where vendorPaidAt in month)
// AND how much was COLLECTED from startups per month
// (sum of payment.amount where status=successful and createdAt in month).
//
// Default window: last 12 months. Returns gap-filled array.
// ==============================================================
const monthlyDisbursement = asyncHandler(async (req, res) => {
  const months = Math.max(1, Math.min(Number(req.query.months) || 12, 36));
  const fromDate = monthsAgo(months - 1); // include current month
  const toDate = new Date();

  // Disbursements (vendor payments)
  const disbursementAgg = await MurabahaContract.aggregate([
    {
      $match: {
        vendorPaidAt: { $gte: fromDate, $lte: toDate },
        vendorPaymentStatus: "completed",
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$vendorPaidAt" },
          month: { $month: "$vendorPaidAt" },
        },
        totalDisbursed: { $sum: "$principalAmount" },
        contractsCount: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        month: {
          $concat: [
            { $toString: "$_id.year" },
            "-",
            {
              $cond: [
                { $lt: ["$_id.month", 10] },
                { $concat: ["0", { $toString: "$_id.month" }] },
                { $toString: "$_id.month" },
              ],
            },
          ],
        },
        totalDisbursed: 1,
        contractsCount: 1,
      },
    },
  ]);

  // Collections (successful payments from startups)
  const collectionAgg = await Payment.aggregate([
    {
      $match: {
        status: "successful",
        createdAt: { $gte: fromDate, $lte: toDate },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        },
        totalCollected: { $sum: "$amount" },
        paymentsCount: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        month: {
          $concat: [
            { $toString: "$_id.year" },
            "-",
            {
              $cond: [
                { $lt: ["$_id.month", 10] },
                { $concat: ["0", { $toString: "$_id.month" }] },
                { $toString: "$_id.month" },
              ],
            },
          ],
        },
        totalCollected: 1,
        paymentsCount: 1,
      },
    },
  ]);

  // Merge the two series by month, then gap-fill
  const byMonth = {};
  for (const d of disbursementAgg) {
    byMonth[d.month] = {
      month: d.month,
      totalDisbursed: d.totalDisbursed,
      contractsCount: d.contractsCount,
      totalCollected: 0,
      paymentsCount: 0,
    };
  }
  for (const c of collectionAgg) {
    if (!byMonth[c.month]) {
      byMonth[c.month] = {
        month: c.month,
        totalDisbursed: 0,
        contractsCount: 0,
        totalCollected: c.totalCollected,
        paymentsCount: c.paymentsCount,
      };
    } else {
      byMonth[c.month].totalCollected = c.totalCollected;
      byMonth[c.month].paymentsCount = c.paymentsCount;
    }
  }

  const merged = Object.values(byMonth);
  const series = fillMonthlyGaps(merged, fromDate, toDate, {
    totalDisbursed: 0,
    contractsCount: 0,
    totalCollected: 0,
    paymentsCount: 0,
  });

  // Totals across the window
  const totals = series.reduce(
    (acc, s) => ({
      totalDisbursed: acc.totalDisbursed + s.totalDisbursed,
      totalCollected: acc.totalCollected + s.totalCollected,
      contractsCount: acc.contractsCount + s.contractsCount,
      paymentsCount: acc.paymentsCount + s.paymentsCount,
    }),
    { totalDisbursed: 0, totalCollected: 0, contractsCount: 0, paymentsCount: 0 }
  );

  return ok(res, {
    data: {
      months,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      series,
      totals,
    },
  });
});

// ==============================================================
// GET /api/admin/reports/repayment-performance
// --------------------------------------------------------------
// On-time / late / default rates + average days overdue.
//
// "On-time" = installment.paidAt <= dueDate (or paidAt is missing
//             but status is paid and we infer on-time).
// "Late"    = paidAt > dueDate.
// We compute over the population of paid+overdue+failed installments
// (i.e., installments that have come due — we exclude future ones).
// ==============================================================
const repaymentPerformance = asyncHandler(async (_req, res) => {
  const now = new Date();

  // Population: schedules whose due date has passed
  // (so unpaid future installments don't pollute the math).
  const dueByNow = { dueDate: { $lte: now } };

  // Counts by status
  const statusCounts = await RepaymentSchedule.aggregate([
    { $match: dueByNow },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const counts = Object.fromEntries(
    statusCounts.map((s) => [s._id, s.count])
  );
  const paid = counts.paid || 0;
  const overdue = counts.overdue || 0;
  const unpaid = counts.unpaid || 0; // due but not yet attempted (rare)
  const waived = counts.waived || 0;
  const totalDue = paid + overdue + unpaid + waived;

  // Of paid: how many on-time vs late?
  // on-time = paidAt <= dueDate
  const paidBreakdown = await RepaymentSchedule.aggregate([
    { $match: { status: "paid", paidAt: { $ne: null } } },
    {
      $project: {
        onTime: { $lte: ["$paidAt", "$dueDate"] },
        daysLate: {
          $max: [
            0,
            {
              $divide: [
                { $subtract: ["$paidAt", "$dueDate"] },
                1000 * 60 * 60 * 24,
              ],
            },
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        onTime: { $sum: { $cond: ["$onTime", 1, 0] } },
        late: { $sum: { $cond: ["$onTime", 0, 1] } },
        avgDaysLate: { $avg: "$daysLate" },
        maxDaysLate: { $max: "$daysLate" },
      },
    },
  ]);

  const pb = paidBreakdown[0] || { onTime: 0, late: 0, avgDaysLate: 0, maxDaysLate: 0 };

  // Avg days overdue for currently-overdue rows
  const overdueDaysAgg = await RepaymentSchedule.aggregate([
    { $match: { status: "overdue" } },
    {
      $project: {
        daysOverdue: {
          $divide: [{ $subtract: [now, "$dueDate"] }, 1000 * 60 * 60 * 24],
        },
      },
    },
    {
      $group: {
        _id: null,
        avgDaysOverdue: { $avg: "$daysOverdue" },
        maxDaysOverdue: { $max: "$daysOverdue" },
      },
    },
  ]);
  const od = overdueDaysAgg[0] || { avgDaysOverdue: 0, maxDaysOverdue: 0 };

  // Contract-level default rate
  const [activeContracts, defaultedContracts, completedContracts] = await Promise.all([
    MurabahaContract.countDocuments({ status: "active" }),
    MurabahaContract.countDocuments({ status: "defaulted" }),
    MurabahaContract.countDocuments({ status: "completed" }),
  ]);
  const totalIssued = activeContracts + defaultedContracts + completedContracts;

  const pct = (n, d) => (d > 0 ? Number(((n / d) * 100).toFixed(2)) : 0);

  return ok(res, {
    data: {
      installments: {
        totalDue,
        paid,
        overdue,
        unpaid,
        waived,
        paidPct: pct(paid, totalDue),
        overduePct: pct(overdue, totalDue),
      },
      paymentTimeliness: {
        onTime: pb.onTime,
        late: pb.late,
        onTimePct: pct(pb.onTime, pb.onTime + pb.late),
        avgDaysLate: Number((pb.avgDaysLate || 0).toFixed(2)),
        maxDaysLate: Number((pb.maxDaysLate || 0).toFixed(2)),
      },
      currentOverdue: {
        avgDaysOverdue: Number((od.avgDaysOverdue || 0).toFixed(2)),
        maxDaysOverdue: Number((od.maxDaysOverdue || 0).toFixed(2)),
      },
      contracts: {
        active: activeContracts,
        completed: completedContracts,
        defaulted: defaultedContracts,
        totalIssued,
        defaultRatePct: pct(defaultedContracts, totalIssued),
        completionRatePct: pct(completedContracts, totalIssued),
      },
    },
  });
});

// ==============================================================
// GET /api/admin/reports/top-vendors?limit=10
// --------------------------------------------------------------
// Vendors ranked by total financed volume (sum of principal across
// approved/active/completed/defaulted requests). Includes counts
// per status so the team can see which vendors have higher default
// rates.
// ==============================================================
const topVendors = asyncHandler(async (req, res) => {
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 10, 50));

  const rows = await FinancingRequest.aggregate([
    {
      $match: {
        status: { $in: ["approved"] },
      },
    },
    {
      $lookup: {
        from: "murabahacontracts",
        localField: "contractId",
        foreignField: "_id",
        as: "contract",
      },
    },
    {
      $unwind: { path: "$contract", preserveNullAndEmptyArrays: true },
    },
    {
      $group: {
        _id: "$vendorId",
        vendorName: { $first: "$vendorNameSnapshot" },
        totalFinanced: { $sum: "$annualAmountPKR" },
        requestCount: { $sum: 1 },
        activeContracts: {
          $sum: {
            $cond: [{ $eq: ["$contract.status", "active"] }, 1, 0],
          },
        },
        completedContracts: {
          $sum: {
            $cond: [{ $eq: ["$contract.status", "completed"] }, 1, 0],
          },
        },
        defaultedContracts: {
          $sum: {
            $cond: [{ $eq: ["$contract.status", "defaulted"] }, 1, 0],
          },
        },
      },
    },
    {
      $lookup: {
        from: "vendors",
        localField: "_id",
        foreignField: "_id",
        as: "vendor",
      },
    },
    {
      $unwind: { path: "$vendor", preserveNullAndEmptyArrays: true },
    },
    {
      $project: {
        _id: 1,
        vendorName: 1,
        category: "$vendor.category",
        logoUrl: "$vendor.logoUrl",
        isActive: "$vendor.isActive",
        totalFinanced: 1,
        requestCount: 1,
        activeContracts: 1,
        completedContracts: 1,
        defaultedContracts: 1,
      },
    },
    { $sort: { totalFinanced: -1 } },
    { $limit: limit },
  ]);

  return ok(res, {
    data: { topVendors: rows, count: rows.length, limit },
  });
});

// ==============================================================
// GET /api/admin/reports/audit-summary?days=30
// --------------------------------------------------------------
// Counts of admin/system actions in the last N days, grouped by
// action type. Useful for compliance reviews — "what did the team
// do this month?"
// ==============================================================
const auditSummary = asyncHandler(async (req, res) => {
  const days = Math.max(1, Math.min(Number(req.query.days) || 30, 365));
  const since = daysAgo(days);

  const byAction = await AuditLog.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: "$action",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);

  const byActor = await AuditLog.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: "$actorId",
        count: { $sum: 1 },
        actorRole: { $first: "$actorRole" },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "actor",
      },
    },
    {
      $unwind: { path: "$actor", preserveNullAndEmptyArrays: true },
    },
    {
      $project: {
        actorId: "$_id",
        _id: 0,
        actorRole: 1,
        count: 1,
        actorName: "$actor.fullName",
        actorEmail: "$actor.email",
      },
    },
    { $sort: { count: -1 } },
    { $limit: 20 },
  ]);

  const totalActions = byAction.reduce((sum, b) => sum + b.count, 0);

  return ok(res, {
    data: {
      windowDays: days,
      since: since.toISOString(),
      totalActions,
      byAction: byAction.map((b) => ({ action: b._id, count: b.count })),
      topActors: byActor,
    },
  });
});

module.exports = {
  portfolioOverview,
  monthlyDisbursement,
  repaymentPerformance,
  topVendors,
  auditSummary,
};
