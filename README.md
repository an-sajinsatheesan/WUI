# WhatsApp Unified Inbox & Ticketing — MVP

One inbox for several WhatsApp Business numbers, with tickets, customers and Admin/Agent users.
WhatsApp is **simulated** (no real API, no keys); the provider layer is swappable for the real
WhatsApp Cloud API later.

| Part     | Stack                                                         | Folder      |
| -------- | ------------------------------------------------------------- | ----------- |
| Frontend | Angular 21, TypeScript, PrimeNG 21 (MIT), Tailwind CSS 4       | `frontend/` |
| Backend  | Node.js, Express 5, Mongoose                                  | `backend/`  |
| Database | Your existing MongoDB Atlas M0 cluster, database `whatsapp_mvp` | —           |

## Features

**Workspace (Admin and Agent)**
- **Dashboard** – total conversations, unread conversations, open / in-progress / resolved tickets, conversations per WhatsApp account, recent conversations and recent tickets.
- **WhatsApp Inbox** – three columns: conversation list · thread · customer & tickets. Filter by number, search, read, reply, close/reopen, assign.
- **Tickets** – create, edit, assign, change status/priority, close, delete (permission).
- **Customers** – list, search, create, edit, delete (permission); profile with history across all numbers and tickets.
- **Top navigation** – company logo/name, global search (customers, conversations, tickets; `Ctrl K`), notifications (unread conversations and your active tickets), profile menu.

**Administration (Admin only)**
- **Team** – add/edit users, Admin or Agent role, department, active/disabled, last login.
- **WhatsApp Accounts** – add/edit numbers, activate/deactivate, department, provider type, API keys, connection status with *Test connection*, webhook URL.
- **Settings** – company profile, departments, **roles & permissions** (what Agents may do), provider comparison and webhook endpoints.

## WhatsApp providers

Each WhatsApp account chooses its own provider in **WhatsApp Accounts → Edit → Provider connection**. Only Admins can see
or change provider settings; the API enforces this too.

| Provider | Settings entered in the app |
| -------- | --------------------------- |
| Simulated (demo) | none |
| Meta WhatsApp Cloud API | API base URL, Phone number ID, WABA ID (optional), Access token |
| 360dialog | API base URL, API key |
| WATI | API endpoint (with tenant ID), Access token |
| Twilio | API base URL, Account SID, sender number (optional), Auth token |

- **Secrets** (tokens, API keys, auth tokens) are encrypted with AES-256-GCM before they are stored, are never returned to
  the browser (the UI only shows "Saved"), and are only decrypted on the server when sending or testing.
- **Test connection** calls the provider with the saved credentials and records *Connected* / *Error* / *Not configured*.
- **Deactivated** numbers cannot send replies; incoming messages are still stored.
- **Incoming messages**: give the provider the webhook URL shown in the account's edit dialog:
  `https://<backend>/api/webhooks/<provider>?account=<accountId>` (add `&token=<WEBHOOK_TOKEN>` if you set one).
  For Meta, set `META_VERIFY_TOKEN` on the backend and enter the same value in the Meta App webhook settings.
- Adding another provider: create `backend/src/providers/<name>.js` with `fields`, `sendMessage`, `testConnection` and
  `parseWebhook`, then register it in `providers/index.js`. The form in the UI is generated from `fields`.

Not yet included: template messages (needed to message a customer outside the 24-hour window), media sending, and
provider signature verification on webhooks (use `WEBHOOK_TOKEN` meanwhile).

## Roles & permissions

Admins can do everything. In **Settings → Roles & permissions** an Admin switches these on or off for Agents:
assign conversations, close/reopen conversations, assign tickets to others, delete tickets, create/edit customers,
delete customers, use the message simulator. Managing the team, WhatsApp accounts/API keys and settings is always
admin-only. Every permission is checked by the API, not just hidden in the UI.

## Project structure

```
backend/
  api/index.js            Vercel serverless entry (exports the Express app)
  src/app.js              Express app: CORS, routes, error handling
  src/server.js           Local server (npm run dev)
  src/db.js               Cached Mongo connection, always uses MONGODB_DB (whatsapp_mvp)
  src/models/             User, Account, Customer, Conversation, Message, Ticket
  src/routes/             auth, dashboard, accounts, conversations, tickets, customers, users, simulate, webhooks
  src/services/messaging.js  sendOutbound / receiveInbound (provider-agnostic)
  src/providers/          mockProvider.js + index.js (select with WHATSAPP_PROVIDER)
  src/seed.js             Demo data (only touches whatsapp_mvp)
  vercel.json, .env.example
frontend/
  src/app/core/           API service, auth (token, interceptor, guards), models
  src/app/layout/shell.ts Sidebar + top navigation
  src/app/pages/          login, dashboard, inbox, tickets, customers, customer-detail, users
  src/app/shared/         ticket dialog (used by inbox, tickets, customer page)
  src/environments/       environment.development.ts (local), environment.ts (production)
  scripts/set-env.mjs     Writes the production API URL at build time on Vercel
  vercel.json, .env.example
```

