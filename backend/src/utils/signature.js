// ==============================================================
// Digital Signature Helper
// --------------------------------------------------------------
// Builds a deterministic hash that proves a specific user signed
// a specific contract at a specific moment. Used as the legal
// "I accept" record on Murabaha contracts.
//
// Hash inputs (all required, in order):
//   contractId | userId | signedAt (ISO) | termsHash | JWT_SECRET
//
// termsHash is sha256 of the contract's stored T&C text — so if
// the terms were tampered with after signing, the signature
// hash would no longer verify.
//
// This is NOT a cryptographic signature in the legal sense (no
// PKI/private keys). It's an audit trail that, combined with
// password re-entry at signing time + IP logging + timestamp,
// satisfies the "electronic acceptance" standard under Pakistan's
// Electronic Transactions Ordinance, 2002. For a regulated
// product we'd add real PKI signing on top — out of scope here.
// ==============================================================

const crypto = require("crypto");

const sha256 = (str) =>
  crypto.createHash("sha256").update(String(str)).digest("hex");

/**
 * Compute the signature hash for a contract acceptance event.
 *
 * @param {Object} args
 * @param {string} args.contractId
 * @param {string} args.userId
 * @param {Date|string} args.signedAt
 * @param {string} args.termsAndConditions
 * @returns {string} hex-encoded sha256
 */
const computeSignatureHash = ({ contractId, userId, signedAt, termsAndConditions }) => {
  const secret = process.env.JWT_SECRET || "";
  if (!secret) {
    throw new Error("JWT_SECRET not configured — cannot sign contracts");
  }
  const termsHash = sha256(termsAndConditions);
  const ts = signedAt instanceof Date ? signedAt.toISOString() : String(signedAt);
  return sha256([contractId, userId, ts, termsHash, secret].join("|"));
};

/**
 * Verify a stored signature hash against the current contract
 * state. Returns true if everything matches.
 */
const verifySignatureHash = (contract, providedHash) => {
  if (!contract.signedAt || !contract.signatureHash) return false;
  const expected = computeSignatureHash({
    contractId: contract.contractId,
    userId: String(contract.startupId), // we use startup user proxy; could also store userId
    signedAt: contract.signedAt,
    termsAndConditions: contract.termsAndConditions,
  });
  return expected === providedHash;
};

module.exports = { computeSignatureHash, verifySignatureHash, sha256 };
