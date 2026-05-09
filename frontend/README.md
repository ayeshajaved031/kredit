# Kredit — Frontend

React + Vite + Tailwind UI for Kredit. Dark-only "infrastructure" theme with lime + lavender accents.

## Stack

- **Vite 5** + **React 18**
- **Tailwind CSS v3** (custom design tokens in `tailwind.config.js`)
- **React Router 6**
- **Axios** (with JWT interceptor + 401 auto-redirect)
- **Inter Tight Variable** + **JetBrains Mono Variable** (loaded via `@fontsource`)
- **lucide-react** for icons
- **react-hot-toast** for notifications
- **recharts** for the admin dashboard charts (used in Phase 9c)

No state library — auth lives in `AuthContext`, server state per page.

## Setup

```bash
cd frontend
npm install
cp .env.example .env       # leave VITE_API_URL empty in dev
npm run dev
```

Visit `http://localhost:5173`. The Vite dev server proxies `/api` → `http://localhost:5000`, so make sure the backend is running too.

## Folder structure

```
frontend/
├── src/
│   ├── components/        Shared primitives (Button, Card, Modal, …)
│   ├── context/           AuthContext (user/startup hydration)
│   ├── layouts/           Page shells (PublicLayout — startup/admin shells in 9b/9c)
│   ├── lib/               api client, formatters
│   ├── pages/             Route pages
│   ├── AppRouter.jsx      Route table
│   ├── main.jsx           Entry
│   └── index.css          Tailwind + base + custom utilities
├── index.html
├── tailwind.config.js
├── vite.config.js
└── package.json
```

## Design tokens

Defined in `tailwind.config.js`. Reference them in JSX as Tailwind classes (`bg-bg`, `text-lime`, `border-divider`).

| Token | Hex | Use |
|---|---|---|
| `bg` | `#0F1115` | Page background |
| `surface` | `#171A21` | Cards, secondary surfaces |
| `divider` | `#2A2F3A` | Borders, dividers |
| `ink` | `#F5F7FA` | Primary text |
| `ink-muted` | `#9BA3AF` | Secondary text |
| `lime` | `#C6FF3B` | Primary CTA, success accents |
| `lavender` | `#B197FC` | Data, milestones, intelligence |
| `danger` | `#B91C1C` | Errors, overdue, destructive |

Numbers/IDs/dates use `font-mono` (JetBrains Mono). Body uses default sans (Inter Tight).

## Component library

All in `src/components/`:

- `Button` — `primary | secondary | lavender | danger | ghost`, `sm | md | lg`, `loading` state
- `Input`, `Textarea`, `Select`, `Label`, `FormField`
- `Card`, `CardHeader`, `CardBody`, `MetricCard` (with `variant="promoted"` for the gradient treatment)
- `Badge`, `StatusBadge` (auto-tones backend status strings)
- `Modal` — real backdrop blur, accessible, body-scroll-lock
- `Spinner`, `LoadingScreen`, `EmptyState`, `Skeleton`
- `Logo` — wordmark + mark, three sizes
- `RouteGuards` — `ProtectedRoute`, `StartupRoute`, `AdminRoute`, `GuestRoute`

## Pages currently shipping (Phase 9a + 9b + 9c)

**Public**
- `/` — Landing
- `/login`, `/register` — auth
- `/verify-email/:token`, `/forgot-password`, `/reset-password/:token`

**Startup (authenticated)**
- `/dashboard` — KYC banner, metric strip, next-payment promoted card, recent activity
- `/vendors` — vendor browser with category filter and search
- `/apply` — apply for financing with live Murabaha calculation preview
- `/requests`, `/requests/:id` — financing requests list + detail
- `/contracts`, `/contracts/:id`, `/contracts/:id/schedule` — contracts + signing modal + schedule
- `/payments`, `/payments/:id`, `/payments/pay/:scheduleId` — history, receipt, manual pay
- `/notifications` — list with mark-read, mark-all-read
- `/tickets`, `/tickets/new`, `/tickets/:id` — support tickets
- `/profile` — KYC documents + company details + change password

**Admin (authenticated)**
- `/admin` — Dashboard with portfolio overview, monthly disbursement chart (Recharts), action queues
- `/admin/kyc` — KYC review queue with approve (set credit limit) / reject (with reason) modals
- `/admin/requests` — Financing request queue with approve (generates contract) / reject modals
- `/admin/contracts` — All contracts on the platform (read-only)
- `/admin/vendors` — Vendors CRUD with add/edit/deactivate
- `/admin/users` — User directory with block/unblock
- `/admin/startups` — Startup directory (read-only)
- `/admin/tickets`, `/admin/tickets/:id` — Support tickets queue + detail with status/assign actions
- `/admin/audit` — Append-only audit log viewer with filters
- `/admin/reports` — Repayment performance, top vendors, audit summary
- `/admin/notifications` — same component as startup notifications

## What's next

- **Phase 10** — Deployment (Vercel + Render + MongoDB Atlas)
