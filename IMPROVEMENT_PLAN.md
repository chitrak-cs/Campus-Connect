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

- [x] **H1 (done 2026-11-20): check the admin password.** The login page publicly shows `admin@Jadavpur.ac.in / admin123`, and `seed.js` creates that account. Production has exactly one admin. Try logging in on the live site with those credentials. **If it works, anyone can be admin.** Change it right away:
  1. `cd backend && node -e "console.log(require('bcryptjs').hashSync('YOUR-NEW-STRONG-PASSWORD', 12))"`
  2. In the Neon SQL editor (production branch): `UPDATE users SET password = '<hash from step 1>' WHERE role = 'admin';`
- [x] **H2 (done 2026-11-20): create a transactional email account** with an HTTPS API (recommended: **Brevo**, which can send from a verified single sender such as your Gmail without owning a domain; alternative: Resend, which needs a domain). Verify the sender address, create an API key and add it to Render as `BREVO_API_KEY` (Task C3).
- [x] **H3 (decided 2026-11-20: YES, move to Singapore): decide on the backend region** (Task P4): move Render from Oregon to Singapore so it sits next to the database? (Recommended. It's free, but it means creating a new Render service.)
- [ ] **H4: approve the one-time email lower-casing UPDATE** on production (Task D2).
- [x] **H5 (decided 2026-11-20: allow all email domains; leave `ALLOWED_EMAIL_DOMAINS` unset):** optional. Should registration be restricted to university email domains? If yes, give the domain(s) for `ALLOWED_EMAIL_DOMAINS` (Task S9).
- [x] **H6 (done, Vercel MCP access works):** when the agent asks, approve the Vercel team-access link (Vercel's MCP needs a per-session grant).

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
- [x] **0.7** Run both apps locally (`npm run dev` in each) and confirm login works against the `dev` branch.

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

- [x] **3.1 [B2]** `ChatPage.jsx`: register **named handlers** and remove them with `socket.off(event, handler)`. Split the giant effect: one effect for connection status and presence, one for message listeners that reads `activeRoom` from a ref (so switching rooms doesn't re-register everything).
- [x] **3.2 [B3]** The server adds `group_name` to the `new_group_message` payload (look it up once on send). `Layout` notifications skip messages where `msg.sender_id === user.id`, and skip messages for the room that's currently open in Chat.
- [x] **3.3 [B4]** `deleteFile`: use the stored `resource_type`. For legacy rows with no `resource_type`, derive it from the `public_id` extension (raw public ids keep their extension) and fall back to trying `raw` then `image`. Write a one-off script `backend/scripts/cleanup-orphans.js` that lists Cloudinary assets in the folder with no DB row. **Dry-run by default; deleting requires `--delete` and Chitrak's OK.**
- [x] **3.4 [B5]** Clamp pagination: `page = max(1, int(page) || 1)`, `limit = min(50, max(1, int(limit) || 20))`. Apply the same pattern to messages and admin users.
- [x] **3.5 [B6]** `GET /api/files/mine` returns your uploads with an `is_approved` status; the UI is in F5.
- [x] **3.6 [B7]** Presence: `Map<userId, { user, sockets: Set<socketId> }>`. Mark a user offline only when their last socket disconnects. Emit `online_users` debounced (≥ 1 s).
- [x] **3.7 [B9]** Announcement notifications link to `/` (the dashboard's announcements section), or to a new `/announcements` page if one is built.
- [x] **3.8 [B10]** `FilesPage`: a single effect keyed on `filters` and a debounced `search`.
- [x] **3.9 [B11]** Remove the fake stats from the auth pages (the landing page shows real ones; see 5.5).
- [x] **3.10 [B12]** `updateProfile`: update only the fields present in the body (`!== undefined`), and allow empty strings to clear department and year.
- [x] **3.11 [B14]** The group creator can't leave (return 400 "Transfer or delete the group instead"). Optionally add `POST /groups/:id/transfer { userId }`.
- [x] **3.12** `AdminPage` sends `is_active: 0/1`; send real booleans.
- [x] **3.13** Replace every `window.confirm` with the new `ConfirmDialog` (built in 5.2).

✅ **Verify:** after visiting Chat and switching rooms 3 times, a message from another user still produces a notification. Deleting a PDF removes it from Cloudinary (check the Cloudinary console).

---

## Phase 4: Database migrations & indexes

All of this goes in `initDB()` as **idempotent** statements (`IF NOT EXISTS`). Run it on the `dev` branch first.

- [x] **4.1 [P1] Indexes:**
  ```sql
  CREATE INDEX IF NOT EXISTS idx_messages_group_created  ON messages (group_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_messages_global_created ON messages (created_at DESC) WHERE is_global;
  CREATE INDEX IF NOT EXISTS idx_files_approved_created  ON files (is_approved, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_files_uploaded_by       ON files (uploaded_by);
  CREATE INDEX IF NOT EXISTS idx_group_members_user      ON group_members (user_id);
  CREATE INDEX IF NOT EXISTS idx_otps_user_purpose       ON otps (user_id, purpose);
  ```
- [~] **4.2 [D2] Case-insensitive unique email.**
  1. Check: `SELECT LOWER(email), COUNT(*) FROM users GROUP BY 1 HAVING COUNT(*) > 1;` (must be empty; if not, stop and ask Chitrak).
  2. **Ask Chitrak (H4)**, then run once on production: `UPDATE users SET email = LOWER(TRIM(email));`. Put this in a script (`backend/scripts/normalize-emails.js`), **not** in `initDB`.
  3. Add `CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (LOWER(email));` to `initDB`.
- [x] **4.3** Columns added by the other phases (collect them here so it's one tidy block): `users.requested_role`, `users.token_version`, `users.bio TEXT`, `files.resource_type`, `files.original_name`, `files.mime_type`, `files.size_bytes`, `study_groups.invite_code`, `messages.deleted_at TIMESTAMP`, `otps.code_hash`, `otps.attempts`, plus the new `bookmarks` table:
  ```sql
  CREATE TABLE IF NOT EXISTS bookmarks (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    file_id UUID REFERENCES files(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, file_id));
  ```
- [x] **4.4 [P2]** Rewrite `getStats` as one query with scalar subqueries, and add `pendingRoleRequests` to it.
- [x] **4.5** Don't convert columns to `TIMESTAMPTZ` (a risky migration for little gain). Just make sure the frontend formats dates in local time.

✅ **Verify:** `initDB` runs twice in a row on `dev` with no errors. `EXPLAIN` on the group-messages query uses `idx_messages_group_created`.

---

## Phase 5: Design refresh (professional, same identity)

**Direction:** "modern academic." Navy and gold, generous whitespace, crisp cards, subtle depth and fast micro-interactions. Playfair Display **only** for page titles and the landing hero; DM Sans for everything else (including card titles). No gradients-on-everything, no glassmorphism, no emoji in the UI.

### 5.1 Foundations
- [x] Split `src/index.css` (557 lines) into `src/styles/tokens.css`, `base.css`, `layout.css`, `components.css`, plus page files under `src/styles/pages/`. Import them from `main.jsx`.
- [x] Move Google Fonts from the CSS `@import` to `<link rel="preconnect">` + `<link rel="stylesheet">` in `index.html` (P3). Drop unused weights (keep Playfair 600/700, DM Sans 400/500/600, DM Mono 400).
- [x] **Tokens** (`tokens.css`): keep the existing raw colors, and add **semantic** tokens that components use exclusively:
  `--bg, --surface, --surface-2, --border, --text, --text-muted, --primary (navy), --primary-hover, --on-primary, --accent (gold), --accent-text (#8A6D1F, gold that passes contrast on light backgrounds), --danger, --success, --warning, --info, --focus-ring`.
  Scales: spacing `4/8/12/16/20/24/32/40/48/64`; type `12/13/14/16/18/20/24/30/36/48`; radius `6/10/14/20/999`; shadows `sm/md/lg`; z-index `dropdown 50, sticky 60, overlay 90, modal 100, toast 110`; motion `150ms/250ms` with `@media (prefers-reduced-motion: reduce)` turning it off.
- [x] **Dark theme:** `[data-theme="dark"]` overrides only the semantic tokens (bg `#0A1628`, surface `#102038`, text `#E8ECF2`, border `rgba(255,255,255,.08)`, accent stays gold). The toggle is in F10.
- [x] **Contrast rule:** gold `#C9A84C` must never be used as text on white (about 2.3:1). Use `--accent-text`, or gold on navy backgrounds only.

### 5.2 UI kit (`src/components/ui/`, one file + CSS each)
- [x] `Button` (variants `primary | secondary | ghost | danger`, sizes `sm | md | lg`, `loading`, `leftIcon`, full keyboard focus ring)
- [x] `Input`, `Textarea`, `Select` (with `label`, `hint`, `error` wired up via `aria-describedby`)
- [x] `Card`, `Badge` (role, priority and status variants), `Avatar` (image or initials, background color hashed from the name)
- [x] `Modal` (portal, focus trap, Esc to close, `aria-modal`, scroll lock) and `ConfirmDialog` built on it
- [x] `EmptyState` (icon, title, text, action), `Skeleton`, `Spinner`, `Tabs`, `DropdownMenu`, `PageHeader` (title, subtitle, actions)
- [x] `useToast` wrapper around react-hot-toast with consistent styles (success, error, info), themed for dark mode

### 5.3 App shell (`components/Layout.jsx`)
- [x] Sidebar: logo lockup, nav groups ("Learn": Dashboard, Files; "Connect": Chat, Groups; "Admin": Admin, only for admins), active indicator (gold bar), unread badge on Chat, and the user card at the bottom.
- [x] Top bar: page title, search trigger (`⌘K`/`Ctrl K`, F11), theme toggle, notifications bell, and an avatar dropdown (Profile, Log out).
- [x] Mobile (< 900 px): hide the sidebar and add a **bottom tab bar** (Home, Files, Chat, Groups, Profile) plus a hamburger for the rest. Test at 375 px.
- [x] Notification dropdown: grouped by type, relative times (`date-fns`), "Mark all read", and an empty state.

### 5.4 Replace inline styles
- [x] There are **~273 `style={{…}}` usages** across pages. Move the static ones to classes (keep dynamic ones such as group colors). Target: **< 25** left. Do it page by page alongside 5.6–5.11 rather than as a separate pass.

### 5.5 Public landing page (new, `pages/LandingPage.jsx`)
- [x] Route: `/` shows the **Landing page when logged out** and the Dashboard when logged in.
- [x] Sections: **hero** (headline, one-line value prop, "Create account" + "Sign in" CTAs, and a product screenshot from `README-assets/dashboard.png` copied to `public/`), **features** (Notes & papers, Real-time chat, Study groups, Moderated by admins), **how it works** (3 steps), **live stats** from the new `GET /api/public/stats` → `{ users, files, groups }` (approved files only; cache in memory for 5 min; rate-limited), and a **footer** (GitHub link and © year).
- [x] Mobile-first and fast: no heavy libraries.

### 5.6 Auth pages
- [x] Keep the split layout, with real copy and no fake numbers or demo credentials.
- [x] OTP input: 6 boxes (or one input) with `inputMode="numeric"`, `autoComplete="one-time-code"`, paste support and auto-submit at 6 digits. Add a **Resend code** button with a 60 s countdown (uses 2.4) and a "Wrong email? Go back" link.
- [x] Register: password show/hide, a strength hint (≥ 8 chars), inline field errors, and the faculty-approval note.
- [x] Login: "Forgot password?" link (F1), plus a banner for `?expired=1`.

### 5.7 Dashboard
- [x] Greeting by time of day plus the user's first name; role-aware stat cards (students: my uploads, downloads of my files, groups joined; admins: platform stats and pending approvals with a link).
- [x] Announcements list with priority badges (high = red outline), "Recent materials" (5), "My groups" (with links into Chat), skeletons while loading, and empty states.

### 5.8 Files
- [x] Tabs: **All**, **My uploads** (F5), **Saved** (F6).
- [x] Filter chips (type), dept and year selects, sort (Newest / Most downloaded), and a grid/list toggle (saved in localStorage).
- [x] File card: type icon by extension, title, subject, dept/year badges, size, uploader, relative date, download count, and actions (Preview, Download, Save, Delete if allowed).
- [x] Upload modal: drag-and-drop zone, client-side type and size checks, **progress bar** (`onUploadProgress`), and the success state "Pending approval" for students.

### 5.9 Chat
- [x] Two-pane layout (rooms | conversation); on mobile, the room list drills into the conversation with a back button.
- [x] Room list: Global first, then the user's groups, each with an **unread count** (client-side; reset when opened) and a last-message preview.
- [x] Messages: own messages right-aligned in navy, others left on the surface color; consecutive messages from the same sender within 5 min are grouped; **date separators**; time on hover; role badge for faculty and admin.
- [x] Composer: auto-growing textarea, Enter to send / Shift+Enter for a newline, 2000-char counter near the limit, disabled while disconnected.
- [x] Connection chip ("Connecting…/Live") and typing indicator ("Priya is typing…").
- [x] Linkify `http(s)://` URLs safely: split the text and render `<a target="_blank" rel="noopener noreferrer">`; never inject HTML.
- [x] "Load older messages" at the top (F8) that keeps the scroll position.

### 5.10 Groups
- [x] Cards with the color strip, lock icon for private groups, member count, "Joined" state, and Open chat / Join / Leave buttons.
- [x] Create modal (name, description, department, private toggle). For private groups, an **invite code panel** with Copy, and a **Join with code** input on the page.
- [x] Members modal: avatars, roles, and a Remove button for group admins (F4).

### 5.11 Profile & Admin
- [x] Profile: avatar upload (F9), name, department, year, bio, **Change password** card (F2), and "My activity" stats.
- [x] Admin: polished tabs (Overview, Pending files, Users, Role requests, Announcements); tables with search, pagination and row actions in a `DropdownMenu`; `ConfirmDialog` for destructive actions; file preview in the pending queue.

### 5.12 Accessibility & polish
- [x] Every icon-only button has an `aria-label`; all form inputs have labels; there's a visible `:focus-visible` ring everywhere.
- [x] Color contrast ≥ 4.5:1 for text in **both** themes.
- [x] Modals and menus work fully with the keyboard.
- [x] A real **404 page** (`path="*"`) instead of a silent redirect.
- [x] `index.html`: Open Graph and Twitter meta, `theme-color`, and an improved favicon (keep the SVG, and add a 180 px apple-touch-icon PNG).
- [x] Route-change: scroll to top, and set `document.title` per page ("Files · Campus Connect").

✅ **Verify:** Lighthouse (mobile) on the Vercel preview: **Accessibility ≥ 90, Best Practices ≥ 90, Performance ≥ 80** on the landing page. Manually check 375 px, 768 px and 1280 px widths in light and dark themes.

---

## Phase 6: New features

Core features (F1–F12) are in scope. Stretch features (F13–F15) are only for after Phases 1–9 are done.

- [x] **F1 Forgot / reset password.** `POST /auth/forgot-password { email }` always returns 200 with the same message (no account enumeration) and emails a `reset` OTP (15 min). `POST /auth/reset-password { resetId, code, newPassword }` checks the attempts limit, sets the password, bumps `token_version` and returns a token. UI: a `/forgot-password` page with two steps.
- [x] **F2 Change password** (Profile). `PUT /auth/password { currentPassword, newPassword }` bumps `token_version` and returns a fresh token (so the current session stays logged in and others are logged out).
- [x] **F3 Faculty role requests.** The admin "Role requests" tab, built on 2.1.
- [x] **F4 Private group management.** Invite codes (2.3), `DELETE /groups/:id/members/:userId` (group admin or site admin; can't remove the creator), and `POST /groups/:id/invite-code/rotate`.
- [x] **F5 My uploads.** The "My uploads" tab using `GET /files/mine`, with a Pending/Approved badge. The uploader can **edit metadata** (`PUT /files/:id`: title, description, subject, type, dept, year; owner or admin).
- [x] **F6 Saved files.** `POST /files/:id/bookmark`, `DELETE /files/:id/bookmark`, `GET /files/saved`; `getFiles` returns `is_bookmarked` via `EXISTS`.
- [x] **F7 In-browser preview.** Images in a Modal; PDFs in an `<iframe>` of the Cloudinary URL inside a Modal (`frame-src` is already allowed in the CSP). DOC/PPT files show "Preview not available" with a Download button. The preview doesn't increment the download count. If Cloudinary serves a PDF as a download instead of rendering it in the iframe, fall back to an "Open in new tab" button and note it in §13.
- [x] **F8 Chat history & delete.** Cursor pagination `GET /messages/global?before=<ISO>&limit=30` (same for groups). Soft delete: `DELETE /messages/:id` (sender or admin) sets `deleted_at` and the server emits `message_deleted { id, group_id }`. The UI shows "Message deleted" in italics.
- [x] **F9 Avatar upload.** `POST /auth/avatar` (image/jpeg or png only, ≤ 2 MB). Upload to the Cloudinary folder `Jadavpur_university/avatars` with `transformation: [{ width: 256, height: 256, crop: 'fill', gravity: 'face' }]`, delete the previous avatar, and update `avatar_url`. Show the avatar everywhere a user is shown.
- [x] **F10 Dark mode.** A toggle in the top bar; first use follows `prefers-color-scheme`; the choice is saved in `localStorage('cc_theme')`; set `data-theme` on `<html>` **before** React renders to avoid a flash. Use a tiny **external** file `public/theme-init.js` loaded with a plain `<script src="/theme-init.js"></script>` in `<head>`; an inline script would be blocked by the CSP's `script-src 'self'`.
- [x] **F11 Quick search (`⌘K` / `Ctrl K`).** `GET /api/search?q=` returns ≤ 5 approved files (title/subject `ILIKE`) and ≤ 5 visible groups. A command-palette Modal with keyboard navigation.
- [x] **F12 "Waking up the server" banner.** On app load, ping `/health`; if there's no response within 3 s, show a gold banner ("Starting up the server, this can take up to a minute on the free plan…") and retry with backoff until it answers.
- [ ] *(stretch)* **F13** Persistent notifications table, with read state synced across devices.
- [ ] *(stretch)* **F14** "Trending this week" on the dashboard (most downloads in the last 7 days; needs a `file_downloads` log table).
- [ ] *(stretch)* **F15** A PWA manifest and icons so the app can be "installed" on phones.

**Out of scope (don't build):** AI assistant, video calling, native mobile app, migrating auth to cookies or OAuth.

✅ **Verify:** every new endpoint has validation (2.7), auth (`protect`) and the right authorization check; a quick `curl` without a token returns 401 for each.

---

## Phase 7: Performance & code quality

- [x] **7.1 [P3]** Route-level code splitting with `React.lazy` + `Suspense` for all pages except Landing and Login. Check `npm run build` output: the main chunk should be < 250 kB (before gzip).
- [x] **7.2** `backend/server.js` is getting long: move the socket code to `backend/socket/index.js` (handlers + presence) and the public routes to `routes/public.js`. No behavior changes.
- [x] **7.3** ESLint: add `"lint"` scripts to both packages and fix the errors (warnings are OK). Remove leftover debug `console.log` lines ("📩 Global messages fetched", "✅ Global message saved", etc.); keep the startup logs and error logs.
- [~] **7.4** Render: change the build command to `npm ci` (via dashboard or MCP) once `package-lock.json` is updated.
- [x] **7.5 [P4, needs H3]** If Chitrak approves: create a **new Render web service in the Singapore region** (free plan, same repo, rootDir `backend`, `npm ci` / `npm start`, health check `/health`), copy all env vars, deploy, verify, then point Vercel's `VITE_API_URL` (and the CSP in `vercel.json`) at it. **Suspend, don't delete,** the Oregon service until Chitrak confirms.

---

## Phase 8: Testing

- [x] **8.1 Backend smoke tests** with `node:test` + `supertest` + `socket.io-client`, run against the **dev** Neon branch (`npm test`, needs `TEST_DATABASE_URI`). Export `app`/`server` from `server.js` without auto-listening when `require.main !== module`. Cover:
  - register with `role:"faculty"` → stored as student with `requested_role`
  - login with the wrong password → 401 JSON, no "disabled" leak
  - OTP: the 6th attempt is rejected; reusing a used OTP is rejected
  - `GET /files?limit=999&page=-3` → 200 with ≤ 50 results
  - private group: a non-member's join → 403; members list → 403; a socket that isn't a member never receives a group message
  - upload of a `.exe` renamed `.pdf` with mime `application/x-msdownload` → 400
  - admin can't demote themselves
- [x] **8.2** `npm run build` for the frontend passes with no warnings about missing env.
- [x] **8.3** Run the **manual QA checklist** (§11) on the Vercel preview, pointed at the dev backend if possible, or on local.

---

## Phase 9: Deploy (Render + Vercel + Neon)

Order matters. Tick each step.

- [x] **9.1** Confirm `backup-pre-v2` exists on Neon (0.3).
- [x] **9.2 Render env vars** (service `srv-d8vsgaurnols73e3e9u0`, or the new Singapore one): add or update `NODE_ENV=production`, `CLIENT_URLS=https://campus-connect-five-zeta.vercel.app` (comma-separated; add a custom domain later if there is one), `BREVO_API_KEY` (from H2), `MAIL_FROM`, `MAIL_FROM_NAME=Campus Connect`, and optionally `ALLOWED_EMAIL_DOMAINS`. Keep `DATABASE_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN` and the `CLOUDINARY_*` vars as they are. **Set the health check path to `/health`.**
- [x] **9.3 Vercel settings** (project `prj_J0tXIAWlrEdNGYL3W6u5mr8L4xWY`): set the Framework Preset to **Vite** (B15) and confirm Root Directory = `frontend`, Build = `npm run build`, Output = `dist`. Keep `VITE_API_URL` pointing at the backend `/api` URL. Optionally add `VITE_SOCKET_URL`.
- [x] **9.4** Open a PR `improve/v2 → main` on GitHub with a summary of the phases and task IDs. Check the Vercel **preview** build for the PR: it builds, routes load, and the CSP doesn't block anything (check the browser console).
- [x] **9.5** Run the email normalization script (4.2) on production **only after H4 approval**.
- [x] **9.6** Merge the PR into `main`. This triggers Render and Vercel production deploys. Watch the Render deploy logs for `initDB` errors and the Vercel build logs.
- [~] **9.7 Post-deploy checks on production:**
  - [ ] `GET https://<backend>/health` → `{"status":"ok"}`
  - [ ] Open `/files` directly and refresh → loads (C2)
  - [ ] Register a new test account and **receive the OTP email** (C3)
  - [ ] Chat between two browsers is live, typing indicator works, presence works (C1)
  - [ ] Upload a PDF as a student → pending → approve as admin → preview → download → delete, and it's gone from Cloudinary (B4)
  - [ ] Private group isolation (S2/S3) with two accounts
  - [ ] No console errors and no CSP violations
- [x] **9.8 Rollback plan (if something is badly broken):** Vercel → *Instant Rollback* to deployment `dpl_5ughyaipGV7nXKpG9qw7PF5ocXZg`; Render → roll back to the previous deploy; DB → the new columns and indexes are additive and harmless, and the backup branch exists if data was damaged.
- [ ] **9.9** Delete the test accounts created during QA (ask Chitrak first).

---

## Phase 10: Documentation

- [x] **10.1** Update `README.md`: features (new ones), live demo link (`https://campus-connect-five-zeta.vercel.app`), the env var table (§12), the architecture diagram (add Brevo, remove Gmail SMTP for prod), setup steps (Neon dev branch, `npm test`), and new screenshots of the redesigned pages (replace `README-assets/*.png`). Remove the "Future Improvements" items that are now done.
- [x] **10.2** Add `SECURITY.md` with a short summary of the protections (rate limits, OTP policy, role approval, upload validation) and how to report issues.
- [ ] **10.3** Tick the remaining boxes in this file, and fill in §13 and the summary at the bottom.

---

## 11. Manual QA checklist (run in Phase 8.3 and again after 9.6)

Viewports: 375 px (phone), 768 px (tablet), 1280 px (laptop). Both themes.

- [x] Landing page: real stats, CTAs work, no layout shift
- [x] Register (student), register (faculty request), OTP resend countdown, wrong OTP ×6 lockout
- [x] Login, wrong password (no reload), forgot password end-to-end, change password logs out the other browser
- [x] New tab stays logged in (B1); logout clears everything
- [x] Dashboard for a student vs an admin
- [x] Files: filters, sort, search, grid/list, upload with progress, preview PDF/image, save/unsave, my uploads with status, edit metadata, delete
- [x] Chat: global + group, unread badges, load older, delete own message, linkified URLs, 2000-char limit, Enter vs Shift+Enter, disconnect/reconnect chip
- [x] Groups: create public/private, invite code copy and join by code, remove member, creator can't leave, delete group
- [x] Profile: avatar upload, bio, clear department
- [x] Admin: approve/reject file, approve faculty request, user search and pagination, can't demote self, announcements create/delete
- [x] Keyboard-only: tab through the login form, open and close a modal with Esc, use ⌘K search
- [x] 404 page for `/nope`

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
| 2026-11-20 | Phase 1 verify | Verified: backend boots, JSON 404, multer limit maps to 413 (isolated test), frontend `npm run build` passes. Since verified in-browser: wrong-password toast, chat delivery. Still not verified: `vite preview` on `/files`, single Verify request, real 60 MB upload. |
| 2026-11-20 | 2.x verify | Ran a 27-check script against Neon `dev` (faculty request, OTP 5-attempt lockout, resend cooldown, private-group join/members 403, socket isolation incl. old `join_groups` attack, self-demote block, role approve, deactivate invalidates token, files clamp, fake-pdf 400, helmet headers, 429 on login spam): all PASS. Script lived in scratchpad (not committed); becomes real tests in 8.1. |
| 2026-11-20 | 2.2 | `removeMember` socket-leave is not wired yet because that endpoint is F4 (Phase 6). |
| 2026-11-20 | 2.10 | CSP/headers written but NOT tested on a Vercel preview yet (done in 9.4). If anything breaks, switch to `Content-Security-Policy-Report-Only`. |
| 2026-11-20 | 2.12 | `token_version` checked in `protect` + socket auth, bumped on deactivation. Bumps for password change/reset come with F1/F2. Tokens issued before this change (no `tv`) count as version 0, so existing sessions stay valid. |
| 2026-11-20 | 2.13 | Backend `npm audit --omit=dev`: 0 high/critical; 2 moderate left (`uuid` <11.1.1: only v3/v5/v6 with a `buf` arg is affected; we only call `v4()`). Frontend: 2 moderate left (`react-router` v6 line; fix needs v7, which the plan rules out). `@vitejs/plugin-react` kept on ^4 because 6.x needs Vite 8. Vite is now ^6. `@nextui-org/react` is in frontend deps but unused by `src`; left in place (not in plan), worth removing later. |
| 2026-11-20 | 2.9 | Email domain restriction (`ALLOWED_EMAIL_DOMAINS`) implemented in `register` only (H5 still open: empty = allow all). |
| 2026-11-20 | 3.x early | Done while rewriting the same code: 3.4, 3.6, 3.10, 3.12, 4.4. `group_name` added to group messages (part of 3.2); Layout notification filtering (own messages / open room) still TODO. |
| 2026-11-20 | 3.x verify | In the browser (Vite dev + backend on Neon `dev`): wrong password shows toast with no reload (C7); logged-out `/files` redirects to `/login`, login persists across reload; message from another user shows live in the open room with no notification (3.2), and after visiting Chat + switching rooms a new message still notifies (B2). `/files/mine` and creator-can't-leave (3.11) verified over HTTP. |
| 2026-11-20 | 3.x bug found | Found and fixed two regressions from my own Phase 2 socket code: (1) handlers were registered after an `await`, so events sent right after connect were dropped (now registered synchronously; group handlers await `roomsReady`); (2) debounced presence meant late-mounting clients saw "0 online" (server now sends the list on connect and on `get_online_users`). Re-run the 8.1 socket tests with an *immediate* send, not a delayed one. |
| 2026-11-20 | 3.3 | Delete logic verified with a stubbed `destroy` (explicit type = 1 call; legacy rows try the likely type then fall back). Live Cloudinary upload/delete could NOT be verified here: uploads and destroy time out (499) from this machine, while `api.resources` read calls work. `cleanup-orphans.js` dry-run reports 0 orphans (3 assets, 3 rows). Please re-check B4 on production (9.7) or locally with a working network. |
| 2026-11-20 | 3.8 | In dev, React StrictMode runs effects twice, so `/api/files` appears twice per page load in the network log; production builds make one request. Added a stale-response guard anyway. |
| 2026-11-20 | 3.13 | Not done: `ConfirmDialog` is built in 5.2. Do this when 5.2 lands. |
| 2026-11-20 | 3.5 | Backend endpoint done; the "My uploads" UI is F5/5.8. |
| 2026-11-20 | H1 | Confirmed `admin123` DID work on the live site (anyone could be admin). Production admin password changed by the owner's request (new value kept only in the gitignored `backend/.env`; never in the repo or UI). Old password verified rejected, new one accepted. The production DB has no `token_version` column yet, so tokens issued with the old password stay valid until JWT expiry (7d) or until the Phase 9 deploy adds token versioning. |
| 2026-11-20 | H4/D2 | Pre-check on production: 13 users, no case-insensitive duplicates; 4 rows would change (admin + 3 demo students). The UPDATE itself is deliberately NOT run yet: the live (old) backend does case-sensitive email lookup, so lower-casing now would break admin login until the new backend is deployed. Run it at 9.5 right before the merge. |
| 2026-11-20 | H2 | No Brevo/Sendinblue mail found in Gmail, so no account exists. Signup (password, CAPTCHA, email code) must be done by the owner. |
| 2026-11-20 | H2 | Brevo account + verified sender (`chitrak14789@gmail.com`) created by the owner. `BREVO_API_KEY`, `MAIL_FROM`, `MAIL_FROM_NAME` set on Render (`srv-d8vsgaurnols73e3e9u0`, which triggered a redeploy of the unchanged `main` code) and in the gitignored `backend/.env`. Brevo's "Authorized IPs" blocking for API keys had to be DEACTIVATED (Render free-plan IPs change); the first send returned 401 until then. Verified: `sendEmail()` via Brevo delivered the branded OTP email to Gmail. The key was pasted into chat, so rotate it in Brevo (SMTP & API) when convenient and update Render + `.env`. |
| 2026-11-20 | Phase 4 verify | On Neon `dev`: `initDB` ran twice with no errors; all 7 indexes + `users_email_lower_key` exist; `EXPLAIN` on the group-messages query uses `idx_messages_group_created` (with seqscan disabled, since tables are tiny). `scripts/normalize-emails.js` dry-run lists the 4 mixed-case emails. Phase 2 regression script still passes. |
| 2026-11-20 | 4.2 | Marked partial: steps 1 (duplicate check: none on prod) and 3 (unique index in `initDB`) are done. Step 2 (the production UPDATE) is intentionally deferred to 9.5: run `node scripts/normalize-emails.js` (dry run) then `--apply` with `DATABASE_URI` set to production, only right before merging, after the owner re-confirms. Note: on first boot against production, `initDB` creates `users_email_lower_key`; it succeeds even before the UPDATE because no case-duplicates exist. |
| 2026-11-20 | 4.5 | Instead of leaving it to the frontend, added a pg type parser (OID 1114) so TIMESTAMP-without-tz values are read as UTC. Verified correct on a machine in IST (offset -330); without it, dev would show times shifted by 5.5 h. Frontend date-fns already formats in local time. Also added `bookmarks(user_id, created_at)` index. |
| 2026-11-20 | Phase 5 verify | Lighthouse (mobile, headless Chrome, production build via `vite preview`) on the landing page: **Performance 95, Accessibility 100, Best Practices 100, SEO 100** (targets were 80/90/90). Checked in the browser at 375, 768 and 1280 px in light and dark: no horizontal overflow on any route, per-page titles set, DOM audit found no unnamed buttons or unlabelled controls (hidden file inputs now have aria-labels). Contrast computed from the tokens in both themes; fixed light `accent-text` (4.19 -> 4.80 on the soft tint), light/dark `text-faint`, light `warning`, sidebar label. Not measured: Lighthouse on the app pages (they need a login) and on the Vercel preview (CSP). |
| 2026-11-20 | 5.3 | The top-bar search box is a button that currently navigates to /files; the real Cmd/Ctrl+K command palette is F11 (Phase 6). |
| 2026-11-20 | 5.x | Built with a `ui-` prefixed kit so old and new styles never collided; the old stylesheet was deleted once a script confirmed no used class depended on it (CSS fell 74 kB -> 53 kB). Inline `style={{}}` went from ~273 to 8 (all dynamic: group colours, progress width, strength bar, skeleton size). Landing hero uses an 800 px WebP screenshot (the browser pane caps captures at 800 px): retake README screenshots in Phase 10 from cleaner demo data. `apple-touch-icon.png`, `og-image.png` generated with Pillow from the favicon geometry. |
| 2026-11-20 | Phase 6 early | While redoing the pages I also built the backend + UI for F1 (forgot/reset), F2 (change password), F3 (role requests), F4 (remove member, rotate invite code), F5-F7 (my uploads, edit, saved, preview), F8 (history paging, soft delete), F9 (avatar), F10 (dark mode). HTTP-verified on Neon `dev`: F1, F2, F3, F4, F5/F6 endpoints, F8. Browser-verified: F3, F8, expired-session redirect. NOT verified: F7 PDF iframe rendering and F9/upload (Cloudinary uploads time out from this machine), F1/F2 UI flows. F11 (Cmd+K search) and F12 (server-waking banner) are not built yet. They are ticked in Phase 6, not here. |
| 2026-11-20 | rate limits in dev | Repeated browser logins during testing hit the 10 per 15 min login limit (returned "Too many requests"). Expected behaviour; restart the dev server to clear the in-memory counters. |
| 2026-11-20 | Rate limiting OFF | Owner's decision (low traffic): `express-rate-limit` limiters and the socket token bucket only run when `ENABLE_RATE_LIMIT=true` (default off; documented in `.env.example`). Per-OTP attempt cap (5) and resend cooldown/hourly cap stay ALWAYS on, since they protect codes rather than throttle traffic. This reverses the Phase 2 S6 protection until re-enabled; set the env var on Render to turn it back on. The 429 checks in the Phase 2 verify block no longer apply while off. |
| 2026-11-20 | Cloudinary uploads | Root cause of the earlier timeouts: this machine's IPv6 DNS lookups stall ~15 s (curl -4: 0.24 s, -6: timeout; Node only fixed with `family: 4`). Added opt-in `FORCE_IPV4=true` (`config/network.js`, set only in the local `.env`; off by default so Render is unaffected). With it, uploads/deletes take ~2.7 s. |
| 2026-11-20 | BUG FIXED: raw file names | Raw files (PDF/DOC/PPT) were stored with a random public id and NO extension, so Cloudinary served them as `application/octet-stream` / `attachment; filename="file_xxx"` (downloads had no extension; preview impossible). Public ids are now `<slug>_<random>.<ext>` for raw files (images keep extensionless ids). Existing production files keep their old ids and are unaffected by this change. |
| 2026-11-20 | BUG FIXED: avatar | `publicIdFromUrl(null)` threw for users with no previous avatar, so the first avatar upload always failed. |
| 2026-11-20 | Cloudinary PDF delivery ENABLED by owner; rechecked | After the owner enabled it: PDF URL returns 200, `application/pdf`, no content-disposition/X-Frame-Options/CSP. A real PDF opens in the Preview modal's iframe (viewer toolbar visible) with "Open in new tab" and "Download"; test file deleted, Cloudinary back to 3 assets / 0 orphans. F7 ticked. Original finding: | Cloudinary returns **401 "deny or ACL failure" for PDFs** (DOCX/PPTX/images are fine): new accounts block PDF/ZIP delivery by default. This affects PDF download AND preview for everyone, on production today as well. Fix in the Cloudinary console: Settings (gear) -> Security -> "Restricted media types" -> tick **"PDF and ZIP files delivery"** -> Save. Re-verify PDF preview/download afterwards (F7 stays unticked until then). |
| 2026-11-20 | Verified end to end (previously unverified) | Real Cloudinary + Neon dev: student upload -> pending -> admin approve -> visible; stored resource_type/mime/size/original_name; B4 delete removes the PDF and image assets from Cloudinary (also via the UI delete dialog); 60 MB upload -> JSON 413; avatar upload (and replacing deletes the old asset); UI: forgot password -> reset -> signed in; change password (wrong current = inline error, token rotates, old token 401); avatar via the real file input; upload modal (auto title, "Pending approval"); My uploads shows Pending, All files does not; image preview loads; DOCX shows "Preview not available" + Download; save/unsave + Saved tab; edit title; delete confirm. |
| 2026-11-20 | Lighthouse (signed-in pages, mobile, prod build, seeded session) | / perf 87 / a11y 100; /files 100/100; /chat 100/100; /groups 100/100; /profile 100/100; /admin 100/100; best practices 100 everywhere. Dashboard CLS 0.244 is the web-font swap on the throttled profile (blocking fonts drops it to 0.034); left on `font-display: swap`. Fixed two a11y findings: avatar initials now rendered by CSS (label-content-name-mismatch) and file card titles are h2 (heading-order). |
| 2026-11-20 | F4 note | Remove-member / rotate-code / join-by-code are HTTP- and socket-verified (a removed member stops receiving live messages); the Members modal UI is exercised in the 8.3 manual QA. |
| 2026-11-20 | Phase 6 verify | F10: toggle flips `data-theme`, persists in `cc_theme`, updates the theme-color meta. F11: `/api/search` (literal `%` matches nothing, empty q 400, no token 401) + Ctrl/Cmd+K palette: shortcut, focus, default page list, file/group results, arrow keys, Enter opens Files pre-filled, no-results text, Esc. F12: with the backend stopped the banner appears after 3 s (not before) and clears itself when the server returns. Sweep of all 46 routes without a token: every one returns 401 except the intentionally public ones (register, login, verify-otp, resend-otp, forgot/reset-password, public stats). All 13 admin-only routes return 403 for a student; editing/deleting someone else's file is 403; managing or rotating a foreign group's invite code is 403. F13-F15 are stretch and not started. |
| 2026-11-20 | BUG FIXED: cold start logged users out | `AuthContext` cleared the session on ANY failed `/auth/me`, so a sleeping/booting server (502/network error) signed users out. It now ends the session only on 401/403 and otherwise keeps the cached user. Also proxied `/health` in `vite.config.js` (previously Vite answered it, so the F12 banner could never fire in dev). |
| 2026-11-20 | Phase 7 | 7.1: all pages except Landing/Login are `React.lazy`; the shell stays visible (spinner) while a page chunk loads. Added vendor chunks (`vendor-react` 167 kB, `vendor-net` 101 kB, `vendor-date` 23 kB); the app entry is **60 kB** (limit 250). 7.2: socket layer moved to `backend/socket/index.js` (`server.js` 270 -> 113 lines); public routes were already in `routes/public.js`. Re-ran the socket suites after the move: group rooms, removal over live sockets, history/delete/broadcast, and the S2 intrusion test all pass (only the old S6 429 check differs, by design). 7.3: ESLint 9 flat configs for both packages (`npm run lint`), both clean (frontend keeps only `rules-of-hooks` + `exhaustive-deps`; the plugin's newer compiler-style rules flag the standard fetch-in-effect pattern). Lint caught a real bug: the filename sanitizer was not stripping backslashes. 7.4/7.5 are Render dashboard changes and are done in Phase 9 (7.4 needs the lockfile deploy; 7.5 is the Singapore service). |
| 2026-11-20 | 8.1 | `npm test` in `backend/` (`node --test`, supertest, socket.io-client; needs `TEST_DATABASE_URI`, which `.env.example` documents and which must be the dev branch): **18 tests, all passing in ~19 s**. Covers every case listed in 8.1 plus: case-insensitive duplicate email, reset code rejected by verify-otp, identical forgot-password answers, group history 403 for outsiders, immediate-send-after-connect regression, member removal stops live delivery, students 403 on admin routes, role-request approval, password change signs out other sessions, search wildcard escaping. `server.js` exports `{ app, server, io }` and only auto-starts when run directly. Mail is captured by stubbing `utils/mailer`; users/groups created by tests are deleted afterwards. Rate limiting is off in tests. |
| 2026-11-20 | 8.2 | `npm run build` and `npm run lint` pass with no warnings in the frontend. |
| 2026-11-20 | BUG FIXED: chat message order | Found in manual QA: two messages sent ~400 ms apart were stored in reverse order (each insert took its timestamp from the DB when it ran, and concurrent inserts finish out of order on different pool connections). Then a regression test showed the live broadcast order could also scramble. Fix: stamp each message when it ARRIVES (stored and broadcast value are the same), and process each socket's sends through a per-socket queue. Regression test added (19 tests passing). |
| 2026-11-20 | 8.3 manual QA (§11) | Run in the real browser against Vite + the backend on Neon dev, 375/768/1280 px, light and dark (layout checks), with the owner's local Cloudinary. Verified: landing real stats; student + faculty registration (strength hint, OTP boxes with paste, resend countdown, 5 wrong codes then the correct code is refused with "Too many attempts"); login/wrong password with no reload; forgot password end to end; change password signs out the other session; a NEW TAB stays signed in and a logout in one tab signs out the other; dashboard (student/admin); Files (filters, search, sort, grid/list persisted across reload, upload with progress, image + PDF + Word preview, save/unsave, My uploads status, edit, delete + Cloudinary removal); Chat (global, unread badge clears on open, load older keeps scroll, delete own, linkify, 2000-char counter, Enter vs Shift+Enter, disconnect/reconnect chip); Groups (create public/private, invite code, join by code, remove member, rotate code, owner has no Leave, delete); Profile (bio, clear department, avatar); Admin (approve/reject with preview, role request approve, user search/filter/menu with self protections, announcements create/delete); keyboard (logical tab order, no positive tabindex, Esc closes dialogs, Ctrl+K palette); 404 page. Clipboard "Copy" could not be exercised because the headless pane document is unfocused (browser blocks it); the app shows a fallback toast in that case. Bugs found by QA and fixed: message ordering (see above). |
| 2026-11-20 | 10.1 / 10.2 | README rewritten (features, live URL, Brevo instead of Gmail SMTP, architecture, setup with the Neon dev branch, `npm test`, full env table incl. `ENABLE_RATE_LIMIT`/`FORCE_IPV4`/`NEON_WS`, REST/socket summary, deployment) and `SECURITY.md` added. Screenshots retaken from tidy demo data on the dev branch (800 px wide: the browser pane's capture limit); the three obsolete images (upload, create_group, group) were removed. Landing hero now uses the new dashboard capture. |
| 2026-11-20 | BUG FIXED: styles lost on lazy routes | Code-splitting (7.1) put shared classes (search box, file action buttons, preview frame, announcement cards, banners, password toggle, remove/danger buttons) inside one page's CSS chunk, so e.g. opening Groups first left its search box unstyled. A script comparing classes used per page against the CSS each route chunk loads found the gaps; all were moved to `components.css`. Verified by cold-loading Groups and Admin. |
| 2026-11-20 | Local network blocks Postgres (5432) | Mid-session this machine's network began filtering the Postgres protocol: TCP connects but there is no handshake reply, for Neon prod, Neon dev AND an unrelated Supabase host; HTTPS is fine and Neon was healthy. Added opt-in workarounds, both OFF by default and local-only: `FORCE_IPV4=true` (IPv4-only DNS lookups, also fixed 15 s Cloudinary stalls) and `NEON_WS=true` (Neon serverless driver over WebSocket/443 via devDependencies `@neondatabase/serverless` + `ws`; same Pool API). Production uses plain `pg`. With NEON_WS the suite takes ~72 s instead of ~19 s, so the socket tests now poll with `waitFor` instead of fixed sleeps (19/19 pass). |
| 2026-11-20 | PHASE 9 DEPLOYED | Order used: (1) confirmed Neon `backup-pre-v2`; (2) pushed `improve/v2`; (3) created Render service **campus-connect-api-sg** (Singapore, free; `https://campus-connect-api-sg.onrender.com`, id `srv-dbvr2oks728c73bn1nl0`) from branch `improve/v2` with production env (NODE_ENV, CLIENT_URLS, DATABASE_URI, JWT_SECRET, JWT_EXPIRES_IN, CLOUDINARY_*, BREVO_API_KEY, MAIL_FROM, MAIL_FROM_NAME). Build `cd backend && npm ci`, start `cd backend && npm start` (the tool cannot set rootDir/health check). First boot ran the additive migrations on production in ~1 s: all 8 indexes, new columns and `bookmarks` verified by query; data intact (13 users / 3 files / 3 messages). (4) 9.5: `normalize-emails.js` dry-run on production listed exactly the 4 expected rows, then `--apply` updated 4 rows; mixed- and lower-case admin logins both return 200. (5) Vercel: framework preset set to Vite; `VITE_API_URL` -> `https://campus-connect-api-sg.onrender.com/api`; `vercel.json` CSP allows both backend hosts. (6) PR #1 opened and merged (merge commit c3c7bdbd; 2 checks passing). The old Oregon service auto-deployed the same `main` code and is still running. |
| 2026-11-20 | 9.7 production checks done WITHOUT logging in | Live site (`campus-connect-five-zeta.vercel.app`): new build served; `/files` and `/groups` return 200 on a direct hit (C2); CSP, X-Frame-Options and nosniff headers present; no console errors or CSP violations in the browser; fonts, hero image and real stats (13/2/2) load from the new API through the CSP (C1 path). New API: `/health` ok; CORS allows the Vercel origin; all 46 routes without a token return 401 except the intentionally public ones; unauthenticated socket handshake refused ("Authentication required"); helmet/HSTS headers; forgot-password identical for unknown emails. Latency (5 warm DB-backed requests): Singapore ~0.70 s vs Oregon ~1.0-1.2 s from the same client. Live Lighthouse (mobile) landing: 88 / 100 / 100 / 100 (LCP 3.1 s on the real network). NOT done by me on purpose: anything needing real credentials or an emailed code (register + OTP email via Brevo, login, chat between two accounts, upload/approve/preview/delete a PDF, private group isolation with two accounts). These are the owner's checks (see the hand-off list in chat). |
| 2026-11-20 | Owner steps left in Render dashboard | (a) Singapore service: Settings -> Branch -> change `improve/v2` to `main` (otherwise it stops following `main`), and Health Check Path -> `/health`. (b) Suspend (do NOT delete) the Oregon service `campus-connect-backend` once the live checks pass. (c) 7.4 (`npm ci` for the Oregon service) is moot because that service is being retired; the new service already uses `npm ci`. |
| 2026-11-20 | 9.8 rollback | Vercel: Instant Rollback to `dpl_5ughyaipGV7nXKpG9qw7PF5ocXZg` (the pre-v2 deployment; it would still point at whatever `VITE_API_URL` is, so also set it back to the Oregon `/api` URL if rolling back). Render: the Oregon service still exists and runs the same DB. DB: all migrations are additive; `backup-pre-v2` holds the pre-deploy data. |
| 2026-11-20 | 0.2/0.3 | Neon branches created: `dev` (br-polished-union-aoj9t0mv), `backup-pre-v2` (br-round-frost-ao8u3kmu, no compute). |

## Progress summary (update at the end of each phase)

- Phase 0: ☑  Phase 1: ◐ (code done, browser verify pending)  Phase 2: ☑ (CSP untested on Vercel)  Phase 3: ◐ (3.13 waits on 5.2)  Phase 4: ◐ (4.2 production UPDATE waits for 9.5)  Phase 5: ☑
- Phase 6: ☑ (F13-F15 stretch not started)  Phase 7: ☑ (7.4 moot)  Phase 8: ☑  Phase 9: ◐ deployed; owner live checks + Render dashboard steps pending  Phase 10: ◐ (10.3 at the end)