---

## 1. Run locally

**Prerequisites:** Node.js 20.19+ (or 22.12+), npm, and your MongoDB Atlas connection string.

### 1.1 Atlas preparation (one time)

1. Atlas → **Database Access**: use an existing database user or create one (role *Read and write to any database*,
   or scoped to the `whatsapp_mvp` database).
2. Atlas → **Network Access**: add your current IP (for local development).
3. Atlas → **Connect → Drivers**: copy the `mongodb+srv://...` string.

You do **not** need to create the database: MongoDB creates `whatsapp_mvp` on first write. The app never reads,
writes or drops any other database. The seed script refuses to run against any database other than `whatsapp_mvp`.

### 1.2 Backend

```bash
cd backend
npm install
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
```

Edit `backend/.env`:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=whatsapp_mvp
JWT_SECRET=<long random string>
CORS_ORIGINS=http://localhost:4200
```

Generate a secret with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

```bash
npm run seed     # creates demo data in whatsapp_mvp (re-running resets only this app's collections)
npm run dev      # http://localhost:3000/api  (health check: /api/health)
```

### 1.3 Frontend

```bash
cd frontend
npm install
npm start        # http://localhost:4200  (uses environment.development.ts → http://localhost:3000/api)
```

### 1.4 Demo logins

| Role  | Email             | Password    |
| ----- | ----------------- | ----------- |
| Admin | admin@demo.com    | Admin@123   |
| Agent | agent1@demo.com   | Agent@123   |
| Agent | agent2@demo.com   | Agent@123   |

Change or delete these users (Users page) before sharing a deployed URL.

### 1.5 Simulating WhatsApp traffic

- Inbox → ⚡ button next to the number filter: a random customer writes to a random (or the filtered) number.
- Inbox → **Simulate reply** in a thread: the customer replies in that conversation.
- Replies you send go through `mockProvider.sendMessage()` and are stored as `delivered`.
- The inbox polls every 8 seconds, so simulated or webhook messages appear without reloading.
- Webhook (as an external system would call it):

```bash
curl -X POST http://localhost:3000/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"from":"+971509999999","to":"+97145550102","text":"Hello from a new customer"}]}'
```

Unknown senders are created as new customers automatically. If `WEBHOOK_TOKEN` is set, send it in the
`x-webhook-token` header.

---

## 2. Deploy to Vercel (default `*.vercel.app` domains)

Create **two Vercel projects** from the same Git repository: one for the API, one for the web app.

### 2.1 Atlas network access for Vercel

Vercel functions use dynamic IPs, and M0 clusters don't support private networking, so add
`0.0.0.0/0` to Atlas **Network Access**. Access is still protected by the database username/password; use a strong
password and a database user scoped to `whatsapp_mvp` if you prefer.

### 2.2 Backend project (Express as a Vercel serverless function)

1. Vercel → **Add New → Project** → import the repo.
2. **Root Directory:** `backend` · **Framework Preset:** Other · leave build/output settings empty.
3. **Environment Variables** (Production):

   | Name                | Value                                                    |
   | ------------------- | -------------------------------------------------------- |
   | `MONGODB_URI`       | your Atlas connection string                             |
   | `MONGODB_DB`        | `whatsapp_mvp`                                           |
   | `JWT_SECRET`        | long random string (different from local)                |
   | `NODE_ENV`          | `production`                                             |
   | `CORS_ORIGINS`      | `https://<frontend-project>.vercel.app` (set after 2.3)  |
   | `WHATSAPP_PROVIDER` | `mock`                                                   |

4. Deploy, then open `https://<backend-project>.vercel.app/api/health` → `{"ok":true,...}`.

`vercel.json` rewrites every path to `api/index.js`, which exports the Express app. The Mongo connection is cached
across warm invocations and uses a small pool to stay within M0 connection limits.

Seed the Atlas database once from your machine (the same `.env` as local works): `cd backend && npm run seed`.

### 2.3 Frontend project (static Angular build)

1. Vercel → **Add New → Project** → import the same repo.
2. **Root Directory:** `frontend` · Framework Preset: Angular. Build command, output directory and SPA rewrites come
   from `frontend/vercel.json` (`npm run build:vercel` → `dist/frontend/browser`).
