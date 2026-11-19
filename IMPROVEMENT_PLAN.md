# Campus Connect: Improvement Plan (v2)

> **Who this is for:** the implementing agent (Claude Sonnet) and Chitrak.
> **Written by:** Claude Opus after a full read of the code, the live Vercel, Render and Neon setup, and `npm audit`, on 2026-11-20.
> **How to use it:** work through the phases in order and change `- [ ]` to `- [x]` as each task is done. Commit this file along with the code so progress is saved.

---

## 0. Rules for the implementing agent (read first)

1. **Work in order.** The phases are ordered by priority: Phase 1 fixes things that are broken in production *right now*.
2. **Branch:** do all work on `improve/v2`. **Never push to `main` until Phase 9.** Render auto-deploys `main` the moment you push.
3. **Don't change the stack:** React 18 + Vite, Express 4 (CommonJS), `pg`, Socket.IO, Cloudinary. No TypeScript migration, no Tailwind, no ORM, no Next.js. Small libraries are allowed where this plan names them.
4. **Keep the identity:** navy (`#0B1F3A`) and gold (`#C9A84C`), with Playfair Display and DM Sans. Refine it; don't replace it.
5. **Secrets:** never commit `.env` files, and never print secret values in logs, commits or chat. Set secrets in the Render/Vercel dashboards (or via MCP without echoing them).
6. **Ask Chitrak before:** any destructive or data-changing SQL on the **production** Neon branch, changing a Render plan or region, deleting Cloudinary assets, or rotating secrets.
7. **Test against the Neon `dev` branch** (created in Phase 0), never against production data.
8. **One commit per task group**, with messages like `fix(socket): authorize group room joins [S2]`. Put the task IDs in the message.
9. After each phase, run that phase's **✅ Verify** block. If something fails, fix it before moving on.
10. If a task turns out to be wrong or unnecessary, **don't skip it silently**: log it in §13 *Notes / Deviations*.
11. Be token-efficient. Read only the files a task names, and don't re-read the whole codebase per task.

---

## 1. Project snapshot (facts verified on 2026-11-20)

| Piece | Details |
|---|---|
| Repo | `github.com/chitrak-cs/Campus-Connect`, branch `main`, last commit `230999c` |
| Local folder | `~/Desktop/Campus-Connect` (same as GitHub plus the git-ignored `.env` files) |
| Frontend | Vercel project `campus-connect` (`prj_J0tXIAWlrEdNGYL3W6u5mr8L4xWY`), team `team_vYDZX0zlmdv8gRmP6SUGdkuB`, prod URL **https://campus-connect-five-zeta.vercel.app**. Git-connected (auto-deploys `main`). Only env var: `VITE_API_URL`. **Framework preset is `null`.** Vercel auth protects preview URLs. |
| Backend | Render web service `campus-connect-backend` (`srv-d8vsgaurnols73e3e9u0`), workspace `tea-d8vsdar7uimc738r01v0`, URL **https://campus-connect-backend-4g6v.onrender.com**, **free plan, region Oregon**, rootDir `backend`, build `npm install`, start `npm start`, auto-deploy on `main`, **no health check path**. |
| Database | Neon project `floral-sunset-17025736` ("Campus Connect"), Postgres 17, **region ap-southeast-1 (Singapore)**. Data: 13 users (1 admin, 0 faculty), 3 files, 2 groups, 3 messages, 9 OTP rows. **Only PK/unique indexes exist.** |
| Storage | Cloudinary, folder `Jadavpur_university` |
| Email | Gmail SMTP via nodemailer. **Blocked on Render's free plan** (see C3). |

Tables: `users, files, study_groups, group_members, messages, announcements, otps`. The schema is created idempotently in `backend/config/db.js → initDB()` (and `otps` lazily in `authController.js`).

---

## 2. Actions only Chitrak can do

- [ ] **H1 (do this today): check the admin password.** The login page publicly shows `admin@Jadavpur.ac.in / admin123`, and `seed.js` creates that account. Production has exactly one admin. Try logging in on the live site with those credentials. **If it works, anyone can be admin.** Change it right away:
  1. `cd backend && node -e "console.log(require('bcryptjs').hashSync('YOUR-NEW-STRONG-PASSWORD', 12))"`
  2. In the Neon SQL editor (production branch): `UPDATE users SET password = '<hash from step 1>' WHERE role = 'admin';`
