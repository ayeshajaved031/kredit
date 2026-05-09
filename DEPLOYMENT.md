# Kredit — Deployment Guide

This guide walks you through getting Kredit live on free-tier infrastructure, end to end. Everything used here is genuinely free for personal/student demo use, no credit card required (except Atlas asks but never charges on M0).

**Stack:**
- **MongoDB Atlas** (free M0 cluster) — database
- **Render** (free tier) — backend API + cron job
- **Vercel** (free tier) — frontend
- **Mailtrap** (free tier) — captures email in a sandbox inbox you can read

**Time required:** 60–90 minutes for a first-time setup. Subsequent redeploys are seconds.

---

## Step 0 — Prerequisites

You'll need:

1. A **GitHub account** with the Kredit repo pushed. The repo should have `backend/` and `frontend/` at the root (the structure we built).
2. A working local setup — backend runs with `npm run dev`, frontend with `npm run dev`. Don't deploy a broken build; fix locally first.
3. Run the smoke test before pushing: `cd backend && node scripts/smoke-test.js` (with `MONGODB_URI` set in your shell).

---

## Step 1 — MongoDB Atlas

The database has to exist first since the API needs it on boot.

1. Go to **https://www.mongodb.com/cloud/atlas/register** and sign up.
2. Create a new project — name it "Kredit".
3. **Build a cluster** → pick **M0 Free**.
   - Provider: AWS
   - Region: pick the one closest to where Render will run (Singapore for Render Singapore, or Mumbai if available).
   - Name: `kredit-prod`
4. Click **Create Cluster**. Provisioning takes 3–5 minutes.
5. While it provisions, click **Database Access** in the left sidebar:
   - **Add New Database User**
   - Authentication method: Password
   - Username: `kredit_app`
   - Password: click **Autogenerate** and **save it somewhere** — you'll paste this into Render
   - Database User Privileges: **Read and write to any database**
   - Click **Add User**
6. Click **Network Access** in the left sidebar:
   - **Add IP Address** → **Allow Access from Anywhere** (`0.0.0.0/0`)
   - This is necessary because Render's egress IPs aren't fixed. The database is still protected by the password and the JWT layer.
   - Click **Confirm**
7. Once the cluster is green, click **Connect** on the cluster card:
   - Choose **Connect your application**
   - Driver: Node.js
   - Copy the connection string. It looks like:
     ```
     mongodb+srv://kredit_app:<password>@kredit-prod.xxxxx.mongodb.net/?retryWrites=true&w=majority
     ```
   - **Replace `<password>`** with the one you generated in step 5.
   - **Add the database name** before the `?`:
     ```
     mongodb+srv://kredit_app:YOUR_PASSWORD@kredit-prod.xxxxx.mongodb.net/kredit?retryWrites=true&w=majority
     ```
   - **Save this string** — it's your `MONGODB_URI`.

✓ Atlas is ready. You'll paste that connection string into Render in Step 3.

---

## Step 2 — Mailtrap (email sandbox for the demo)

Mailtrap catches all outbound email in an inbox you can read in your browser. Perfect for a demo where you don't want to risk sending real email to real people.

1. Sign up at **https://mailtrap.io** (free tier).
2. Once in, you land in **Email Testing → Inboxes**. There's a default "My Inbox".
3. Click that inbox. You'll see an **SMTP Settings** panel.
4. Pick "Node.js → Nodemailer" from the dropdown to see the values:
   ```
   Host:     sandbox.smtp.mailtrap.io
   Port:     2525
   Username: <some username>
   Password: <some password>
   ```
5. Save these values — you'll paste them into Render.

**For real production** (after you graduate from a demo), swap Mailtrap for SendGrid (100 emails/day free) or AWS SES (~$0.10 per 1,000). The backend code doesn't change — just the SMTP env vars.

---

## Step 3 — Render (backend)

Render reads the `render.yaml` we wrote and creates the API service + cron job in one shot.

