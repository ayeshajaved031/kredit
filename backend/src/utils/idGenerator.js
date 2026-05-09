// ==============================================================
// ID Generators
// --------------------------------------------------------------
// Human-readable IDs in the format: PREFIX-YYYYMMDD-XXXXXX
// where XXXXXX is 6 random uppercase hex chars.
//
//   REQ — Financing Request
//   KMC — Kredit Murabaha Contract
//   PAY — Payment
//   TKT — Support Ticket
//
// All IDs are also enforced unique at the DB layer; if a collision
// ever fires, the controller catches the dup-key error and retries.
// ==============================================================

const crypto = require("crypto");

const datePart = () => {
  const now = new Date();
  return [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
  ].join("");
};

const generateId = (prefix, randomBytes = 3) =>
  `${prefix}-${datePart()}-${crypto.randomBytes(randomBytes).toString("hex").toUpperCase()}`;

module.exports = {
  generateId,
  generateRequestId: () => generateId("REQ"),
  generateContractId: () => generateId("KMC"),
  generatePaymentId: () => generateId("PAY"),
  generateTicketId: () => generateId("TKT", 2), // 4 hex chars for tickets
};
