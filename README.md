# Kredit

Shariah-compliant SaaS bill financing for Pakistani startups. Pay vendors annual rates, repay over 12 monthly installments. Murabaha-based, riba-free.

**Live demo:** _Add your Vercel URL here after deploying_

---

## What this is

A full-stack web application that lets Pakistani startups finance their B2B SaaS subscriptions (AWS, Salesforce, etc.) at annual prices while paying back over 12 fixed monthly installments. The financing model is Murabaha — a Shariah-compliant cost-plus arrangement where the markup is disclosed and fixed at signing, with no interest, no compounding, and late fees that go to charity.

Built as a semester project for FAST University's BS FinTech program.

## Architecture

```
┌────────────────────────┐         ┌─────────────────────────┐
│  Frontend (Vercel)     │         │  Backend (Render)       │
│  ─────────────────     │  HTTPS  │  ─────────────────      │
│  Vite + React 18       │ ──────▶ │  Node + Express         │
│  Tailwind, Recharts    │  JWT    │  Mongoose, Multer       │
│  React Router          │         │  JWT auth, role guards  │
└────────────────────────┘         └─────────┬───────────────┘
                                             │
                                             ▼
                                   ┌──────────────────────┐
                                   │  MongoDB Atlas (M0)  │
                                   │  ──────────────────  │
                                   │  10 collections      │
                                   └──────────────────────┘

Cron (Render): nightly call to /api/admin/repayments/run-daily-cycle
SMTP: Mailtrap (dev) / SendGrid (production)
```

## Folder structure

```
kredit/
├── backend/             Node + Express + MongoDB API
│   ├── src/
│   │   ├── config/        DB + scheduler
│   │   ├── controllers/   9 controllers
│   │   ├── middlewares/   Auth, role guards, validation, upload, errors
│   │   ├── models/        10 Mongoose schemas
│   │   ├── routes/        REST routes
│   │   ├── utils/         Murabaha calc, contract terms, JWT, mailer, etc.
│   │   ├── validations/   Per-module validators
│   │   ├── app.js         Express app setup
│   │   └── server.js      Entry point
│   ├── postman/           Postman collection for the API
│   ├── scripts/
│   │   └── smoke-test.js  Pre-deploy verification
│   ├── render.yaml        Render Blueprint
│   ├── .env.example
│   └── README.md
│
├── frontend/            Vite + React 18 + Tailwind UI
│   ├── src/
│   │   ├── components/    Button, Card, Modal, etc.
│   │   ├── context/       AuthContext
│   │   ├── layouts/       Public, Startup, Admin shells
│   │   ├── lib/           api client, formatters, useApi hook
│   │   ├── pages/         32 page components
│   │   ├── AppRouter.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── vercel.json        Vercel config (SPA rewrites + security headers)
│   ├── .env.example
│   └── README.md
│
└── DEPLOYMENT.md          Step-by-step deployment guide
```

## Features at a glance

**Startup-side:**
- Sign up, email verification, KYC document upload
- Browse 15 pre-seeded vendors (AWS, Salesforce, etc.) with category filter
- Apply for financing with live Murabaha calculation preview
- Sign contracts via password + typed-name + terms-accepted modal
- View 12-month repayment schedule, pay installments manually or wait for auto-charge
- Download receipts, see notification feed, file support tickets

**Admin-side:**
- Dashboard with portfolio overview + monthly disbursement chart (Recharts)
- KYC review queue, financing request queue, contract list
- Vendor catalog CRUD, user management with block/unblock
- Support ticket queue with status changes + assignment
- Append-only audit log viewer
- 5 aggregation-driven reports

## Quick start (local development)

### Prerequisites
- Node.js 18+
- npm
- MongoDB (local install OR free Atlas cluster)

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USER/kredit.git
cd kredit

# Backend
cd backend
npm install
cp .env.example .env
# Edit .env — fill in MONGODB_URI and JWT_SECRET

# Frontend
cd ../frontend
npm install
cp .env.example .env
# .env can be left as default in dev (Vite proxies /api → :5000)
```

### 2. Seed the database

```bash
cd backend
node src/utils/seed.js
```

This creates the admin account and 15 vendors. Default admin login:
- Email: `admin@kredit.pk`
- Password: `Admin@123!`

**Change the admin password immediately after first login.**

### 3. Run

```bash
# Terminal 1 — backend
cd backend
npm run dev

# Terminal 2 — frontend
cd frontend
npm run dev
```

Visit `http://localhost:5173`.

## Deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for the step-by-step guide. Free-tier deployment on:
- MongoDB Atlas (database)
- Render (backend + cron)
- Vercel (frontend)
- Mailtrap (email sandbox)

Total time for first-time setup: 60–90 minutes.

## API documentation

Import `backend/postman/kredit-api.postman_collection.json` into Postman to explore all 65+ endpoints. The collection auto-saves auth tokens and resource IDs across requests so you can run end-to-end flows.

Or browse the [`backend/README.md`](./backend/README.md) for a flat list of endpoints grouped by module.

## Tech stack

**Backend**
- Node.js, Express
- MongoDB + Mongoose
- JWT auth (bcryptjs for password hashing)
- multer (file uploads), nodemailer (transactional email)
- node-cron (scheduled jobs), helmet + cors + express-rate-limit (security)

**Frontend**
- Vite, React 18
- Tailwind CSS v3 (custom design tokens)
- React Router v6
- Axios with JWT interceptor
- Recharts (admin charts)
- lucide-react (icons), react-hot-toast (notifications)
- @fontsource for Inter Tight + JetBrains Mono variable fonts

## Design system

Dark "infrastructure" theme — single-mode dark UI with lime + lavender accent system.

| Token | Hex | Usage |
|---|---|---|
| `bg` | `#0F1115` | Page background |
| `surface` | `#171A21` | Cards |
| `divider` | `#2A2F3A` | Borders |
| `ink` | `#F5F7FA` | Text |
| `ink-muted` | `#9BA3AF` | Secondary text |
| `lime` | `#C6FF3B` | Primary CTA, success accents |
| `lavender` | `#B197FC` | Data viz, milestones |
| `danger` | `#B91C1C` | Errors, overdue, destructive |

Inter Tight Variable for UI, JetBrains Mono Variable for amounts/IDs/dates.

## License

This is a student project. Not licensed for commercial use.