### 3a. Create the services from the blueprint

1. Sign up / sign in at **https://render.com**.
2. Connect your GitHub account when prompted.
3. From the dashboard, click **New** → **Blueprint**.
4. Select your Kredit repo. Render reads `backend/render.yaml` automatically.
5. Render shows the two services it'll create:
   - `kredit-api` (web service)
   - `kredit-repayment-cycle` (cron job)
6. Click **Apply**. Render starts the first deploy.

### 3b. Set the secret env vars

The blueprint marks several env vars as `sync: false` — Render won't deploy until you fill them in.

In the Render dashboard, go to **kredit-api** → **Environment** and set:

| Variable | Value |
|---|---|
| `MONGODB_URI` | The full Atlas string from Step 1 |
| `CORS_ORIGINS` | (leave empty for now — we set this in Step 5 after Vercel deploys) |
| `FRONTEND_URL` | (leave empty for now) |
| `SMTP_HOST` | `sandbox.smtp.mailtrap.io` |
| `SMTP_PORT` | `2525` |
| `SMTP_USER` | from Mailtrap |
| `SMTP_PASSWORD` | from Mailtrap |
| `SMTP_FROM` | `Kredit <noreply@kredit.pk>` |

Click **Save Changes** at the top. Render redeploys automatically.

### 3c. Watch the first deploy

Click the **Logs** tab. You should see:

```
[DB] Connecting to MongoDB...
[DB] Connected ✓

╭─────────────────────────────────────────────╮
│  Kredit API · production                    │
├─────────────────────────────────────────────┤
│  Port:           5000                       │
│  CORS origins:   https://example.com        │
│  Repayment cron: disabled                   │
│  Email:          SMTP configured            │
╰─────────────────────────────────────────────╯

[Server] Kredit API ready on http://localhost:5000
```

Take note of your service URL — Render shows it at the top of the service page, e.g. `https://kredit-api.onrender.com`. **Copy that URL.**

### 3d. Seed the database with the admin user + 15 vendors

The seed script is part of the codebase. We need to run it once on the production database.

In the Render dashboard, go to **kredit-api** → **Shell** (this might require a paid plan; if Shell is locked, run the seed locally with the production `MONGODB_URI` instead):

```bash
node src/utils/seed.js
```

You should see the script create the admin user and 15 vendors.

**Default admin credentials** (change immediately on first login):
- Email: `admin@kredit.pk`
- Password: `Admin@123!`

If Shell is paywalled on free tier, run it locally:

```bash
cd backend
MONGODB_URI="mongodb+srv://kredit_app:PASSWORD@kredit-prod.xxxxx.mongodb.net/kredit?retryWrites=true&w=majority" \
JWT_SECRET="anything-for-this-one-time-script" \
node src/utils/seed.js
```

✓ Backend live, database seeded.

---

## Step 4 — Vercel (frontend)

1. Sign up / sign in at **https://vercel.com**.
2. Connect your GitHub account.
3. Click **Add New** → **Project**.
4. Pick the Kredit repo. Vercel auto-detects Vite.
5. **Root Directory**: click **Edit** and set it to `frontend` (otherwise it tries to build the backend).
6. **Framework Preset**: should auto-fill to "Vite". If not, pick it.
7. Expand **Environment Variables** and add:

| Variable | Value |
|---|---|
| `VITE_API_URL` | Your Render URL from Step 3c, e.g. `https://kredit-api.onrender.com` (no trailing slash) |

8. Click **Deploy**. First build takes 1–2 minutes.
9. Once deployed, Vercel shows your URL — typically `https://kredit-<random>.vercel.app`. **Copy this URL.**
10. Visit it. You should see the Kredit landing page in the dark-infrastructure theme.

**Note:** trying to log in right now will fail with a CORS error. That's expected — we haven't told the backend to trust your Vercel domain yet. Step 5 fixes that.

