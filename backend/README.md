# Kredit — Backend API

Shariah-compliant SaaS bill financing platform for Pakistani startups.

A B2B platform where Kredit pays vendors (AWS, Salesforce, etc.) the discounted annual amount on behalf of a startup, then collects the payment back over 12 fixed monthly installments at a transparent fixed markup. No interest, no compounding — fully Murabaha-compliant.

---

## Tech Stack

- **Node.js 18+** runtime
- **Express.js** web framework
- **MongoDB Atlas + Mongoose** database
- **bcryptjs** password hashing
- **jsonwebtoken** JWT auth
- **multer** file uploads (vendor invoice PDFs, KYC docs)
- **nodemailer** email notifications
- **helmet, cors, express-rate-limit, morgan** security & ops

---

## Folder Structure

```
backend/
├── src/
│   ├── config/        MongoDB connection
│   ├── controllers/   Request handlers (per module)
│   ├── models/        Mongoose schemas (10 collections)
│   ├── routes/        Express route definitions
│   ├── middlewares/   auth, role, validate, errors, rate-limit
│   ├── validations/   Per-endpoint input rules
│   ├── utils/         Helpers — response, IDs, Murabaha calc
│   ├── app.js         Express app + middleware chain
│   └── server.js      Boot + DB connect
├── uploads/           Local file storage (gitignored, swap for S3)
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

---

## Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env — add MONGODB_URI and JWT_SECRET
npm run dev
```

Visit `http://localhost:5000/api/health` — should return JSON with `success: true`.

---

## Database Schema (10 collections)

| Collection | Purpose |
|---|---|
| `users` | All accounts — startup users + Kredit admins |
| `startups` | Company profiles (NTN/SECP, address, credit limit, KYC) |
| `vendors` | Admin-managed list of SaaS vendors |
| `financingrequests` | Applications submitted by startups |
| `murabahacontracts` | Contracts generated when admin approves a request |
| `repaymentschedules` | One row per monthly installment (12 per contract) |
| `payments` | Every payment attempt (success or failed) |
| `supporttickets` | Customer support cases |
| `notifications` | In-app alerts |
| `auditlogs` | Append-only sensitive-action history |

### Relationships (high-level)

```
User (1) ─── (1) Startup
                 │
                 ├── (many) FinancingRequest ── (1:1) MurabahaContract
                 │                                          │
                 │                                          ├── (12) RepaymentSchedule
                 │                                          │              │
                 │                                          │              └── (1) Payment
                 │
                 ├── (many) SupportTicket
                 └── (many) Notification

User (admin) ─── (many) AuditLog (actorId)
```

---

## Murabaha Calculator

The core financial logic lives in `utils/murabaha.js`. Given a principal:

```js
const { calculateMurabaha } = require("./utils/murabaha");

calculateMurabaha({ principal: 850000, markupPercent: 10 });
// → {
//     principal: 850000,
//     markupPercent: 10,
//     markupAmount: 85000,
//     totalPayable: 935000,
//     monthlyInstallment: 77917,
//     installmentCount: 12,
//     schedule: [ { installmentNumber: 1, amountDue: 77917, dueDate: ... }, ... ]
//   }
```

Rounding rule: monthly installment is rounded up; the final installment absorbs the rounding adjustment so the schedule sum equals `totalPayable` exactly.

---

## API Endpoints (live + planned)

### Live now

**Health**
- `GET /api/health` — public health check

**Auth** (all under `/api/auth`)
- `POST /register` — register a new startup user
- `POST /login` — verify credentials, return JWT
- `POST /logout` — client-side discards token
- `GET /me` — current user + startup profile
- `POST /verify-email/:token` — confirm email
- `POST /forgot-password` — request reset link
- `POST /reset-password/:token` — set new password
- `PUT /change-password` — change password while logged in

**Startup** (all under `/api/startup`, role=startup)
- `GET /me` — get own startup profile
- `PUT /me` — update editable fields
- `GET /me/kyc-status` — quick status check
- `POST /me/kyc-documents` — multipart upload of KYC docs

**Vendors** (under `/api/vendors`)
- `GET /` — public list of active vendors (with `?category=` filter)
- `GET /all` — admin: includes inactive (paginated)
- `GET /:id` — admin: single vendor
- `POST /` — admin: create
- `PUT /:id` — admin: update
- `DELETE /:id` — admin: soft-deactivate

**Financing Requests** (under `/api/financing-requests`)
- `POST /` — startup: submit request (multipart, vendor invoice PDF)
- `GET /` — list (own for startup, all for admin); `?status=` filter
- `GET /admin/queue` — admin: pending requests, FIFO
- `GET /:id` — view one (ownership-enforced)
- `DELETE /:id` — startup: withdraw own pending request

**Contracts** (under `/api/contracts`)
- `GET /` — list (own for startup, all for admin); `?status=` filter
- `GET /:id` — view one (ownership-enforced)
- `GET /:id/schedule` — 12-row repayment schedule + summary counts
- `GET /:id/document` — download terms as `.txt` (with signing metadata if signed)
- `POST /:id/sign` — **the big one**: startup signs → password verify → signature hash → atomic schedule generation + credit reservation → vendor payment → activated. Failure on vendor payment rolls everything back.

