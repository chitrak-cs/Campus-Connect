# Security

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Email the maintainer or use GitHub's private vulnerability reporting on this repository (Security tab, "Report a vulnerability"). Include steps to reproduce and the affected endpoint or page. You'll get an acknowledgement and, if it's confirmed, a fix before details are made public.

## What the application does to protect users

**Authentication and sessions**
- Passwords are hashed with bcrypt (cost 12); 8 to 72 characters are accepted.
- Sessions are signed JWTs sent as a Bearer header. Each carries a `token_version`; changing a password, resetting it, or deactivating an account invalidates older tokens (including live sockets).
- Login checks the password before revealing whether an account is disabled, and does constant-work comparisons for unknown emails.
- Forgot-password answers identically for known and unknown emails (no account enumeration).

**One-time codes**
- 6-digit codes from a cryptographic RNG, stored only as a salted hash, compared in constant time.
- Maximum 5 attempts per code, single use, expiry (10 minutes; 15 for resets), a 60-second resend cooldown and an hourly cap.
- The code's purpose comes from the stored record, never from the client.

**Roles and authorization**
- Everyone registers as a student. Faculty is a *request* that an administrator approves.
- Admin routes require an active admin; admins cannot demote or deactivate themselves or the last active admin.
- Private groups are invite-only (invite codes can be rotated); member emails are visible only to site admins.
- Real-time group rooms are joined only from a server-side membership lookup. Clients cannot choose rooms, and removing a member also removes their live sockets.

**Uploads**
- File extension **and** MIME type must match an allow-list (PDF, Word, PowerPoint, JPG, PNG); size limit 50 MB (2 MB for avatars).
- Filenames are sanitized; storage keys are random; failed database writes remove the uploaded asset.
- Student uploads are not public until an admin approves them.

**Input and transport**
- Every request body, query and route parameter is validated (zod, UUID checks); chat messages are limited to 2000 characters.
- Responses use `helmet` headers; request bodies are limited to 100 KB; CORS is an allow-list of configured origins.
- The frontend sets a strict Content-Security-Policy, `X-Frame-Options: DENY`, `nosniff` and a restrictive Permissions-Policy. Chat content is rendered as text, with links created from parsed URLs and never from HTML.
- Secrets live in environment variables only; `.env` files are git-ignored.

**Rate limiting**
- Request rate limiting (login, registration, OTP, API, chat) is implemented and can be enabled with `ENABLE_RATE_LIMIT=true`. It is **off by default** while traffic is low. Per-code attempt limits are always on.

## Operational notes

- Use a separate Neon branch for development and tests; never point `TEST_DATABASE_URI` at production.
- Rotate the Brevo API key and the JWT secret if they are ever exposed (rotating the JWT secret signs everyone out).
- Keep Cloudinary's "Restricted media types" aware of what you allow: PDF delivery has to be enabled for PDF previews and downloads to work.
- Run `npm audit` periodically in both packages. Known low-risk advisories are recorded in `IMPROVEMENT_PLAN.md`.