---

## Step 5 — Connect frontend ↔ backend

Go back to **Render → kredit-api → Environment** and set the two values we left blank:

| Variable | Value |
|---|---|
| `CORS_ORIGINS` | Your full Vercel URL, e.g. `https://kredit-abc123.vercel.app` |
| `FRONTEND_URL` | Same value (used in email links) |

Save. Render redeploys automatically (~30s).

Once it's back up, refresh your Vercel site and try to sign in with the seeded admin credentials. You should land on the admin dashboard.

✓ Frontend ↔ backend handshake works.

---

## Step 6 — Wire up the cron job

The repayment cycle needs to run daily. The blueprint created a cron service, but it has placeholder values.

### 6a. Get an admin JWT token

1. On your live Vercel site, sign in as admin.
2. Open browser DevTools → **Application** tab → **Local Storage** → your Vercel URL.
3. Copy the value of `kredit_token`. It's a long string starting with `eyJ...`.

### 6b. Update the cron command

In Render, go to **kredit-repayment-cycle** → **Settings**.

Under **Build & Deploy** → **Docker Command**, replace the placeholder values:

- Replace `YOUR-SERVICE-NAME.onrender.com` with your actual Render URL host (e.g. `kredit-api.onrender.com`)
- Replace `ADMIN_JWT_TOKEN` with the token you copied

Save. The cron runs at 02:00 UTC daily. To test manually now, click **Trigger Run** in the cron dashboard — you should see a successful curl call in the logs.

**About the token:** JWTs expire (default 7 days). For a real production deployment you'd:
- Either bump `JWT_EXPIRES_IN=90d` and rotate the cron token quarterly
- Or expose a separate API-key-based endpoint just for the cron (better but more work)

For a student demo, refreshing the token weekly is acceptable.

---

## Step 7 — Verify the full user journey

The deployment is done. Now verify the whole flow works on real infrastructure.

Sign out of the admin account, then:

1. **Sign up as a startup**
   - Use a real email if you want to see the verification email arrive in Mailtrap
   - Complete the two-step form
   - Land on `/dashboard` with KYC banner showing "Complete your KYC"

2. **Check the verification email in Mailtrap**
   - Mailtrap inbox → click the email
   - The "Verify email" button leads to `https://your-vercel-url/verify-email/...`
   - Clicking it should flip your account to verified

3. **Upload KYC documents**
   - Profile page → upload all four documents (any PDF or image works for a demo)
   - Status should change to `under_review`
   - **CAVEAT:** the files are stored on Render's ephemeral disk. They'll disappear on the next redeploy. For a real product, swap `multer.diskStorage` for Cloudinary or S3. The links in the admin KYC review pane will 404 after the disk wipes. This is OK for a one-shot demo but document it for graders.

4. **Approve KYC as admin**
   - Sign out, sign back in as admin
   - `/admin/kyc` → pick your startup → Approve with a credit limit (e.g. PKR 2,000,000)
   - Mailtrap should receive the approval email

5. **Apply for financing**
   - Back in as the startup
   - `/vendors` → pick AWS → Apply
   - Fill the form, upload any PDF as the invoice, submit

6. **Approve and sign**
   - Admin: `/admin/requests` → approve
   - Startup: `/contracts/:id` → sign through the password + typed-name + accept-terms modal
   - Contract should activate, schedule should populate

7. **Pay an installment**
   - `/contracts/:id/schedule` → click "Pay now" on installment 1
   - Pick JazzCash → confirm
   - Should hit ~95% success (simulated gateway)
   - On success, you can download the receipt

8. **Trigger the daily cycle manually**
   - Admin → `/admin/dashboard` → trigger from API or wait for cron
   - Or hit the endpoint with curl to see all the cycle stats

If all eight steps pass, you have a fully working Kredit deployment.

---

## Troubleshooting