**Payments** (under `/api/payments`)
- `GET /` — list (own for startup, all for admin); `?status=`, `?contractId=`, `?startupId=` (admin) filters
- `GET /:id` — single payment with linked contract + installment
- `GET /:id/receipt` — downloadable plain-text receipt (successful payments only)
- `POST /pay/:scheduleId` — startup manually pays an installment

**Notifications** (under `/api/notifications`)
- `GET /` — paginated list; `?unreadOnly=true`, `?type=` filters; returns unread count alongside
- `GET /unread-count` — single number for the bell-icon badge
- `PATCH /:id/read` — mark one as read
- `PATCH /read-all` — mark all unread as read (returns count modified)
- `DELETE /:id` — delete a notification

**Support Tickets** (under `/api/tickets`)
- `POST /` — startup opens a ticket (multipart, optional attachment)
- `GET /` — list (own for startup, all for admin); `?status=`, `?category=`, `?priority=` filters
- `GET /:id` — view one with full reply thread (ownership-checked)
- `POST /:id/replies` — startup or admin posts a reply (multipart, optional attachment); auto-reopens resolved tickets when startup replies; auto-bumps to `in_progress` and self-assigns when admin first replies
- `PATCH /:id/status` — admin: change ticket status; emails requester on `resolved`
- `PATCH /:id/assign` — admin: assign to admin user (or `null` to unassign)

**Admin** (under `/api/admin`, role=admin)
- `GET /dashboard/summary` — counts for dashboard widgets
- `GET /startups` / `GET /startups/:id` — review startup list / details
- `POST /startups/:id/kyc/approve` / `kyc/reject` — KYC actions
- `PUT /startups/:id/credit-limit` — adjust credit limit
- `POST /financing-requests/:id/approve` — generate Murabaha contract
- `POST /financing-requests/:id/reject` — reject with reason
- `GET /users` / `POST /users/:id/block` / `POST /users/:id/unblock`
- `GET /audit-logs`
- `POST /repayments/run-daily-cycle` — manually trigger the daily reminder + auto-charge cycle (also runs on cron if `ENABLE_REPAYMENT_CRON=true`)

**Admin Reports** (under `/api/admin/reports`, role=admin, all read-only)
- `GET /portfolio-overview` — single dashboard snapshot: contracts by status, money deployed/collected/outstanding, KYC funnel, default rate
- `GET /monthly-disbursement?months=12` — gap-filled time series of vendor payouts + startup collections per month (powers the dashboard chart)
- `GET /repayment-performance` — on-time/late/default percentages, average days late, current overdue stats
- `GET /top-vendors?limit=10` — vendors ranked by total financed volume with per-vendor contract status counts
- `GET /audit-summary?days=30` — compliance view of admin action counts + top actors by activity

### Planned

- `/api/contracts` — view, sign, download PDF (Phase 5)
- `/api/payments` — initiate, history, receipts, automatic monthly run (Phase 6)
- `/api/tickets` — open, reply, list mine (Phase 8)
- `/api/notifications` — list, mark-read (Phase 7)

---

## Seed Script

After connecting to MongoDB, run:

```bash
npm run seed
```

This creates:
- 1 admin user (`admin@kredit.pk` / `Admin#Kredit2025!` by default)
- 15 real-world SaaS vendors (AWS, Azure, GCP, Salesforce, HubSpot, Slack, Notion, Figma, Zoom, GitHub, Vercel, MongoDB Atlas, Mixpanel, Twilio, Linear)

**Change the admin password immediately after first login.** Override defaults via `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` env vars.

---

## Postman

Import `postman/kredit-api.postman_collection.json`. Auto-saves `{{token}}` after register/login. After running `GET /vendors`, `{{vendorId}}` is also auto-saved so the financing-request submission works.

---

## Security

- bcrypt for password hashing (`select: false` on the hash field)
- JWT with secret in env vars; verified fresh on every request
- Helmet for security headers
- CORS strictly limited to listed frontend origins
- Rate limiting on auth (10/15min) and sensitive routes (30/min)
- Centralized error handler — no stack traces to clients in prod
- ObjectId validation middleware before any `findById`
- Audit log for every admin action affecting money or accounts

---

## Build Status

| Phase | Module | Status |
|---|---|---|
| 1 | Schema design + scaffold | ✅ Done |
| 2 | Auth + Startup KYC | ✅ Done |
| 3 | Vendors + Financing Request submission + seed | ✅ Done |
| 4 | Admin: KYC review, request approval, contract generation, user mgmt | ✅ Done |
| 5 | Contract signing + simulated vendor payment + schedule activation | ✅ Done |
| 6 | Manual + auto repayment, late fees, defaults, completion, daily cron | ✅ Done |
| 7 | Notifications API + Support tickets | ✅ Done |
| 8 | Admin reports + analytics endpoints | ✅ Done — **Backend complete** |
| 9 | Frontend (React + Vite + Tailwind) | Next |
| 10 | Deployment (Render + MongoDB Atlas + Vercel) | — |

---

## License

Educational project — FAST University Islamabad.
