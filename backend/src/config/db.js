// ==============================================================
// MongoDB Connection
// --------------------------------------------------------------
// Connects to MongoDB Atlas using MONGODB_URI from .env.
// Called once at server startup from server.js.
// ==============================================================

const mongoose = require("mongoose");

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error("[DB] MONGODB_URI is not defined.");
    process.exit(1);
  }

  try {
    mongoose.set("strictQuery", true);
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`[DB] Connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (err) {
    console.error(`[DB] Connection failed: ${err.message}`);
    process.exit(1);
  }

  mongoose.connection.on("disconnected", () => {
    console.warn("[DB] Disconnected from MongoDB.");
  });
};

module.exports = connectDB;
