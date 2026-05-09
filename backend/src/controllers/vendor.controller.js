// ==============================================================
// Vendor Controller
// --------------------------------------------------------------
// Public endpoints:
//   listActive   — startups need this to populate their request form
//
// Admin endpoints:
//   listAll      — admin dashboard, includes inactive
//   getById      — view one vendor (admin)
//   create       — add a new vendor
//   update       — edit existing vendor
//   deactivate   — soft-disable (we never hard-delete; old requests
//                  reference vendor history via vendorNameSnapshot)
// ==============================================================

const Vendor = require("../models/Vendor");
const AuditLog = require("../models/AuditLog");

const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const { ok } = require("../utils/response");

// Best-effort audit. Never blocks the response.
const audit = async ({ actorId, action, targetId, details, req }) => {
  try {
    await AuditLog.create({
      actorId,
      actorRole: "admin",
      action,
      targetType: "vendor",
      targetId: String(targetId),
      details: details || {},
      ipAddress: req?.ip || "",
      userAgent: req?.headers?.["user-agent"] || "",
    });
  } catch (err) {
    console.error("[AuditLog] Failed:", err.message);
  }
};

// Whitelist of fields the client may set when creating/updating.
// Anything else is silently dropped — protects against future
// schema additions becoming accidentally writable.
const WRITABLE_CREATE = [
  "name",
  "category",
  "description",
  "logoUrl",
  "websiteUrl",
  "typicalAnnualDiscountPercent",
];
const WRITABLE_UPDATE = [...WRITABLE_CREATE, "isActive"];

// ==============================================================
// GET /api/vendors  (public — no auth)
// --------------------------------------------------------------
// Returns active vendors for the request-submission form.
// Supports ?category=... filter.
// ==============================================================
const listActive = asyncHandler(async (req, res) => {
  const filter = { isActive: true };
  if (req.query.category) {
    filter.category = req.query.category;
  }

  const vendors = await Vendor.find(filter)
    .select("name slug category description logoUrl websiteUrl typicalAnnualDiscountPercent")
    .sort({ name: 1 })
    .lean();

  return ok(res, {
    message: "Active vendors",
    data: { vendors, count: vendors.length },
  });
});

// ==============================================================
// GET /api/vendors/all  (admin)
// --------------------------------------------------------------
// All vendors including inactive. Paginated with simple
// limit/skip — for a finance platform with maybe 50-200 vendors
// total, full pagination libs are overkill.
// ==============================================================
const listAll = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const skip = Math.max(Number(req.query.skip) || 0, 0);

  const filter = {};
  if (req.query.category) filter.category = req.query.category;
  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === "true";
  }

  const [vendors, total] = await Promise.all([
    Vendor.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Vendor.countDocuments(filter),
  ]);

  return ok(res, {
    message: "Vendors",
    data: { vendors, count: vendors.length, total, limit, skip },
  });
});

// ==============================================================
// GET /api/vendors/:id  (admin)
// ==============================================================
const getById = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findById(req.params.id);
  if (!vendor) throw new AppError("Vendor not found", 404);
  return ok(res, { data: { vendor } });
});

// ==============================================================
// POST /api/vendors  (admin)
// ==============================================================
const create = asyncHandler(async (req, res) => {
  const payload = pick(req.body, WRITABLE_CREATE);
  payload.addedBy = req.user._id;

  // Pre-flight uniqueness check for clearer error than the index hit
  const existing = await Vendor.findOne({ name: payload.name }).lean();
  if (existing) {
    throw new AppError("A vendor with this name already exists", 409);
  }

  const vendor = await Vendor.create(payload);

  await audit({
    actorId: req.user._id,
    action: "ADD_VENDOR",
    targetId: vendor._id,
    details: { name: vendor.name, category: vendor.category },
    req,
  });

  return ok(res, {
    status: 201,
    message: "Vendor created",
    data: { vendor },
  });
});

// ==============================================================
// PUT /api/vendors/:id  (admin)
// ==============================================================
const update = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findById(req.params.id);
  if (!vendor) throw new AppError("Vendor not found", 404);

  const updates = pick(req.body, WRITABLE_UPDATE);

  // If name changes, check uniqueness against OTHER vendors
  if (updates.name && updates.name !== vendor.name) {
    const conflict = await Vendor.findOne({
      name: updates.name,
      _id: { $ne: vendor._id },
    }).lean();
    if (conflict) {
      throw new AppError("Another vendor with this name already exists", 409);
    }
  }

  Object.assign(vendor, updates);
  await vendor.save();

  await audit({
    actorId: req.user._id,
    action: "UPDATE_VENDOR",
    targetId: vendor._id,
    details: { changedFields: Object.keys(updates) },
    req,
  });

  return ok(res, { message: "Vendor updated", data: { vendor } });
});

// ==============================================================
// DELETE /api/vendors/:id  (admin)
// --------------------------------------------------------------
// Soft delete: sets isActive=false. Hard deletion would orphan
// historical financing requests pointing at the vendor.
// ==============================================================
const deactivate = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findById(req.params.id);
  if (!vendor) throw new AppError("Vendor not found", 404);

  if (!vendor.isActive) {
    return ok(res, {
      message: "Vendor is already inactive",
      data: { vendor },
    });
  }

  vendor.isActive = false;
  await vendor.save();

  await audit({
    actorId: req.user._id,
    action: "DEACTIVATE_VENDOR",
    targetId: vendor._id,
    details: { name: vendor.name },
    req,
  });

  return ok(res, { message: "Vendor deactivated", data: { vendor } });
});

// ---------- helper ----------
function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

module.exports = {
  listActive,
  listAll,
  getById,
  create,
  update,
  deactivate,
};