- [ ] **H2: create a transactional email account** with an HTTPS API (recommended: **Brevo**, which can send from a verified single sender such as your Gmail without owning a domain; alternative: Resend, which needs a domain). Verify the sender address, create an API key and add it to Render as `BREVO_API_KEY` (Task C3).
- [ ] **H3: decide on the backend region** (Task P4): move Render from Oregon to Singapore so it sits next to the database? (Recommended. It's free, but it means creating a new Render service.)
- [ ] **H4: approve the one-time email lower-casing UPDATE** on production (Task D2).
- [ ] **H5: optional.** Should registration be restricted to university email domains? If yes, give the domain(s) for `ALLOWED_EMAIL_DOMAINS` (Task S9).
- [ ] **H6:** when the agent asks, approve the Vercel team-access link (Vercel's MCP needs a per-session grant).

---

## 3. Audit findings (the "why" behind each task)

### Broken in production right now
| ID | Finding | Where |
|---|---|---|
| C1 | **Chat and real-time features are dead in production.** The socket client is hard-coded to `http://localhost:5001`. | `frontend/src/utils/socket.js` |
| C2 | **Opening or refreshing any route except `/` returns 404 on Vercel** (verified: `/files` fails). There's no SPA rewrite. | missing `frontend/vercel.json` |
| C3 | **OTP emails can't be sent from Render.** Free web services block SMTP ports 25/465/587 (since Sept 2025), so new users can't finish registering. The fallback also **writes the OTP in plain text to Render logs**. | `authController.js → sendOtpEmail` |
| C4 | **No `pool.on('error')` handler.** When Neon drops an idle connection, the unhandled `'error'` event can crash the Node process. | `backend/config/db.js` |
| C5 | **No Express error middleware.** Multer errors (wrong type, >50 MB) fall through to Express's default HTML error page and a 500. | `backend/server.js` |
| C6 | **Login OTP "Verify" button double-fires.** It has no `type="button"` inside a `<form onSubmit={handle}>`, so clicking Verify also re-runs login and **sends a new OTP**. | `LoginPage.jsx` |
| C7 | **Wrong password reloads the page.** The axios 401 interceptor runs `window.location.href='/login'` on *any* 401, including the login call itself, so the error toast flashes and the page reloads. | `frontend/src/utils/api.js` |

### Security
| ID | Sev | Finding |
|---|---|---|
| S1 | **Critical** | Anyone can **self-register as `faculty`** (role comes from the request body). Faculty uploads are auto-approved and pass `facultyOrAdmin`. |
| S2 | **Critical** | Socket `join_groups` joins **any** room the client names, so any logged-in user can **read private group messages** live (and `typing_group` leaks too). The REST history endpoint checks membership; the socket doesn't. |
| S3 | High | Private groups: `POST /groups/:id/join` lets anyone join a private group, and `GET /groups/:id/members` returns **member emails** for any group to any user. |
| S4 | High | Demo admin credentials are shown publicly on the login page (see H1). There's no change-password feature at all. |
| S5 | High | OTP: `Math.random()`, stored in plain text, **unlimited guesses** per OTP, no rate limits, and the client chooses `purpose`. 6 digits with no attempt limit can be brute-forced. |
| S6 | Medium | No rate limiting anywhere (login, register, OTP and chat messages can all be spammed; this also enables email bombing). |
| S7 | Medium | No security headers (`helmet`), JSON body limit 10 MB, no `trust proxy` (needed behind Render for correct IPs). |
| S8 | Medium | No input validation or length limits (names, titles, chat messages are unbounded; a non-string `content` throws). |
| S9 | Medium | Uploads trust the client MIME type; extension and MIME aren't cross-checked; `resource_type` is guessed from the extension. |
| S10 | Low | Emails are case-sensitive (`admin@Jadavpur.ac.in` ≠ `admin@jadavpur.ac.in`). Login reveals "Account disabled" before checking the password. `getStats` returns `err.message` to the client. `/api/announcements` is unauthenticated. `ssl.rejectUnauthorized:false`. Admins can demote or deactivate themselves or the last admin. |
| S11 | Low | `npm audit`: **high** advisories in backend (body-parser, engine.io, path-to-regexp, nodemailer, mysql2, lodash) and frontend (axios, react-router's `@remix-run/router`, esbuild, follow-redirects). `mysql2` and `pool` are unused dependencies. |

✔ Already fine (don't spend effort here): all SQL is parameterized (no SQL injection found); React escapes chat content (no `dangerouslySetInnerHTML`); `.env` was never committed to git history; deactivated users are rejected by `protect`.

### Bugs
| ID | Finding |
|---|---|
| B1 | Per-tab sessions: the token key includes a `sessionStorage` tab id, so **every new tab is logged out**, and old `au_token_tab_*` keys pile up in localStorage forever. |
| B2 | `ChatPage` cleanup calls `socket.off('new_global_message')` **without a handler**, which removes the Layout's notification listeners too, so notifications stop after visiting Chat. |
| B3 | Group message notifications say "New message in **undefined**" (the server never sends `group_name`). You also get notified about your *own* messages. |
| B4 | **Deleting a PDF/DOC/PPT never removes it from Cloudinary.** `deleteFromCloudinary(public_id, file.title)` guesses the resource type from the *title* (no extension), so it calls `destroy` with `image` on a `raw` asset. Orphaned files pile up. |
| B5 | `GET /files`: `limit` is unbounded (`?limit=100000`); a negative or NaN `page` gives a 500. |
| B6 | Users can't see their own **pending** uploads anywhere (they vanish after upload until approved). |
| B7 | Online presence is keyed by user id: closing one of two tabs marks the user offline. |
| B8 | Dev setup: the Vite proxy targets `:5000` but the server defaults to `:5001`. |
| B9 | Announcement notifications link to `/admin`, so non-admins get bounced to `/`. |
| B10 | `FilesPage` fetches twice on mount (two effects both call `fetchFiles`). |
| B11 | Fake hero stats ("500+ Study Materials, 2000+ Active Students"); the real numbers are 3 files and 13 users. |
| B12 | `updateProfile` uses `||`, so a field can never be cleared. |
| B13 | `ensureOtpTable()` runs `CREATE TABLE` on every OTP call; old OTPs are never cleaned up. |
| B14 | The group creator can "leave" their own group, leaving it ownerless. |
| B15 | The Vercel framework preset is `null` (it should be Vite); Render has no health check path. |

### Performance
| ID | Finding |
|---|---|
| P1 | No indexes on `messages(group_id, created_at)`, `messages(is_global, created_at)`, `files(is_approved, created_at)`, `group_members(user_id)`, `files(uploaded_by)`. |
| P2 | `getStats` runs 6 sequential queries; it could be one. |
| P3 | Google Fonts are loaded via CSS `@import` (render-blocking); there's no route-level code splitting. |
| P4 | **Render (Oregon) ↔ Neon (Singapore):** every query crosses the Pacific, and each API call makes 2–4 sequential queries, which adds roughly 0.5–1 s per request. |
| P5 | Render free tier sleeps when idle, so the first visit takes 30–60 s with no feedback in the UI. |

---

## Phase 0: Setup

- [x] **0.1** `git checkout -b improve/v2` in the local repo (`~/Desktop/Campus-Connect`). Make sure `git status` is clean and in sync with `origin/main`.
- [x] **0.2** Create a **Neon branch `dev`** from production in project `floral-sunset-17025736` (Neon MCP `create_branch`). Get its connection string and put it in `backend/.env` as `DATABASE_URI` **for local development only**. Keep a commented copy of the old value in the same `.env` so Chitrak can switch back.
- [x] **0.3** Create a **safety backup** of production before any deploy: a Neon branch `backup-pre-v2` from production (or a snapshot).
- [x] **0.4** Fix the dev ports (B8): set the Vite proxy target to `http://localhost:5001` for both `/api` and `/socket.io`. Make sure `frontend/.env` has `VITE_API_URL=/api` for local dev so the proxy is used.
- [x] **0.5** Add `backend/.env.example` and `frontend/.env.example` listing every variable in §12 (names only, no values).
- [x] **0.6** Add `"engines": { "node": ">=20" }` to both `package.json` files.
- [~] **0.7** Run both apps locally (`npm run dev` in each) and confirm login works against the `dev` branch.

✅ **Verify:** the app runs locally on the dev DB, and `git status` shows no `.env` files staged.

---

## Phase 1: Fix what's broken in production (C1–C7)

- [x] **1.1 [C1] Socket URL.** In `frontend/src/utils/socket.js`, derive the URL from env:
  ```js
  const apiUrl = import.meta.env.VITE_API_URL || '/api'
  const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || new URL(apiUrl, window.location.origin).origin
  socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'], reconnection: true, reconnectionAttempts: 10, reconnectionDelay: 1000 })
  ```
  Also fix `connectSocket`: if a socket exists but is disconnected, update `socket.auth` and `connect()` instead of creating a duplicate.
- [x] **1.2 [C2] SPA rewrites.** Create `frontend/vercel.json`:
  ```json
  { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
  ```
  (Security headers get added to this file in 2.10.)
- [x] **1.3 [C3] Email over HTTPS.** Create `backend/utils/mailer.js` exporting `sendEmail({ to, subject, html, text })`:
  - If `BREVO_API_KEY` is set: `POST https://api.brevo.com/v3/smtp/email` with the global `fetch` (Node ≥ 18), header `api-key`, body `{ sender: { email: MAIL_FROM, name: MAIL_FROM_NAME }, to: [{ email: to }], subject, htmlContent: html, textContent: text }`. Throw on a non-2xx response.
  - Else if SMTP vars are set: keep nodemailer (useful locally).
  - Else, **only when `NODE_ENV !== 'production'`**: `console.log` the email to the terminal for dev.
  - **Never log OTP codes in production.**
  - Replace `sendOtpEmail` internals with `sendEmail`. Build one branded HTML template (`backend/utils/emailTemplates.js`) with navy header, gold accent, code in large monospace and the expiry note.
  - If sending fails in production, `register`/`login` must return **502 `{ message: 'Could not send verification email, try again' }`** instead of pretending it worked.
- [x] **1.4 [C4] Pool hardening** in `backend/config/db.js`:
  ```js
  const pool = new Pool({ connectionString: process.env.DATABASE_URI, ssl: { rejectUnauthorized: true }, max: 5, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000 })
  pool.on('error', (err) => console.error('PG pool error (client dropped):', err.message))
  ```
  If `rejectUnauthorized: true` fails against Neon on the dev branch, revert to `false` and log it in §13.
- [x] **1.5 [C5] Central error handling** at the end of `server.js` (after the routes):
  - `app.use('/api', (req, res) => res.status(404).json({ message: 'Not found' }))`
  - An error handler that maps `multer.MulterError` (e.g. `LIMIT_FILE_SIZE` → 413 "File too large (max 50 MB)") and the file-filter error → 400; everything else → `status || 500` with a generic message when `>= 500`. Log the full error server-side only.
  - Add `process.on('unhandledRejection', ...)` logging.
- [x] **1.6 [C6]** `LoginPage.jsx`: restructure so the OTP stage is its **own `<form onSubmit={handleVerify}>`** (or give the Verify button `type="submit"` and switch the form's `onSubmit` by stage, as `RegisterPage` does). The Back button stays `type="button"`.
- [x] **1.7 [C7]** `api.js` 401 interceptor: skip the redirect when `err.config.url` starts with `/auth/login`, `/auth/register`, `/auth/verify-otp`, `/auth/forgot`, `/auth/reset` or `/auth/resend`. On other 401s, clear the auth keys and `navigate` to `/login?expired=1` without a hard reload (use a small event emitter or `window.dispatchEvent(new Event('auth:logout'))` that `AuthContext` listens for).

✅ **Verify:** locally, chat works across two browsers (normal + incognito). `npm run build && npx vite preview`, then open `/files` directly and it loads. A wrong password shows a toast with no reload. Clicking Verify sends exactly one request. Uploading a 60 MB file returns a JSON 413.

---

## Phase 2: Security hardening (S1–S11)

- [x] **2.1 [S1] Faculty role by approval only.**
  - DB (via `initDB`): `ALTER TABLE users ADD COLUMN IF NOT EXISTS requested_role TEXT CHECK (requested_role IN ('faculty'))`.
  - `register`: always insert `role='student'`; if the body asks for faculty, set `requested_role='faculty'`.
  - Admin endpoints: `GET /api/admin/role-requests`, `POST /api/admin/role-requests/:id/approve` (sets `role='faculty'`, clears the request), `POST .../:id/reject`.
  - Register UI: label the toggle "I'm faculty (needs admin approval)" and show a note after signup.
- [x] **2.2 [S2] Authorize socket rooms** (`server.js`):
  - On `connection`: `socket.join('user:' + user.id)`, then query `SELECT group_id FROM group_members WHERE user_id=$1` and join each `group:<id>`. **This is the only way a socket gets into group rooms.**
  - Replace `join_groups` with a no-op that logs a deprecation, or remove it and remove the emit in `ChatPage.jsx`.
  - Expose `io` to controllers: `app.set('io', io)`. In `joinGroup`/`createGroup` call `req.app.get('io').in('user:' + req.user.id).socketsJoin('group:' + groupId)`; in `leaveGroup`, `removeMember` and `deleteGroup` call the matching `socketsLeave` (for deletion: `io.in('group:'+id).socketsLeave('group:'+id)`).
  - `send_group_message` and `typing_group`: require `socket.rooms.has('group:' + group_id)` (re-check membership in the DB only for send; the room check is enough for typing).
  - Admins: allowed to *read* any group via REST; for live updates, add an `admin_watch_group` event that joins only if `user.role === 'admin'`.
- [x] **2.3 [S3] Group privacy** (`groupController.js`):
  - `joinGroup`: if `is_private` and the user isn't an admin, return **403** "This group is invite-only".
  - Add `invite_code VARCHAR(12) UNIQUE` (generated with `crypto.randomBytes(6).toString('base64url')` for private groups on create, and for existing private groups on boot if null), plus `POST /api/groups/join-by-code { code }`.
  - `getMembers`: if the group is private, only members or a site admin can view it. **Don't return `email`** unless the requester is a site admin.
  - `getGroups`: only return `invite_code` to the group's creator or group admins.
- [x] **2.4 [S5] OTP hardening** (`authController.js`, schema in `initDB`):
  - Move the `otps` table creation into `initDB`; add columns `code_hash TEXT`, `attempts INT DEFAULT 0`; keep `code` nullable for old rows (`ALTER TABLE otps ALTER COLUMN code DROP NOT NULL`).
  - Generate with `crypto.randomInt(100000, 1000000)`. Store `sha256(id + ':' + code)`, never the plain code. Compare with `crypto.timingSafeEqual`.
  - Max **5** attempts per OTP; after that, mark it used and return "Too many attempts, request a new code".
  - **Ignore the client's `purpose`.** `verify-otp` only accepts records whose purpose is `login` or `register`; `reset` purpose is handled only by the reset endpoint (Phase 6, F1).
  - When a new OTP is created, mark the user's previous unused OTPs of the same purpose as used.
  - Cleanup: on boot and every hour, `DELETE FROM otps WHERE created_at < NOW() - INTERVAL '1 day'`.
  - `POST /api/auth/resend-otp { id }`: 60 s cooldown per user and purpose, max 5 per hour.
- [x] **2.5 [S6] Rate limiting** with `express-rate-limit`:
  - `app.set('trust proxy', 1)` (Render sits behind one proxy).
  - `authLimiter`: 10 req / 15 min / IP on `login`, `register`, `forgot-password`, `resend-otp`; `otpLimiter`: 15 / 15 min on `verify-otp` and `reset-password`; `apiLimiter`: 300 / 15 min on `/api`.
  - Socket: a per-socket token bucket allowing at most 8 messages per 10 s; silently drop extras and emit `rate_limited` once.
- [x] **2.6 [S7]** Add `helmet()` (API defaults are fine), lower `express.json` and `urlencoded` limits to `100kb`, and make CORS read a **comma-separated `CLIENT_URLS`** list (keep `CLIENT_URL` as a fallback) for both Express and Socket.IO.
- [x] **2.7 [S8] Validation** with `zod` in `backend/middleware/validate.js` (`validate(schema)` → 400 with the first issue's message). Apply to every POST/PUT body and the `GET /files` query:
  - name ≤ 100, email valid ≤ 150 (lower-cased and trimmed), password 8–72 chars (72 is bcrypt's limit), title ≤ 255, description ≤ 2000, subject ≤ 150, `file_type` in the enum, department/year from the known lists or ≤ 100, group name 3–100, announcement title ≤ 255 and content ≤ 5000, priority in the enum.
  - Chat (`server.js`): `content` must be a string, trimmed, 1–2000 chars; `group_id` must be a UUID.
  - Route params `:id` must be UUIDs (return 400 instead of a pg 500).
- [x] **2.8 [S9] Upload safety** (`config/cloudinary.js`, `fileController.js`):
  - Allow-list map `ext → mime` (`pdf, doc, docx, ppt, pptx, jpg, jpeg, png`). Reject when the extension isn't allowed **or** doesn't match `file.mimetype`.
  - Derive `resource_type` from the allow-list (`raw` for documents, `image` for images) and **store it** (new columns `resource_type TEXT`, `original_name TEXT`, `mime_type TEXT`, `size_bytes BIGINT`).
  - If the DB insert fails after a successful Cloudinary upload, delete the Cloudinary asset.
  - Sanitize `original_name` (strip path separators and control characters, max 200 chars).
- [x] **2.9 [S10] Smaller fixes:**
  - Normalize email (`trim().toLowerCase()`) in register, login, admin createUser and forgot-password. Look users up with `WHERE LOWER(email) = $1` until D2 has run.
  - Login: check the password **before** revealing "Account disabled".
  - `getStats`: on error return 500, not `_error`.
  - `/api/announcements`: add `protect`. (The landing page uses the new public stats endpoint instead.)
  - Admin `updateUser`: block changing your own role or `is_active`, and block demoting or deactivating the **last** active admin. Same check in `deleteUser`.
  - Remove the demo-credentials box from `LoginPage.jsx`. Change `seed.js` to read `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` from env and **refuse to run when `NODE_ENV=production`**.
- [x] **2.10 Frontend security headers** in `frontend/vercel.json` → `headers` for `/(.*)`: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, and a CSP:
  ```
  default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://res.cloudinary.com; connect-src 'self' https://campus-connect-backend-4g6v.onrender.com wss://campus-connect-backend-4g6v.onrender.com; frame-src https://res.cloudinary.com; object-src 'none'; base-uri 'self'; form-action 'self'
  ```
  (If the backend URL changes in P4, update it here. Test on a Vercel **preview** first; if something breaks, ship `Content-Security-Policy-Report-Only` and note it in §13.)
- [x] **2.11 Auth token storage (B1):** replace the per-tab scheme with single keys `cc_token` and `cc_user` in localStorage. Delete `utils/tabSession.js`. On app start, remove any leftover `au_token_*` and `au_user_*` keys. Keep the Bearer-header approach (cookies across Vercel and Render are cross-site and unreliable).
- [x] **2.12 Token invalidation:** add `users.token_version INT DEFAULT 0`, include `tv` in the JWT payload, and have `protect` and the socket middleware reject tokens where `tv !== token_version`. Bump it on password change, password reset and deactivation. Keep the `JWT_EXPIRES_IN` default at `7d` and document it in the README.
- [x] **2.13 [S11] Dependencies:** remove `mysql2` and `pool`. Upgrade `nodemailer` to the latest (or remove it if only Brevo is used in prod; keep it as a devDependency for local SMTP if wanted). Run `npm audit fix` (**not** `--force`) in both apps, then bump `axios`, `react-router-dom` (stay on v6), `socket.io`/`socket.io-client` and `vite` to their latest compatible minors. Re-run `npm audit --omit=dev` and get it to **0 high/critical** in the backend.

✅ **Verify (on the dev DB):** a register request with `role:"faculty"` creates a student with `requested_role`. A non-member socket that emits a message to a private group gets nothing and receives nothing (test with two browsers). `POST /groups/<private>/join` returns 403. The 6th wrong OTP is rejected even with the right code. The 11th login attempt in 15 minutes returns 429. `curl -I` on the API shows helmet headers.

---

## Phase 3: Remaining bug fixes

- [ ] **3.1 [B2]** `ChatPage.jsx`: register **named handlers** and remove them with `socket.off(event, handler)`. Split the giant effect: one effect for connection status and presence, one for message listeners that reads `activeRoom` from a ref (so switching rooms doesn't re-register everything).
- [ ] **3.2 [B3]** The server adds `group_name` to the `new_group_message` payload (look it up once on send). `Layout` notifications skip messages where `msg.sender_id === user.id`, and skip messages for the room that's currently open in Chat.
- [ ] **3.3 [B4]** `deleteFile`: use the stored `resource_type`. For legacy rows with no `resource_type`, derive it from the `public_id` extension (raw public ids keep their extension) and fall back to trying `raw` then `image`. Write a one-off script `backend/scripts/cleanup-orphans.js` that lists Cloudinary assets in the folder with no DB row. **Dry-run by default; deleting requires `--delete` and Chitrak's OK.**
- [x] **3.4 [B5]** Clamp pagination: `page = max(1, int(page) || 1)`, `limit = min(50, max(1, int(limit) || 20))`. Apply the same pattern to messages and admin users.
- [ ] **3.5 [B6]** `GET /api/files/mine` returns your uploads with an `is_approved` status; the UI is in F5.
- [x] **3.6 [B7]** Presence: `Map<userId, { user, sockets: Set<socketId> }>`. Mark a user offline only when their last socket disconnects. Emit `online_users` debounced (≥ 1 s).
- [ ] **3.7 [B9]** Announcement notifications link to `/` (the dashboard's announcements section), or to a new `/announcements` page if one is built.
- [ ] **3.8 [B10]** `FilesPage`: a single effect keyed on `filters` and a debounced `search`.
- [ ] **3.9 [B11]** Remove the fake stats from the auth pages (the landing page shows real ones; see 5.5).
- [x] **3.10 [B12]** `updateProfile`: update only the fields present in the body (`!== undefined`), and allow empty strings to clear department and year.
- [ ] **3.11 [B14]** The group creator can't leave (return 400 "Transfer or delete the group instead"). Optionally add `POST /groups/:id/transfer { userId }`.
- [x] **3.12** `AdminPage` sends `is_active: 0/1`; send real booleans.
- [ ] **3.13** Replace every `window.confirm` with the new `ConfirmDialog` (built in 5.2).

✅ **Verify:** after visiting Chat and switching rooms 3 times, a message from another user still produces a notification. Deleting a PDF removes it from Cloudinary (check the Cloudinary console).

---

## Phase 4: Database migrations & indexes

All of this goes in `initDB()` as **idempotent** statements (`IF NOT EXISTS`). Run it on the `dev` branch first.

- [ ] **4.1 [P1] Indexes:**
  ```sql
  CREATE INDEX IF NOT EXISTS idx_messages_group_created  ON messages (group_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_messages_global_created ON messages (created_at DESC) WHERE is_global;
  CREATE INDEX IF NOT EXISTS idx_files_approved_created  ON files (is_approved, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_files_uploaded_by       ON files (uploaded_by);
  CREATE INDEX IF NOT EXISTS idx_group_members_user      ON group_members (user_id);
  CREATE INDEX IF NOT EXISTS idx_otps_user_purpose       ON otps (user_id, purpose);
  ```
- [ ] **4.2 [D2] Case-insensitive unique email.**
  1. Check: `SELECT LOWER(email), COUNT(*) FROM users GROUP BY 1 HAVING COUNT(*) > 1;` (must be empty; if not, stop and ask Chitrak).
  2. **Ask Chitrak (H4)**, then run once on production: `UPDATE users SET email = LOWER(TRIM(email));`. Put this in a script (`backend/scripts/normalize-emails.js`), **not** in `initDB`.
  3. Add `CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (LOWER(email));` to `initDB`.
- [ ] **4.3** Columns added by the other phases (collect them here so it's one tidy block): `users.requested_role`, `users.token_version`, `users.bio TEXT`, `files.resource_type`, `files.original_name`, `files.mime_type`, `files.size_bytes`, `study_groups.invite_code`, `messages.deleted_at TIMESTAMP`, `otps.code_hash`, `otps.attempts`, plus the new `bookmarks` table:
  ```sql
  CREATE TABLE IF NOT EXISTS bookmarks (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    file_id UUID REFERENCES files(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, file_id));
  ```
- [x] **4.4 [P2]** Rewrite `getStats` as one query with scalar subqueries, and add `pendingRoleRequests` to it.
- [ ] **4.5** Don't convert columns to `TIMESTAMPTZ` (a risky migration for little gain). Just make sure the frontend formats dates in local time.

✅ **Verify:** `initDB` runs twice in a row on `dev` with no errors. `EXPLAIN` on the group-messages query uses `idx_messages_group_created`.

---

## Phase 5: Design refresh (professional, same identity)

**Direction:** "modern academic." Navy and gold, generous whitespace, crisp cards, subtle depth and fast micro-interactions. Playfair Display **only** for page titles and the landing hero; DM Sans for everything else (including card titles). No gradients-on-everything, no glassmorphism, no emoji in the UI.

### 5.1 Foundations
- [ ] Split `src/index.css` (557 lines) into `src/styles/tokens.css`, `base.css`, `layout.css`, `components.css`, plus page files under `src/styles/pages/`. Import them from `main.jsx`.
- [ ] Move Google Fonts from the CSS `@import` to `<link rel="preconnect">` + `<link rel="stylesheet">` in `index.html` (P3). Drop unused weights (keep Playfair 600/700, DM Sans 400/500/600, DM Mono 400).
- [ ] **Tokens** (`tokens.css`): keep the existing raw colors, and add **semantic** tokens that components use exclusively:
  `--bg, --surface, --surface-2, --border, --text, --text-muted, --primary (navy), --primary-hover, --on-primary, --accent (gold), --accent-text (#8A6D1F, gold that passes contrast on light backgrounds), --danger, --success, --warning, --info, --focus-ring`.
  Scales: spacing `4/8/12/16/20/24/32/40/48/64`; type `12/13/14/16/18/20/24/30/36/48`; radius `6/10/14/20/999`; shadows `sm/md/lg`; z-index `dropdown 50, sticky 60, overlay 90, modal 100, toast 110`; motion `150ms/250ms` with `@media (prefers-reduced-motion: reduce)` turning it off.
- [ ] **Dark theme:** `[data-theme="dark"]` overrides only the semantic tokens (bg `#0A1628`, surface `#102038`, text `#E8ECF2`, border `rgba(255,255,255,.08)`, accent stays gold). The toggle is in F10.
- [ ] **Contrast rule:** gold `#C9A84C` must never be used as text on white (about 2.3:1). Use `--accent-text`, or gold on navy backgrounds only.

### 5.2 UI kit (`src/components/ui/`, one file + CSS each)
- [ ] `Button` (variants `primary | secondary | ghost | danger`, sizes `sm | md | lg`, `loading`, `leftIcon`, full keyboard focus ring)
- [ ] `Input`, `Textarea`, `Select` (with `label`, `hint`, `error` wired up via `aria-describedby`)
- [ ] `Card`, `Badge` (role, priority and status variants), `Avatar` (image or initials, background color hashed from the name)
- [ ] `Modal` (portal, focus trap, Esc to close, `aria-modal`, scroll lock) and `ConfirmDialog` built on it
- [ ] `EmptyState` (icon, title, text, action), `Skeleton`, `Spinner`, `Tabs`, `DropdownMenu`, `PageHeader` (title, subtitle, actions)
- [ ] `useToast` wrapper around react-hot-toast with consistent styles (success, error, info), themed for dark mode

### 5.3 App shell (`components/Layout.jsx`)
- [ ] Sidebar: logo lockup, nav groups ("Learn": Dashboard, Files; "Connect": Chat, Groups; "Admin": Admin, only for admins), active indicator (gold bar), unread badge on Chat, and the user card at the bottom.
- [ ] Top bar: page title, search trigger (`⌘K`/`Ctrl K`, F11), theme toggle, notifications bell, and an avatar dropdown (Profile, Log out).
- [ ] Mobile (< 900 px): hide the sidebar and add a **bottom tab bar** (Home, Files, Chat, Groups, Profile) plus a hamburger for the rest. Test at 375 px.
- [ ] Notification dropdown: grouped by type, relative times (`date-fns`), "Mark all read", and an empty state.

### 5.4 Replace inline styles
- [ ] There are **~273 `style={{…}}` usages** across pages. Move the static ones to classes (keep dynamic ones such as group colors). Target: **< 25** left. Do it page by page alongside 5.6–5.11 rather than as a separate pass.

### 5.5 Public landing page (new, `pages/LandingPage.jsx`)
- [ ] Route: `/` shows the **Landing page when logged out** and the Dashboard when logged in.
- [ ] Sections: **hero** (headline, one-line value prop, "Create account" + "Sign in" CTAs, and a product screenshot from `README-assets/dashboard.png` copied to `public/`), **features** (Notes & papers, Real-time chat, Study groups, Moderated by admins), **how it works** (3 steps), **live stats** from the new `GET /api/public/stats` → `{ users, files, groups }` (approved files only; cache in memory for 5 min; rate-limited), and a **footer** (GitHub link and © year).
- [ ] Mobile-first and fast: no heavy libraries.

### 5.6 Auth pages
- [ ] Keep the split layout, with real copy and no fake numbers or demo credentials.
- [ ] OTP input: 6 boxes (or one input) with `inputMode="numeric"`, `autoComplete="one-time-code"`, paste support and auto-submit at 6 digits. Add a **Resend code** button with a 60 s countdown (uses 2.4) and a "Wrong email? Go back" link.
- [ ] Register: password show/hide, a strength hint (≥ 8 chars), inline field errors, and the faculty-approval note.
- [ ] Login: "Forgot password?" link (F1), plus a banner for `?expired=1`.

### 5.7 Dashboard
- [ ] Greeting by time of day plus the user's first name; role-aware stat cards (students: my uploads, downloads of my files, groups joined; admins: platform stats and pending approvals with a link).
- [ ] Announcements list with priority badges (high = red outline), "Recent materials" (5), "My groups" (with links into Chat), skeletons while loading, and empty states.

### 5.8 Files
- [ ] Tabs: **All**, **My uploads** (F5), **Saved** (F6).
- [ ] Filter chips (type), dept and year selects, sort (Newest / Most downloaded), and a grid/list toggle (saved in localStorage).
- [ ] File card: type icon by extension, title, subject, dept/year badges, size, uploader, relative date, download count, and actions (Preview, Download, Save, Delete if allowed).
- [ ] Upload modal: drag-and-drop zone, client-side type and size checks, **progress bar** (`onUploadProgress`), and the success state "Pending approval" for students.

### 5.9 Chat
- [ ] Two-pane layout (rooms | conversation); on mobile, the room list drills into the conversation with a back button.
- [ ] Room list: Global first, then the user's groups, each with an **unread count** (client-side; reset when opened) and a last-message preview.
- [ ] Messages: own messages right-aligned in navy, others left on the surface color; consecutive messages from the same sender within 5 min are grouped; **date separators**; time on hover; role badge for faculty and admin.
- [ ] Composer: auto-growing textarea, Enter to send / Shift+Enter for a newline, 2000-char counter near the limit, disabled while disconnected.
- [ ] Connection chip ("Connecting…/Live") and typing indicator ("Priya is typing…").
- [ ] Linkify `http(s)://` URLs safely: split the text and render `<a target="_blank" rel="noopener noreferrer">`; never inject HTML.
- [ ] "Load older messages" at the top (F8) that keeps the scroll position.

### 5.10 Groups
- [ ] Cards with the color strip, lock icon for private groups, member count, "Joined" state, and Open chat / Join / Leave buttons.
- [ ] Create modal (name, description, department, private toggle). For private groups, an **invite code panel** with Copy, and a **Join with code** input on the page.
- [ ] Members modal: avatars, roles, and a Remove button for group admins (F4).

### 5.11 Profile & Admin
- [ ] Profile: avatar upload (F9), name, department, year, bio, **Change password** card (F2), and "My activity" stats.
- [ ] Admin: polished tabs (Overview, Pending files, Users, Role requests, Announcements); tables with search, pagination and row actions in a `DropdownMenu`; `ConfirmDialog` for destructive actions; file preview in the pending queue.

### 5.12 Accessibility & polish
- [ ] Every icon-only button has an `aria-label`; all form inputs have labels; there's a visible `:focus-visible` ring everywhere.
- [ ] Color contrast ≥ 4.5:1 for text in **both** themes.
- [ ] Modals and menus work fully with the keyboard.
- [ ] A real **404 page** (`path="*"`) instead of a silent redirect.
- [ ] `index.html`: Open Graph and Twitter meta, `theme-color`, and an improved favicon (keep the SVG, and add a 180 px apple-touch-icon PNG).
- [ ] Route-change: scroll to top, and set `document.title` per page ("Files · Campus Connect").

✅ **Verify:** Lighthouse (mobile) on the Vercel preview: **Accessibility ≥ 90, Best Practices ≥ 90, Performance ≥ 80** on the landing page. Manually check 375 px, 768 px and 1280 px widths in light and dark themes.

---

## Phase 6: New features

Core features (F1–F12) are in scope. Stretch features (F13–F15) are only for after Phases 1–9 are done.

- [ ] **F1 Forgot / reset password.** `POST /auth/forgot-password { email }` always returns 200 with the same message (no account enumeration) and emails a `reset` OTP (15 min). `POST /auth/reset-password { resetId, code, newPassword }` checks the attempts limit, sets the password, bumps `token_version` and returns a token. UI: a `/forgot-password` page with two steps.
- [ ] **F2 Change password** (Profile). `PUT /auth/password { currentPassword, newPassword }` bumps `token_version` and returns a fresh token (so the current session stays logged in and others are logged out).
- [ ] **F3 Faculty role requests.** The admin "Role requests" tab, built on 2.1.
- [ ] **F4 Private group management.** Invite codes (2.3), `DELETE /groups/:id/members/:userId` (group admin or site admin; can't remove the creator), and `POST /groups/:id/invite-code/rotate`.
- [ ] **F5 My uploads.** The "My uploads" tab using `GET /files/mine`, with a Pending/Approved badge. The uploader can **edit metadata** (`PUT /files/:id`: title, description, subject, type, dept, year; owner or admin).
- [ ] **F6 Saved files.** `POST /files/:id/bookmark`, `DELETE /files/:id/bookmark`, `GET /files/saved`; `getFiles` returns `is_bookmarked` via `EXISTS`.
- [ ] **F7 In-browser preview.** Images in a Modal; PDFs in an `<iframe>` of the Cloudinary URL inside a Modal (`frame-src` is already allowed in the CSP). DOC/PPT files show "Preview not available" with a Download button. The preview doesn't increment the download count. If Cloudinary serves a PDF as a download instead of rendering it in the iframe, fall back to an "Open in new tab" button and note it in §13.
- [ ] **F8 Chat history & delete.** Cursor pagination `GET /messages/global?before=<ISO>&limit=30` (same for groups). Soft delete: `DELETE /messages/:id` (sender or admin) sets `deleted_at` and the server emits `message_deleted { id, group_id }`. The UI shows "Message deleted" in italics.
- [ ] **F9 Avatar upload.** `POST /auth/avatar` (image/jpeg or png only, ≤ 2 MB). Upload to the Cloudinary folder `Jadavpur_university/avatars` with `transformation: [{ width: 256, height: 256, crop: 'fill', gravity: 'face' }]`, delete the previous avatar, and update `avatar_url`. Show the avatar everywhere a user is shown.
- [ ] **F10 Dark mode.** A toggle in the top bar; first use follows `prefers-color-scheme`; the choice is saved in `localStorage('cc_theme')`; set `data-theme` on `<html>` **before** React renders to avoid a flash. Use a tiny **external** file `public/theme-init.js` loaded with a plain `<script src="/theme-init.js"></script>` in `<head>`; an inline script would be blocked by the CSP's `script-src 'self'`.
- [ ] **F11 Quick search (`⌘K` / `Ctrl K`).** `GET /api/search?q=` returns ≤ 5 approved files (title/subject `ILIKE`) and ≤ 5 visible groups. A command-palette Modal with keyboard navigation.
- [ ] **F12 "Waking up the server" banner.** On app load, ping `/health`; if there's no response within 3 s, show a gold banner ("Starting up the server, this can take up to a minute on the free plan…") and retry with backoff until it answers.
- [ ] *(stretch)* **F13** Persistent notifications table, with read state synced across devices.
- [ ] *(stretch)* **F14** "Trending this week" on the dashboard (most downloads in the last 7 days; needs a `file_downloads` log table).
- [ ] *(stretch)* **F15** A PWA manifest and icons so the app can be "installed" on phones.

**Out of scope (don't build):** AI assistant, video calling, native mobile app, migrating auth to cookies or OAuth.

✅ **Verify:** every new endpoint has validation (2.7), auth (`protect`) and the right authorization check; a quick `curl` without a token returns 401 for each.

---

## Phase 7: Performance & code quality

- [ ] **7.1 [P3]** Route-level code splitting with `React.lazy` + `Suspense` for all pages except Landing and Login. Check `npm run build` output: the main chunk should be < 250 kB (before gzip).
- [ ] **7.2** `backend/server.js` is getting long: move the socket code to `backend/socket/index.js` (handlers + presence) and the public routes to `routes/public.js`. No behavior changes.
- [ ] **7.3** ESLint: add `"lint"` scripts to both packages and fix the errors (warnings are OK). Remove leftover debug `console.log` lines ("📩 Global messages fetched", "✅ Global message saved", etc.); keep the startup logs and error logs.
- [ ] **7.4** Render: change the build command to `npm ci` (via dashboard or MCP) once `package-lock.json` is updated.
- [ ] **7.5 [P4, needs H3]** If Chitrak approves: create a **new Render web service in the Singapore region** (free plan, same repo, rootDir `backend`, `npm ci` / `npm start`, health check `/health`), copy all env vars, deploy, verify, then point Vercel's `VITE_API_URL` (and the CSP in `vercel.json`) at it. **Suspend, don't delete,** the Oregon service until Chitrak confirms.

---

## Phase 8: Testing

- [ ] **8.1 Backend smoke tests** with `node:test` + `supertest` + `socket.io-client`, run against the **dev** Neon branch (`npm test`, needs `TEST_DATABASE_URI`). Export `app`/`server` from `server.js` without auto-listening when `require.main !== module`. Cover:
  - register with `role:"faculty"` → stored as student with `requested_role`
  - login with the wrong password → 401 JSON, no "disabled" leak
  - OTP: the 6th attempt is rejected; reusing a used OTP is rejected
  - `GET /files?limit=999&page=-3` → 200 with ≤ 50 results
  - private group: a non-member's join → 403; members list → 403; a socket that isn't a member never receives a group message
  - upload of a `.exe` renamed `.pdf` with mime `application/x-msdownload` → 400
  - admin can't demote themselves
- [ ] **8.2** `npm run build` for the frontend passes with no warnings about missing env.
- [ ] **8.3** Run the **manual QA checklist** (§11) on the Vercel preview, pointed at the dev backend if possible, or on local.

---

## Phase 9: Deploy (Render + Vercel + Neon)

Order matters. Tick each step.

- [ ] **9.1** Confirm `backup-pre-v2` exists on Neon (0.3).
- [ ] **9.2 Render env vars** (service `srv-d8vsgaurnols73e3e9u0`, or the new Singapore one): add or update `NODE_ENV=production`, `CLIENT_URLS=https://campus-connect-five-zeta.vercel.app` (comma-separated; add a custom domain later if there is one), `BREVO_API_KEY` (from H2), `MAIL_FROM`, `MAIL_FROM_NAME=Campus Connect`, and optionally `ALLOWED_EMAIL_DOMAINS`. Keep `DATABASE_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN` and the `CLOUDINARY_*` vars as they are. **Set the health check path to `/health`.**
- [ ] **9.3 Vercel settings** (project `prj_J0tXIAWlrEdNGYL3W6u5mr8L4xWY`): set the Framework Preset to **Vite** (B15) and confirm Root Directory = `frontend`, Build = `npm run build`, Output = `dist`. Keep `VITE_API_URL` pointing at the backend `/api` URL. Optionally add `VITE_SOCKET_URL`.
- [ ] **9.4** Open a PR `improve/v2 → main` on GitHub with a summary of the phases and task IDs. Check the Vercel **preview** build for the PR: it builds, routes load, and the CSP doesn't block anything (check the browser console).
- [ ] **9.5** Run the email normalization script (4.2) on production **only after H4 approval**.
- [ ] **9.6** Merge the PR into `main`. This triggers Render and Vercel production deploys. Watch the Render deploy logs for `initDB` errors and the Vercel build logs.
- [ ] **9.7 Post-deploy checks on production:**
  - [ ] `GET https://<backend>/health` → `{"status":"ok"}`
  - [ ] Open `/files` directly and refresh → loads (C2)
  - [ ] Register a new test account and **receive the OTP email** (C3)
  - [ ] Chat between two browsers is live, typing indicator works, presence works (C1)
  - [ ] Upload a PDF as a student → pending → approve as admin → preview → download → delete, and it's gone from Cloudinary (B4)
  - [ ] Private group isolation (S2/S3) with two accounts
  - [ ] No console errors and no CSP violations
- [ ] **9.8 Rollback plan (if something is badly broken):** Vercel → *Instant Rollback* to deployment `dpl_5ughyaipGV7nXKpG9qw7PF5ocXZg`; Render → roll back to the previous deploy; DB → the new columns and indexes are additive and harmless, and the backup branch exists if data was damaged.
- [ ] **9.9** Delete the test accounts created during QA (ask Chitrak first).

---

## Phase 10: Documentation

- [ ] **10.1** Update `README.md`: features (new ones), live demo link (`https://campus-connect-five-zeta.vercel.app`), the env var table (§12), the architecture diagram (add Brevo, remove Gmail SMTP for prod), setup steps (Neon dev branch, `npm test`), and new screenshots of the redesigned pages (replace `README-assets/*.png`). Remove the "Future Improvements" items that are now done.
- [ ] **10.2** Add `SECURITY.md` with a short summary of the protections (rate limits, OTP policy, role approval, upload validation) and how to report issues.
- [ ] **10.3** Tick the remaining boxes in this file, and fill in §13 and the summary at the bottom.

---

## 11. Manual QA checklist (run in Phase 8.3 and again after 9.6)

Viewports: 375 px (phone), 768 px (tablet), 1280 px (laptop). Both themes.

- [ ] Landing page: real stats, CTAs work, no layout shift
- [ ] Register (student), register (faculty request), OTP resend countdown, wrong OTP ×6 lockout
- [ ] Login, wrong password (no reload), forgot password end-to-end, change password logs out the other browser
- [ ] New tab stays logged in (B1); logout clears everything
- [ ] Dashboard for a student vs an admin
- [ ] Files: filters, sort, search, grid/list, upload with progress, preview PDF/image, save/unsave, my uploads with status, edit metadata, delete
- [ ] Chat: global + group, unread badges, load older, delete own message, linkified URLs, 2000-char limit, Enter vs Shift+Enter, disconnect/reconnect chip
- [ ] Groups: create public/private, invite code copy and join by code, remove member, creator can't leave, delete group
- [ ] Profile: avatar upload, bio, clear department
- [ ] Admin: approve/reject file, approve faculty request, user search and pagination, can't demote self, announcements create/delete
- [ ] Keyboard-only: tab through the login form, open and close a modal with Esc, use ⌘K search
- [ ] 404 page for `/nope`

---

## 12. Environment variables

| Var | Where | Notes |
|---|---|---|
| `DATABASE_URI` | Render, local | Neon connection string (local → `dev` branch) |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Render, local | unchanged |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Render, local | unchanged |
| `CLIENT_URLS` | Render | comma-separated allowed origins (replaces `CLIENT_URL`, which stays as a fallback) |
| `NODE_ENV` | Render | `production` |
| `BREVO_API_KEY`, `MAIL_FROM`, `MAIL_FROM_NAME` | Render | HTTPS email (C3) |
| `SMTP_HOST/PORT/USER/PASS` | local only (optional) | nodemailer for local testing |
| `ALLOWED_EMAIL_DOMAINS` | Render (optional) | e.g. `jadavpuruniversity.in`; empty = allow all |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | local only | for `seed.js` (refuses to run in production) |
| `TEST_DATABASE_URI` | local only | dev-branch URL for `npm test` |
| `PORT` | Render sets it | default 5001 locally |
| `VITE_API_URL` | Vercel, local | prod: `https://<backend>/api`; local: `/api` |
| `VITE_SOCKET_URL` | Vercel (optional) | defaults to the origin of `VITE_API_URL` |

---

## 13. Notes / Deviations log (implementing agent fills this in)

| Date | Task | What changed vs plan, and why |
|---|---|---|
| 2026-11-20 | 0.7 | Backend verified against Neon `dev` (health + login 401 JSON). Frontend dev server not launched in a browser; verified via build in Phase 1. |
| 2026-11-20 | 1.7 | On a non-auth 401 the app clears auth and dispatches `auth:logout`; `AuthContext` sets `user=null` and the route guard redirects to `/login` (no hard reload). The `?expired=1` param is not added yet; the banner belongs to 5.6. |
| 2026-11-20 | 1.3 | Brevo path coded but untested (needs H2 key). Locally the SMTP vars in `.env` are used. Dev console fallback exists for when nothing is configured. |
| 2026-11-20 | 1.4 | `rejectUnauthorized: true` works against Neon dev. |
| 2026-11-20 | Phase 1 verify | Verified: backend boots, JSON 404, multer limit maps to 413 (isolated test), frontend `npm run build` passes. NOT yet verified: two-browser chat, `vite preview` on `/files`, wrong-password toast, single Verify request, real 60 MB upload. Needs a browser session. |
| 2026-11-20 | 2.x verify | Ran a 27-check script against Neon `dev` (faculty request, OTP 5-attempt lockout, resend cooldown, private-group join/members 403, socket isolation incl. old `join_groups` attack, self-demote block, role approve, deactivate invalidates token, files clamp, fake-pdf 400, helmet headers, 429 on login spam): all PASS. Script lived in scratchpad (not committed); becomes real tests in 8.1. |
| 2026-11-20 | 2.2 | `removeMember` socket-leave is not wired yet because that endpoint is F4 (Phase 6). |
| 2026-11-20 | 2.10 | CSP/headers written but NOT tested on a Vercel preview yet (done in 9.4). If anything breaks, switch to `Content-Security-Policy-Report-Only`. |
| 2026-11-20 | 2.12 | `token_version` checked in `protect` + socket auth, bumped on deactivation. Bumps for password change/reset come with F1/F2. Tokens issued before this change (no `tv`) count as version 0, so existing sessions stay valid. |
| 2026-11-20 | 2.13 | Backend `npm audit --omit=dev`: 0 high/critical; 2 moderate left (`uuid` <11.1.1: only v3/v5/v6 with a `buf` arg is affected; we only call `v4()`). Frontend: 2 moderate left (`react-router` v6 line; fix needs v7, which the plan rules out). `@vitejs/plugin-react` kept on ^4 because 6.x needs Vite 8. Vite is now ^6. `@nextui-org/react` is in frontend deps but unused by `src`; left in place (not in plan), worth removing later. |
| 2026-11-20 | 2.9 | Email domain restriction (`ALLOWED_EMAIL_DOMAINS`) implemented in `register` only (H5 still open: empty = allow all). |
| 2026-11-20 | 3.x early | Done while rewriting the same code: 3.4, 3.6, 3.10, 3.12, 4.4. `group_name` added to group messages (part of 3.2); Layout notification filtering (own messages / open room) still TODO. |
| 2026-11-20 | 0.2/0.3 | Neon branches created: `dev` (br-polished-union-aoj9t0mv), `backup-pre-v2` (br-round-frost-ao8u3kmu, no compute). |

## Progress summary (update at the end of each phase)

- Phase 0: ☑ (0.7 partial)  Phase 1: ◐ (code done, browser verify pending)  Phase 2: ☑ (CSP untested on Vercel)  Phase 3: ☐  Phase 4: ☐  Phase 5: ☐
- Phase 6: ☐  Phase 7: ☐  Phase 8: ☐  Phase 9: ☐  Phase 10: ☐
