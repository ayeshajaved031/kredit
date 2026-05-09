// ==============================================================
// Health Route — proves the deployed API is alive and DB is up.
// ==============================================================

const express = require("express");
const mongoose = require("mongoose");
const { ok } = require("../utils/response");

const router = express.Router();

router.get("/", (_req, res) => {
  const dbStates = ["disconnected", "connected", "connecting", "disconnecting"];
  ok(res, {
    message: "Kredit API is healthy",
    data: {
      service: "kredit-backend",
      uptimeSeconds: Math.round(process.uptime()),
      database: dbStates[mongoose.connection.readyState] || "unknown",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    },
  });
});

module.exports = router;
