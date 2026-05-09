// ==============================================================
// Express App
// --------------------------------------------------------------
// Builds the app, registers global middleware, mounts routes.
// Kept separate from server.js so the app can be imported for
// testing without binding a port.
//
// Middleware order (top-to-bottom):
//   1. trust proxy        — for correct client IP on Render/Vercel
//   2. helmet             — security headers
//   3. cors               — origin policy
//   4. body parsers       — JSON + urlencoded
//   5. morgan             — request logging
//   6. routes
//   7. notFound           — 404 for unknown paths
//   8. errorHandler       — final error formatter (LAST)
// ==============================================================

const express = require("express");
const path = require("path");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");

const errorHandler = require("./middlewares/errorHandler");
const notFound = require("./middlewares/notFound");

const healthRoutes = require("./routes/health.routes");
const authRoutes = require("./routes/auth.routes");
const startupRoutes = require("./routes/startup.routes");
const vendorRoutes = require("./routes/vendor.routes");
const financingRequestRoutes = require("./routes/financingRequest.routes");
const contractRoutes = require("./routes/contract.routes");
const paymentRoutes = require("./routes/payment.routes");
const notificationRoutes = require("./routes/notification.routes");
const ticketRoutes = require("./routes/ticket.routes");
const adminRoutes = require("./routes/admin.routes");

const app = express();

app.set("trust proxy", 1);
app.use(helmet());

// CORS — allow only listed frontend origins (and no-origin tools
// like Postman / curl).
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

if (process.env.NODE_ENV !== "test") {
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
}

// Serve uploaded files (vendor invoices, KYC docs) under /uploads
// in development. In production this should point to S3/Cloudinary.
const uploadDir = process.env.UPLOAD_DIR || "./uploads";
app.use("/uploads", express.static(path.resolve(uploadDir)));

// ---------- ROUTES ----------
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/startup", startupRoutes);
app.use("/api/vendors", vendorRoutes);
app.use("/api/financing-requests", financingRequestRoutes);
app.use("/api/contracts", contractRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/admin", adminRoutes);

// ---------- ERROR HANDLING (must be LAST) ----------
app.use(notFound);
app.use(errorHandler);

module.exports = app;