### Backend won't boot — "Missing required environment variables"
You forgot to set `MONGODB_URI` or `JWT_SECRET` in Render. Go to Environment, verify they're set, save.

### Backend boots but health check fails / service shows "Failed"
Check the Logs tab. Most common cause: `MONGODB_URI` is wrong (typo, password not URL-encoded if it contains special chars, IP not whitelisted).

To URL-encode special characters in the Atlas password:
- `@` → `%40`
- `:` → `%3A`
- `/` → `%2F`
- `?` → `%3F`
- `#` → `%23`

### Frontend deploys but shows blank page
Check the browser console. Most likely a CORS error if `CORS_ORIGINS` doesn't match your Vercel URL exactly. The protocol matters — `http` ≠ `https`. The trailing slash matters — `https://x.vercel.app/` ≠ `https://x.vercel.app`.

### "Failed to fetch" / network errors after a few minutes idle
That's the Render free tier sleeping. The first request after a 15-minute idle period takes ~30s while the service wakes. Subsequent requests are normal speed. Upgrade to Render's $7/mo Starter plan to disable sleeping.

### Cron job logs "401 Unauthorized"
Your JWT token expired. Sign in as admin again, copy the new token from Local Storage, update the cron command in Render.

### KYC documents disappear after a redeploy
Expected on Render free tier — the disk is ephemeral. Document this for graders or swap to Cloudinary/S3.

### Mailtrap inbox is empty even though signup happened
Check Render logs. If you see `[Mail] Failed:` errors, your SMTP credentials are wrong. The backend falls back to logging emails to console when SMTP isn't configured — search Render logs for `[Mail dev fallback]` to see the email content during debugging.

---

## What's NOT production-ready

This is a student project demo deployment. Before serving real money to real users, you'd want to:

1. **Persistent file storage** — Cloudinary for KYC docs and ticket attachments instead of ephemeral local disk
2. **Real payment gateway** — replace the simulated gateway with PayFast / JazzCash / EasyPaisa SDK; involves merchant account setup, webhook handling, idempotency keys, reconciliation
3. **Better cron** — separate API key for the cron user, or move to a Render background worker on a paid tier
4. **Production email** — SendGrid or AWS SES with SPF/DKIM/DMARC records on your real domain
5. **Custom domain** — `kredit.pk` instead of `kredit-abc.vercel.app`. Both Vercel and Render support custom domains on free tiers.
6. **Observability** — Sentry for frontend errors, structured logging on the backend, basic uptime monitoring (UptimeRobot is free)
7. **Database backups** — Atlas M0 doesn't include backups. Either upgrade to M2 ($9/mo) or run a daily `mongodump` cron
8. **Rate limiting hardening** — current limits are sane but not battle-tested
9. **HTTPS-only cookies** if you switch from localStorage to cookie-based auth
10. **Legal review** of the Murabaha contract terms by a Pakistani Shariah scholar before any real loans are issued

---

## Quick reference

| What | Where | URL |
|---|---|---|
| Database | MongoDB Atlas | https://cloud.mongodb.com |
| Backend API | Render | https://your-service.onrender.com |
| Frontend | Vercel | https://your-project.vercel.app |
| Email sandbox | Mailtrap | https://mailtrap.io |
| Backend logs | Render → Logs tab |  |
| Frontend logs | Browser DevTools → Console |  |
| Database browser | Atlas → Browse Collections |  |
| Cron logs | Render → kredit-repayment-cycle → Logs |  |

---

## Quick redeploy after code changes

Once the initial setup is done, redeploys are automatic:
- **Backend**: push to GitHub `main` → Render rebuilds automatically (~2 min)
- **Frontend**: push to GitHub `main` → Vercel rebuilds automatically (~1 min)

To force a redeploy without code changes (e.g. after changing env vars):
- Render: **Manual Deploy** → **Deploy latest commit**
- Vercel: **Deployments** → ⋯ on latest → **Redeploy**
