// ==============================================================
// File Upload Middleware (multer)
// --------------------------------------------------------------
// Handles multipart/form-data uploads for:
//   - KYC documents (NTN cert, SECP cert, bank statement)
//   - Vendor invoice PDFs
//   - Support ticket attachments (screenshots)
//
// Storage: local disk in dev (./uploads/<subfolder>/<uuid>.<ext>).
// Production: swap to multer-s3 or upload-then-cloudinary in a
// follow-up middleware. The controllers only read req.file.path,
// so swapping storage is a one-file change.
//
// Security:
//   - File size limit (env MAX_UPLOAD_SIZE_MB, default 10MB)
//   - MIME-type allow-list per upload kind (no .exe etc.)
//   - Filename randomized — never trust user-supplied filenames
// ==============================================================

const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const AppError = require("../utils/AppError");

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "./uploads");
const MAX_SIZE_BYTES =
  (Number(process.env.MAX_UPLOAD_SIZE_MB) || 10) * 1024 * 1024;

// Ensure upload directory exists at boot
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Factory: produces a multer instance scoped to a subfolder + MIME allow-list.
const buildUploader = ({ subfolder, allowedMimes }) => {
  const targetDir = path.join(UPLOAD_DIR, subfolder);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, targetDir),
    filename: (_req, file, cb) => {
      // Random 16-char hex + original extension. Never expose the
      // user's filename on disk — it could contain path traversal
      // attempts or sensitive info.
      const random = crypto.randomBytes(8).toString("hex");
      const ext = path.extname(file.originalname).toLowerCase().slice(0, 8);
      cb(null, `${Date.now()}-${random}${ext}`);
    },
  });

  const fileFilter = (_req, file, cb) => {
    if (!allowedMimes.includes(file.mimetype)) {
      return cb(
        new AppError(
          `Invalid file type. Allowed: ${allowedMimes.join(", ")}`,
          400
        )
      );
    }
    cb(null, true);
  };

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: MAX_SIZE_BYTES },
  });
};

// Predefined uploaders for each use case
const kycUploader = buildUploader({
  subfolder: "kyc",
  allowedMimes: ["application/pdf", "image/png", "image/jpeg", "image/jpg"],
});

const vendorInvoiceUploader = buildUploader({
  subfolder: "vendor-invoices",
  allowedMimes: ["application/pdf"], // invoices are always PDF
});

const ticketAttachmentUploader = buildUploader({
  subfolder: "tickets",
  allowedMimes: [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "application/pdf",
  ],
});

// Helper: build a public URL from a stored file path so controllers
// can persist a URL string in MongoDB rather than an absolute path.
const publicUrlFor = (req, filePath) => {
  if (!filePath) return "";
  // Strip the absolute upload-dir prefix; serve via /uploads/* (see app.js)
  const relative = path.relative(UPLOAD_DIR, filePath).replace(/\\/g, "/");
  return `${req.protocol}://${req.get("host")}/uploads/${relative}`;
};

module.exports = {
  kycUploader,
  vendorInvoiceUploader,
  ticketAttachmentUploader,
  publicUrlFor,
};
