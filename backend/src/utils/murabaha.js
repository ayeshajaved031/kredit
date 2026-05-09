// ==============================================================
// Murabaha Calculation Module
// --------------------------------------------------------------
// The "core module" per the iteration doc. Given a financing
// request's principal amount, produces:
//
//   - markupAmount     (fixed profit, NOT compounding interest)
//   - totalPayable     (principal + markup)
//   - monthlyInstallment (totalPayable / N installments)
//   - schedule         (array of {installmentNumber, dueDate, amount})
//
// Why this is Shariah-compliant:
//   1. Kredit "buys" the SaaS subscription as an asset (principal).
//   2. Kredit resells to the startup at a fixed higher price
//      (principal + markup), disclosed up front.
//   3. The markup never grows over time — no compounding.
//   4. Late payment fees go to charity (not Kredit revenue) —
//      configurable in the contract template.
//
// Rounding rule:
//   We round the monthly installment UP to the nearest rupee, and
//   adjust the LAST installment down so the sum equals totalPayable
//   exactly. This avoids "the borrower owes 0.04 PKR more after 12
//   payments" precision bugs.
// ==============================================================

/**
 * Calculate the full Murabaha breakdown for a given principal.
 *
 * @param {Object} opts
 * @param {number} opts.principal - The vendor's annual price in PKR
 * @param {number} [opts.markupPercent] - Profit margin %, default from env
 * @param {number} [opts.installmentCount] - Number of months, default 12
 * @param {Date}   [opts.firstDueDate] - When installment #1 is due (default: today + 30 days)
 * @returns {Object} { principal, markupPercent, markupAmount, totalPayable,
 *                     monthlyInstallment, installmentCount, schedule }
 */
const calculateMurabaha = ({
  principal,
  markupPercent = Number(process.env.MURABAHA_MARKUP_PERCENT || 10),
  installmentCount = Number(process.env.MURABAHA_INSTALLMENTS || 12),
  firstDueDate = null,
} = {}) => {
  // -------- Input validation --------
  if (!Number.isFinite(principal) || principal <= 0) {
    throw new Error("Principal must be a positive number");
  }
  if (!Number.isFinite(markupPercent) || markupPercent < 0 || markupPercent > 50) {
    throw new Error("Markup percent must be between 0 and 50");
  }
  if (!Number.isInteger(installmentCount) || installmentCount < 1 || installmentCount > 36) {
    throw new Error("Installment count must be an integer between 1 and 36");
  }

  // -------- Money math --------
  // Round to whole rupees throughout — no fractional currency.
  const markupAmount = Math.round((principal * markupPercent) / 100);
  const totalPayable = principal + markupAmount;

  // Per-installment amount, rounded up so we never short the
  // expected total.
  const baseInstallment = Math.ceil(totalPayable / installmentCount);

  // First (N-1) installments are baseInstallment; the last one
  // absorbs the rounding adjustment.
  const lastInstallment = totalPayable - baseInstallment * (installmentCount - 1);

  // -------- Schedule --------
  const start = firstDueDate ? new Date(firstDueDate) : addDays(new Date(), 30);

  const schedule = [];
  for (let i = 1; i <= installmentCount; i++) {
    schedule.push({
      installmentNumber: i,
      amountDue: i === installmentCount ? lastInstallment : baseInstallment,
      dueDate: addMonths(start, i - 1),
    });
  }

  // Sanity check — schedule sum should equal totalPayable exactly.
  const scheduleSum = schedule.reduce((acc, s) => acc + s.amountDue, 0);
  if (scheduleSum !== totalPayable) {
    throw new Error(
      `Murabaha schedule sum mismatch: expected ${totalPayable}, got ${scheduleSum}`
    );
  }

  return {
    principal,
    markupPercent,
    markupAmount,
    totalPayable,
    monthlyInstallment: baseInstallment, // representative; last may differ slightly
    installmentCount,
    schedule,
  };
};

// -------- Date helpers (kept inline because they're tiny) --------

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const addMonths = (date, months) => {
  const d = new Date(date);
  // Cap day at end of target month so "Jan 31 + 1 month" → Feb 28/29
  const targetMonth = d.getMonth() + months;
  const targetYear = d.getFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const lastDayOfTarget = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  const finalDay = Math.min(d.getDate(), lastDayOfTarget);
  return new Date(targetYear, normalizedMonth, finalDay);
};

module.exports = { calculateMurabaha, addDays, addMonths };
