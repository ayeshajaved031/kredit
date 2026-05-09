// Wraps async route handlers so thrown/rejected errors flow to
// the central error middleware. Saves boilerplate try/catch.
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
