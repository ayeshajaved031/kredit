// ==============================================================
// Server Entry
// --------------------------------------------------------------
// 1. Load env vars
// 2. Validate required configuration (fail fast on missing keys)
// 3. Connect to MongoDB
// 4. Start HTTP server with informative banner
// 5. Graceful shutdown handlers
// ==============================================================

require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");
const { startScheduler, stopScheduler } = require("./config/scheduler");

const PORT = process.env.PORT || 5000;

// Validate required env vars before booting.
// Cleaner to fail at startup with a clear message than to crash on
// the first request with a cryptic stack trace.
const REQUIRED_ENV = ["MONGODB_URI", "JWT_SECRET"];

const validateEnv = () => {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k] || !process.env[k].trim());
  if (missing.length > 0) {
    console.error("\n❌ [Config] Missing required environment variables:");
    for (const k of missing) console.error(`   - ${k}`);
    console.error("\nSee .env.example for the full list of supported variables.\n");
    process.exit(1);
  }
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.warn(
      "⚠️  [Config] JWT_SECRET is shorter than 32 chars — recommend using a longer secret in production"
    );
  }
};

const printBanner = () => {
  const env = process.env.NODE_ENV || "development";
  const cors = process.env.CORS_ORIGINS || "(not set — all origins allowed)";
  const cron = process.env.ENABLE_REPAYMENT_CRON === "true" ? "enabled" : "disabled";
  const mailMode = process.env.SMTP_HOST ? "SMTP configured" : "console fallback (dev)";

  console.log(`
╭─────────────────────────────────────────────╮
│  Kredit API · ${env.padEnd(28)}  │
├─────────────────────────────────────────────┤
│  Port:           ${String(PORT).padEnd(26)} │
│  CORS origins:   ${cors.slice(0, 26).padEnd(26)} │
│  Repayment cron: ${cron.padEnd(26)} │
│  Email:          ${mailMode.padEnd(26)} │
╰─────────────────────────────────────────────╯
`);
};

const start = async () => {
  validateEnv();
  await connectDB();

  // Optional repayment cron — opt-in via env
  startScheduler();

  const server = app.listen(PORT, () => {
    printBanner();
    console.log(`[Server] Kredit API ready on http://localhost:${PORT}`);
  });

  const shutdown = (signal) => {
    console.log(`[Server] ${signal} received. Shutting down...`);
    stopScheduler();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => {
    console.error("[Server] Unhandled rejection:", reason);
    shutdown("UNHANDLED_REJECTION");
  });
};

start();
