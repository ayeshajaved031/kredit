// ==============================================================
// Payment Gateway Abstraction
// --------------------------------------------------------------
// Single interface for all outbound and inbound payments. The
// MVP runs in 'simulated' mode (configurable via env), but the
// function shapes deliberately match real Pakistani gateways
// (JazzCash, EasyPaisa, PayFast) so swapping in a real one later
// is a one-file change.
//
// Two payment directions:
//   payVendor  — Kredit pays the SaaS vendor (AWS, Salesforce…).
//                Used after a contract is signed.
//   chargeStartup — Startup's monthly installment is collected.
//                Used by the auto-repayment scheduler (Phase 6).
//
// Both return a uniform shape:
//   {
//     success:  boolean,
//     reference: string,    // gateway's transaction id
//     code:     string,     // gateway response code (eg "00" success)
//     message:  string,     // human-readable
//     simulated: boolean    // true when running in mock mode
//   }
//
// Failure rate is configurable so demos can exercise both paths.
// ==============================================================

const crypto = require("crypto");

const isRealMode = () => process.env.PAYMENT_GATEWAY_MODE === "real";

// In simulated mode, success rate (0-1). Default 0.95 — most txns
// succeed, but every ~20th fails so we can demo the failure flow.
const successRate = () => {
  const raw = Number(process.env.PAYMENT_GATEWAY_SUCCESS_RATE);
  return Number.isFinite(raw) && raw >= 0 && raw <= 1 ? raw : 0.95;
};

const newReference = (prefix = "GTW") =>
  `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

// ==============================================================
// payVendor — Kredit → Vendor
// --------------------------------------------------------------
// In a real implementation this would:
//   - Call the vendor's billing API (e.g., AWS Marketplace API)
//   - Or trigger a corporate-card charge / wire transfer
//   - Return the gateway's confirmation reference
//
// Failure scenarios in real life: insufficient corporate balance,
// vendor API outage, currency/FX issues. We simulate ~5% failure.
// ==============================================================
const payVendor = async ({ vendorName, amountPKR, contractId }) => {
  if (isRealMode()) {
    throw new Error(
      "Real payment gateway is not configured. Set PAYMENT_GATEWAY_MODE=simulated for MVP."
    );
  }

  // Simulate network latency (20-200ms)
  await new Promise((r) => setTimeout(r, 20 + Math.random() * 180));

  const success = Math.random() < successRate();

  if (!success) {
    return {
      success: false,
      reference: newReference("VPF"),
      code: "INSUFFICIENT_BALANCE",
      message: "Vendor payment failed: simulated insufficient corporate balance",
      simulated: true,
    };
  }

  return {
    success: true,
    reference: newReference("VPS"),
    code: "00",
    message: `Paid PKR ${amountPKR.toLocaleString("en-PK")} to ${vendorName} for contract ${contractId}`,
    simulated: true,
  };
};

// ==============================================================
// chargeStartup — Startup → Kredit (monthly installment)
// --------------------------------------------------------------
// Used by the repayment scheduler. Simulated to fail occasionally
// so we can exercise the late-payment / penalty / credit-rating
// drop flow from your iteration doc Flow 5.
//
// `method` mirrors what real gateways accept; the simulation
// ignores it but stores it for audit/reporting.
// ==============================================================
const chargeStartup = async ({ startupId, amountPKR, method, scheduleId }) => {
  if (isRealMode()) {
    throw new Error(
      "Real payment gateway is not configured. Set PAYMENT_GATEWAY_MODE=simulated for MVP."
    );
  }

  await new Promise((r) => setTimeout(r, 20 + Math.random() * 180));

  // Allow tests to force a specific outcome via a magic flag.
  // Useful for the repayment-flow tests in Phase 6.
  if (process.env.FORCE_PAYMENT_OUTCOME === "fail") {
    return {
      success: false,
      reference: newReference("CSF"),
      code: "DECLINED",
      message: "Payment declined: simulated bank rejection",
      simulated: true,
    };
  }
  if (process.env.FORCE_PAYMENT_OUTCOME === "success") {
    return {
      success: true,
      reference: newReference("CSS"),
      code: "00",
      message: `Charged PKR ${amountPKR.toLocaleString("en-PK")} via ${method}`,
      simulated: true,
    };
  }

  const success = Math.random() < successRate();
  if (!success) {
    const reasons = [
      ["INSUFFICIENT_FUNDS", "Insufficient funds in linked account"],
      ["DECLINED", "Bank declined the transaction"],
      ["CARD_EXPIRED", "Linked card has expired"],
      ["TIMEOUT", "Gateway timeout"],
    ];
    const [code, message] = reasons[Math.floor(Math.random() * reasons.length)];
    return {
      success: false,
      reference: newReference("CSF"),
      code,
      message,
      simulated: true,
    };
  }

  return {
    success: true,
    reference: newReference("CSS"),
    code: "00",
    message: `Charged PKR ${amountPKR.toLocaleString("en-PK")} via ${method}`,
    simulated: true,
  };
};

module.exports = { payVendor, chargeStartup };
