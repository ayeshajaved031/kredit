// ==============================================================
// Seed Script
// --------------------------------------------------------------
// Run once after deploying or on a fresh local DB:
//   npm run seed
//
// Creates:
//   1. A default admin user (email + password from env or defaults)
//   2. A catalog of real-world SaaS vendors that startups commonly
//      finance through Kredit.
//
// Idempotent: re-running won't duplicate anything. Existing
// records are left untouched.
//
// Environment variables (optional):
//   SEED_ADMIN_EMAIL    — admin email (default: admin@kredit.pk)
//   SEED_ADMIN_PASSWORD — admin password (default: see below)
//   SEED_ADMIN_NAME     — admin display name
//
// SECURITY NOTE: Change the admin password immediately after
// first login in production. The default is a known string and
// must NEVER be left in a public deployment.
// ==============================================================

require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const connectDB = require("../config/db");
const User = require("../models/User");
const Vendor = require("../models/Vendor");

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@kredit.pk";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "Admin#Kredit2025!";
const ADMIN_NAME = process.env.SEED_ADMIN_NAME || "Kredit Admin";

const VENDORS = [
  {
    name: "Amazon Web Services",
    category: "cloud_infrastructure",
    description:
      "Cloud computing platform — compute, storage, databases, AI/ML services. Annual Reserved Instances and Savings Plans offer significant discounts vs On-Demand pricing.",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/9/93/Amazon_Web_Services_Logo.svg",
    websiteUrl: "https://aws.amazon.com",
    typicalAnnualDiscountPercent: 30,
  },
  {
    name: "Microsoft Azure",
    category: "cloud_infrastructure",
    description:
      "Microsoft's cloud platform with strong enterprise integration. Annual reservations save 30-72% vs pay-as-you-go.",
    websiteUrl: "https://azure.microsoft.com",
    typicalAnnualDiscountPercent: 30,
  },
  {
    name: "Google Cloud Platform",
    category: "cloud_infrastructure",
    description:
      "Google's cloud offering — strong in data analytics and ML. Committed Use Discounts give 20-57% off list pricing.",
    websiteUrl: "https://cloud.google.com",
    typicalAnnualDiscountPercent: 25,
  },
  {
    name: "Salesforce",
    category: "crm",
    description:
      "World's leading CRM platform. Annual contracts standard; multi-year and pre-pay discounts available.",
    websiteUrl: "https://www.salesforce.com",
    typicalAnnualDiscountPercent: 15,
  },
  {
    name: "HubSpot",
    category: "crm",
    description:
      "Inbound marketing, sales, and service platform. Annual billing typically saves ~10% vs monthly.",
    websiteUrl: "https://www.hubspot.com",
    typicalAnnualDiscountPercent: 10,
  },
  {
    name: "Slack",
    category: "communication",
    description:
      "Team messaging and collaboration. Annual plans save ~15% vs monthly across Pro and Business+ tiers.",
    websiteUrl: "https://slack.com",
    typicalAnnualDiscountPercent: 15,
  },
  {
    name: "Notion",
    category: "productivity",
    description:
      "All-in-one workspace for notes, docs, wikis, and project management. Annual billing saves ~20%.",
    websiteUrl: "https://www.notion.so",
    typicalAnnualDiscountPercent: 20,
  },
  {
    name: "Linear",
    category: "productivity",
    description:
      "Modern issue tracking and project management for software teams. Annual saves ~17%.",
    websiteUrl: "https://linear.app",
    typicalAnnualDiscountPercent: 17,
  },
  {
    name: "Figma",
    category: "design",
    description:
      "Collaborative interface design tool. Annual plans save ~25% on Professional and Organization tiers.",
    websiteUrl: "https://www.figma.com",
    typicalAnnualDiscountPercent: 25,
  },
  {
    name: "Zoom",
    category: "communication",
    description:
      "Video conferencing platform. Annual Pro/Business plans save ~17% over monthly billing.",
    websiteUrl: "https://zoom.us",
    typicalAnnualDiscountPercent: 17,
  },
  {
    name: "GitHub",
    category: "developer_tools",
    description:
      "Code hosting and collaboration platform. GitHub Team and Enterprise annual billing reduces per-seat cost.",
    websiteUrl: "https://github.com",
    typicalAnnualDiscountPercent: 17,
  },
  {
    name: "Vercel",
    category: "developer_tools",
    description:
      "Frontend cloud platform for React, Next.js, and similar frameworks. Pro and Enterprise plans available annually.",
    websiteUrl: "https://vercel.com",
    typicalAnnualDiscountPercent: 17,
  },
  {
    name: "MongoDB Atlas",
    category: "developer_tools",
    description:
      "Managed MongoDB database service. Pre-paid Atlas credits offer up to 20% discount.",
    websiteUrl: "https://www.mongodb.com/atlas",
    typicalAnnualDiscountPercent: 20,
  },
  {
    name: "Mixpanel",
    category: "analytics",
    description:
      "Product analytics platform for understanding user behavior. Annual billing on Growth and Enterprise plans saves ~15%.",
    websiteUrl: "https://mixpanel.com",
    typicalAnnualDiscountPercent: 15,
  },
  {
    name: "Twilio",
    category: "communication",
    description:
      "Programmable communications platform — SMS, voice, video APIs. Volume discounts available with annual commitment.",
    websiteUrl: "https://www.twilio.com",
    typicalAnnualDiscountPercent: 15,
  },
];

const seed = async () => {
  await connectDB();

  console.log("\n[Seed] Starting...\n");

  // ---------- Admin user ----------
  let admin = await User.findOne({ email: ADMIN_EMAIL });
  if (admin) {
    console.log(`[Seed] Admin already exists: ${admin.email} (skipping)`);
  } else {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    admin = await User.create({
      fullName: ADMIN_NAME,
      email: ADMIN_EMAIL,
      passwordHash,
      role: "admin",
      status: "active",
      emailVerified: true,
    });
    console.log(`[Seed] Created admin: ${admin.email}`);
    console.log(`[Seed] Password: ${ADMIN_PASSWORD}`);
    console.log(`[Seed] CHANGE THIS PASSWORD AFTER FIRST LOGIN.\n`);
  }

  // ---------- Vendors ----------
  let createdCount = 0;
  let skippedCount = 0;

  for (const v of VENDORS) {
    const existing = await Vendor.findOne({ name: v.name });
    if (existing) {
      skippedCount++;
      continue;
    }
    await Vendor.create({ ...v, addedBy: admin._id });
    createdCount++;
  }

  console.log(`[Seed] Vendors: ${createdCount} created, ${skippedCount} already existed\n`);
  console.log("[Seed] Done.\n");

  await mongoose.disconnect();
  process.exit(0);
};

seed().catch((err) => {
  console.error("[Seed] Failed:", err);
  process.exit(1);
});
