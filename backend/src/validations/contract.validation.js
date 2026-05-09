// ==============================================================
// Contract Validations
// --------------------------------------------------------------
// signContract — used by POST /api/contracts/:id/sign
//
// We require BOTH a typed name (matches user.fullName) AND
// password re-entry. The typed name is shown back to the user
// so they explicitly confirm "this is my legal acceptance"
// (similar to most online loan platforms).
// ==============================================================

const signContract = (data) => {
  const errors = {};

  if (!data.password || typeof data.password !== "string") {
    errors.password = "Password confirmation is required to sign";
  }

  if (!data.typedName || typeof data.typedName !== "string" || !data.typedName.trim()) {
    errors.typedName = "Type your full name to confirm acceptance";
  } else if (data.typedName.length > 80) {
    errors.typedName = "Name is too long";
  }

  if (data.acceptedTerms !== true) {
    errors.acceptedTerms = "You must accept the contract terms to proceed";
  }

  return Object.keys(errors).length ? errors : null;
};

module.exports = { signContract };