3. **Environment Variables:** `API_URL` = `https://<backend-project>.vercel.app/api`
4. Deploy. The build writes `API_URL` into `environment.ts` (the only value the browser receives; no secrets).

### 2.4 Connect the two

Set the backend's `CORS_ORIGINS` to the frontend URL, e.g. `https://wui-web.vercel.app`, and **redeploy the backend**
(environment changes apply on the next deployment). To also allow preview deployments, add a wildcard entry:
`https://wui-web.vercel.app,https://wui-web-*.vercel.app`.

### Alternative: backend on a Node host

`npm start` runs `src/server.js` on any Node host (Render, Railway, a VM). Use the same environment variables and set
the frontend's `API_URL` to that host's `/api` URL.

---

## Environment variables

**Backend (`backend/.env`, Vercel project settings)**

| Variable            | Required | Description                                                          |
| ------------------- | -------- | -------------------------------------------------------------------- |
| `MONGODB_URI`       | yes      | Atlas connection string. Server-side only.                           |
| `MONGODB_DB`        | yes      | Must be `whatsapp_mvp`.                                              |
| `JWT_SECRET`        | yes (prod) | Signs login tokens. Required when `NODE_ENV=production`.           |
| `JWT_EXPIRES_IN`    | no       | Token lifetime, default `7d`.                                        |
| `CORS_ORIGINS`      | yes      | Comma-separated allowed frontend origins; `*` wildcard per subdomain label. |
| `WHATSAPP_PROVIDER` | no       | Default provider for new accounts, `mock`.                           |
| `ENCRYPTION_KEY`    | no       | Encrypts provider API keys in MongoDB. Falls back to `JWT_SECRET`.   |
| `WEBHOOK_TOKEN`     | no       | Shared secret for `/api/webhooks/*` (`?token=` or `x-webhook-token`). |
| `META_VERIFY_TOKEN` | no       | Token for Meta's webhook verification handshake.                     |
| `SEED_ON_EMPTY`     | no       | `true` loads demo data on first request when the database is empty. |
| `PORT`              | no       | Local port, default `3000`.                                          |

**Frontend (Vercel project settings only)**

| Variable  | Description                                                   |
| --------- | ------------------------------------------------------------- |
| `API_URL` | Public backend URL ending in `/api`, used at build time only. |

## API overview

All routes are under `/api` and need `Authorization: Bearer <token>` except `auth/login`, `health` and `webhooks`.

| Method | Path | Notes |
| ------ | ---- | ----- |
| POST | `/auth/login` · GET `/auth/me` | JWT login |
| GET | `/dashboard` | totals, per-number stats, recent tickets |
| GET | `/accounts` | WhatsApp numbers with unread counts (no secrets) |
| GET | `/accounts/providers` | provider list and their settings fields (admin) |
| POST · PUT | `/accounts`, `/accounts/:id` | add / edit number, department, active, provider, keys (admin) |
| POST | `/accounts/:id/test` | test provider connection (admin) |
| GET · PUT | `/settings` | company, departments, agent permissions (PUT admin) |
| GET | `/conversations?accountId=&status=&unread=&search=` | list |
| GET · PATCH | `/conversations/:id` | thread with messages · status/assignee |
| POST | `/conversations/:id/read` · `/conversations/:id/messages` | mark read · send reply |
| GET · POST | `/tickets` (filters: status, priority, assignedTo, accountId, customerId, conversationId, search) | |
| GET · PUT · DELETE | `/tickets/:id` | DELETE admin only |
| GET · POST | `/customers?search=` | |
| GET · PUT · DELETE | `/customers/:id` | GET includes history and tickets; DELETE admin only |
| GET · POST · PUT · DELETE | `/users`, `/users/:id` | Team; write operations admin only |
| POST | `/simulate/incoming` | `{ conversationId }` or `{ accountId?, customerId?, text? }` |
| POST | `/webhooks/:provider` | incoming messages: `meta`, `360dialog`, `wati`, `twilio`, `whatsapp` (mock format) |
| GET | `/webhooks/meta` | Meta webhook verification |

## Notes

- All app data is stored in MongoDB. The browser only keeps the login token.
- PrimeNG is pinned to v21, the last MIT-licensed major. PrimeNG 22+ needs a PrimeUI license key and shows a
  license banner without one.
- Optional offline mode: `npm run dev:memory` in `backend/` starts an in-memory MongoDB with seed data (downloads a
  MongoDB binary on first run; data is lost on exit).
