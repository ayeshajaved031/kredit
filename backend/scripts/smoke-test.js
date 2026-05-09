// ==============================================================
// Pre-deploy smoke test
// --------------------------------------------------------------
// Runs the backend locally with PRODUCTION-like env vars and
// hits a few key endpoints. Run before pushing to main:
//
//   cd backend && node scripts/smoke-test.js
//
// You'll need a local MongoDB or an Atlas connection string in
// MONGODB_URI. Everything else is set inside this script.
//
// What it checks:
//   - Required env validation works
//   - Server boots in production mode
//   - /api/health responds
//   - /api/vendors (public) returns the vendor list
//   - 404 on unknown route returns clean JSON
//   - CORS preflight succeeds
// ==============================================================

const path = require("path");
const { spawn } = require("child_process");
const http = require("http");

const SERVER_PORT = 5099; // unique port to avoid clashing with `npm run dev`

const API = `http://localhost:${SERVER_PORT}/api`;

const fetch = (url, opts = {}) =>
  new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: opts.method || "GET",
        headers: opts.headers || {},
      },
      (res) => {
        let chunks = "";
        res.on("data", (c) => (chunks += c));
        res.on("end", () => {
          let parsed = chunks;
          try { parsed = JSON.parse(chunks); } catch {}
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      }
    );
    req.on("error", reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PASS = "✅";
const FAIL = "❌";
let failures = 0;
const check = (cond, label) => {
  if (cond) console.log(`  ${PASS} ${label}`);
  else { console.log(`  ${FAIL} ${label}`); failures++; }
};

(async () => {
  console.log("\n🧪 Kredit pre-deploy smoke test\n");

  // 1) Verify env validation kicks in when MONGODB_URI is missing
  console.log("📍 Env validation");
  await new Promise((resolve) => {
    const child = spawn("node", ["src/server.js"], {
      cwd: path.join(__dirname, ".."),
      env: { ...process.env, MONGODB_URI: "", JWT_SECRET: "" },
    });
    let out = "";
    child.stderr.on("data", (d) => (out += d.toString()));
    child.stdout.on("data", (d) => (out += d.toString()));
    child.on("exit", (code) => {
      check(code === 1, "exits with code 1 when env vars missing");
      check(out.includes("MONGODB_URI"), "error message names MONGODB_URI");
      check(out.includes("JWT_SECRET"), "error message names JWT_SECRET");
      resolve();
    });
  });

  // 2) Boot with valid env
  console.log("\n📍 Booting server in production mode");
  if (!process.env.MONGODB_URI) {
    console.log(`  ${FAIL} MONGODB_URI not set in your shell — set it and re-run`);
    process.exit(1);
  }

  const server = spawn("node", ["src/server.js"], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(SERVER_PORT),
      JWT_SECRET: "smoke-test-secret-long-enough-to-pass-validation-checks",
      JWT_EXPIRES_IN: "1h",
      CORS_ORIGINS: "https://example.com",
      FRONTEND_URL: "https://example.com",
      PAYMENT_GATEWAY_MODE: "simulated",
      ENABLE_REPAYMENT_CRON: "false",
      MURABAHA_MARKUP_PERCENT: "10",
      MURABAHA_INSTALLMENTS: "12",
      DEFAULT_CREDIT_LIMIT_PKR: "2000000",
      MAX_UPLOAD_SIZE_MB: "10",
      UPLOAD_DIR: "./uploads",
      DEFAULT_AFTER_FAILED_INSTALLMENTS: "3",
    },
  });

  let serverReady = false;
  server.stdout.on("data", (d) => {
    const s = d.toString();
    if (s.includes("Kredit API ready")) serverReady = true;
  });
  server.stderr.on("data", (d) => process.stderr.write(d));

  // Wait up to 8s for ready
  for (let i = 0; i < 40 && !serverReady; i++) await sleep(200);
  if (!serverReady) {
    console.log(`  ${FAIL} server didn't reach ready state within 8s`);
    server.kill();
    process.exit(1);
  }
  console.log(`  ${PASS} server reached ready state`);

  try {
    // 3) /health
    console.log("\n📍 Health endpoint");
    const h = await fetch(`${API}/health`);
    check(h.status === 200, "GET /api/health → 200");
    check(h.body?.success === true, "response envelope has success:true");

    // 4) /vendors
    console.log("\n📍 Public vendors endpoint");
    const v = await fetch(`${API}/vendors`);
    check(v.status === 200, "GET /api/vendors → 200");
    check(Array.isArray(v.body?.data?.vendors), "returns vendors array");
    if (Array.isArray(v.body?.data?.vendors)) {
      console.log(`     (found ${v.body.data.vendors.length} vendor${v.body.data.vendors.length === 1 ? "" : "s"} — run \`npm run seed\` if zero)`);
    }

    // 5) 404
    console.log("\n📍 404 handler");
    const notFound = await fetch(`${API}/this-route-does-not-exist`);
    check(notFound.status === 404, "unknown route → 404");
    check(notFound.body?.success === false, "404 response is JSON envelope");

    // 6) CORS preflight
    console.log("\n📍 CORS preflight");
    const preflight = await fetch(`${API}/auth/login`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://example.com",
        "Access-Control-Request-Method": "POST",
      },
    });
    check(preflight.status === 204 || preflight.status === 200, "OPTIONS preflight succeeds");
    check(
      preflight.headers["access-control-allow-origin"] === "https://example.com",
      "CORS allow-origin header matches request origin"
    );

    // 7) Auth required on protected route
    console.log("\n📍 Auth enforcement");
    const protectedRoute = await fetch(`${API}/auth/me`);
    check(protectedRoute.status === 401, "GET /api/auth/me without token → 401");

    console.log(
      failures === 0
        ? "\n🎉 All smoke checks passed — safe to deploy.\n"
        : `\n💥 ${failures} check(s) failed — fix before deploying.\n`
    );
  } finally {
    server.kill();
  }

  process.exit(failures === 0 ? 0 : 1);
})().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
