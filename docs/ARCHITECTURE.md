# TableQR architecture

How TableQR is built and deployed today. Keep it current: update the sections a feature touches in
the same pull request. `DISCOVERY.md` is the dated audit of 2026-10-02 and is not updated.

Last updated: 2026-10-03 (ADM-01 roles and admin console).

## 1. Overview

```
Guest phone ──► menu.arishub.site (Cloudflare Pages, static React app)
Owner/staff ──►        │  fetch + Server-Sent Events, JWT in Authorization header
Admin       ──►        ▼
                menu-api.arishub.site (Cloudflare proxy) ──► nginx (VPS) ──► API container :3100
                                                                              │
                                                       PostgreSQL 17 container (same VPS, no public port)
Outside services: Resend (email), Cloudinary (images), OpenRouter (AI).
```

| Repository | Path | Remote |
|---|---|---|
| Backend (API, docs, plan) | `C:\ARISHUB\Dev\dine-qr-backend` | `SaifEddine-BenTurkia/dine-qr-backend` |
| Frontend | `C:\ARISHUB\Dev\dine-qr-style` | `SaifEddine-BenTurkia/dine-qr-style` |

## 2. Stack

| | Frontend | Backend |
|---|---|---|
| Language | TypeScript, React 19 | TypeScript, Node 22 (Docker image node 26) |
| Framework | Vite 7 SPA, TanStack Router (file routes) and Query, Tailwind 4, shadcn/ui | NestJS 11 (Express) |
| Data | `src/lib/api.ts` typed fetch client | Prisma 6 on PostgreSQL 17 |
| Tests | Lint and type check (Vitest and Playwright arrive with P0-02) | Jest unit and e2e (supertest, real Postgres) |
| Package manager | npm | npm |

## 3. Accounts and roles

| Role | Who | Screens | API |
|---|---|---|---|
| `admin` | Emails in `ADMIN_EMAILS` (server config, never the database) | `/admin` console only | Routes marked `@ForRole('admin')`, plus `/auth/me` |
| `restaurant` | Every other account; owns one restaurant | `/dashboard` only | Every authenticated route without a role mark |
| guest | Anonymous visitor | `/m/:slug` | `/public/menu/*` (rate limited) |

- `JwtAuthGuard` (`src/common/auth.guard.ts`) reloads the user on every request (token version for
  revocation, email verified), computes the role and enforces `@ForRole`. `AdminGuard` checks again
  on admin controllers.
- The frontend redirects by role (`roleOf()` in `src/lib/auth-context.tsx`): `/dashboard` sends
  admins to `/admin`, `/admin` sends restaurant accounts to `/dashboard`.
- Admins create restaurant accounts in the console (`POST /admin/accounts`).
- Staff roles inside a restaurant (manager, waiter) are P0-11.

## 4. Backend modules (`src/`)

| Module | Routes | Notes |
|---|---|---|
| `auth` | `/auth/*` | Register, login, me, verify email, password reset |
| `restaurant` | `/restaurant` | Profile, slug, logo, template, WiFi, Google Place ID, languages |
| `menu` | `/categories`, `/dishes` | CRUD, reorder, availability, sold out, translations |
| `tables` | `/tables` | Tables with random QR tokens, bulk create, rotate token |
| `service` | `/service-requests` (+ `/stream` SSE) | Staff board; `ServiceHub` fans out live events in process |
| `public-menu` | `/public/menu/:slug` | Guest menu, events, service calls, feedback, scans |
| `insights` | `/stats/scans`, `/stats/overview`, `/restaurants/feedback` | Owner analytics |
| `billing` | `/subscription`, `/admin/payment-requests` | Trial, cash payment requests |
| `admin` | `/admin/*` | Overview, activity, system, accounts, payments |
| `ai` | `/ai/*` | Menu import and translation through OpenRouter |
| `media` | `/library/*`, image uploads | Cloudinary |
| `mail` | — | Resend; `RecipientPolicy` limits recipients outside production |
| `health` | `/health/live`, `/health/ready` | Container and deploy checks |
| `config`, `common` | — | Env validation and modes, guards, redacting logger, client IP |

Every restaurant-scoped query goes through `RestaurantAccessService.restaurantIdFor(userId)`, so a
user only reaches rows of their own restaurant (tested in e2e).

Live updates: the staff board listens to `GET /service-requests/stream?access_token=` (Server-Sent
Events, heartbeat every 25 s, `X-Accel-Buffering: no`) and polls every 5 s as a fallback. One API
container today; with several, `ServiceHub` becomes a PostgreSQL LISTEN/NOTIFY bridge.

## 5. Data model (Prisma, `prisma/schema.prisma`)

| Table | Purpose |
|---|---|
| `User`, `UserToken` | Accounts; email verification and reset tokens (SHA-256 hashes only) |
| `Restaurant` | One per restaurant account: profile, template, WiFi, Google Place ID, `defaultLocale`, `enabledLocales` |
| `Category`, `Dish` | Menu; prices `Decimal(10,3)` in dinars (millimes migration is P0-04); `nameI18n`/`descriptionI18n` JSON, `aiLocales`; `soldOut`, `soldOutUntil` |
| `DiningTable` | Label, zone, unique random token for `?t=` |
| `ServiceRequest` | WAITER / BILL_CASH / BILL_CARD; OPEN → ACKNOWLEDGED → DONE (or CANCELLED) |
| `Event` | Guest and server events for analytics (type, table, session, item, props) |
| `Feedback` | Rating, tags, comment, table, contact only with consent |
| `Scan` | Menu opens with a salted visitor hash (to be replaced by `Event`, P0-06) |
| `Subscription`, `PaymentRequest` | Trial and cash payments |

Migrations: `init`, `manual_cash_payments`, `menu_template`, `guest_service`, `ai_locales`.
New migrations must be additive or come with a backfill; `deploy.sh` backs up before migrating.

## 6. Frontend layout (`dine-qr-style/src/`)

| Path | Contents |
|---|---|
| `routes/index.tsx`, `login`, `register`, … | Public pages |
| `routes/m.$slug.tsx` | Guest menu (`?t=` table token, locale, tracker, 5 s refresh) |
| `routes/_authenticated.tsx` + `routes/_authenticated/dashboard/*` | Restaurant dashboard: Accueil, Menu, Service, Tables, Avis, QR, Restaurant, Abonnement |
| `routes/admin.tsx` + `routes/admin/*` | Admin console: Vue d'ensemble, Activité, Restaurants, Paiements, Système |
| `components/public-menu/` | Templates, guest bar, i18n strings (fr/ar/en, RTL), session tracker |
| `lib/api.ts`, `lib/queries.ts`, `lib/auth-context.tsx` | API client and types, Query hooks, session |
| `public/_headers` | Security headers and CSP (API origin filled in by `scripts/write-headers.mjs` after build) |

## 7. URLs

| URL | What |
|---|---|
| `https://menu.arishub.site/m/<slug>` | Guest menu (printed QR codes before P1-01) |
| `https://menu.arishub.site/m/<slug>?t=<token>` | Guest menu at a table |
| `https://menu.arishub.site/dashboard/*` | Restaurant dashboard |
| `https://menu.arishub.site/admin/*` | Admin console |
| `https://menu-api.arishub.site/*` | API (no prefix) |

The final domain is P0-13; printed QR codes must keep working through a redirect.

## 8. Environments and deploy

| Environment | Frontend | API | Database | `APP_ENV` |
|---|---|---|---|---|
| Development | localhost:5173 | localhost:3001 | Docker Postgres on 5434 (`tableqr`, `tableqr_e2e`, `tableqr_shadow`) | development |
| Pre-launch (today's production) | menu.arishub.site | menu-api.arishub.site | VPS container | prelaunch (default when unset on a server) |
| Production (after first paying customer and owner approval) | same | same | same | production |

- **Frontend:** Cloudflare Pages builds every push; `main` is production, branches get previews.
  `ci.yml` runs lint, type check, secret scan, env check and build.
- **Backend:** `ci-cd.yml` on push to `main`: verify (Prettier, ESLint, tsc, Jest, secret scan,
  env check, Prisma validate and drift, e2e) → build API and migration images to GHCR (tagged by
  commit) → SSH as `deploy` → `/opt/tableqr/deploy.sh` (pg_dump, `prisma migrate deploy`, start,
  wait for `/health/ready`, roll back on failure).
- **Server:** shared OVH VPS `54.37.224.213` (also runs ArisHub, which TableQR never touches).
  `/opt/tableqr`, user `deploy` (docker group, no sudo), API on `127.0.0.1:3100`, nginx with
  certbot, firewall allows 80/443 from Cloudflare only. Nightly `pg_dump` at 02:30 UTC on the same
  disk (off-site copies are P0-12).

## 9. Environment variables (names only)

Backend (`.env.example`): `APP_ENV`, `SANDBOX_ALLOWED_RECIPIENTS`, `NODE_ENV`, `PORT`, `DATABASE_URL`,
`JWT_SECRET`, `JWT_EXPIRES_IN`, `SCAN_HASH_SALT`, `FRONTEND_URL`, `CORS_ORIGINS`, `RESEND_API_KEY`,
`RESEND_FROM_EMAIL`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`,
`CLOUDINARY_FOLDER`, `CLOUDINARY_LIBRARY_FOLDER`, `ADMIN_EMAILS`, `PAYMENT_WHATSAPP`,
`PAYMENT_CONTACT_EMAIL`, `PAYMENT_PHONE`, `TRIAL_DAYS`, `PRICE_TND`, `PAYMENT_PLANS`,
`OPENROUTER_API_KEYS`, `OPENROUTER_MODEL`.

Frontend: `VITE_API_URL` only (public values only; `npm run env:check` enforces it).

Rules: `npm run env:check` validates names and modes; live-key markers are refused outside
production; secrets are never printed (`RedactingLogger`, `secrets:scan` in CI). Local secrets go in
the sandbox env file created by `npm run env:init`.

## 10. Security baseline

helmet, CORS allow-list, rate limits keyed on `CF-Connecting-IP` (120/min default, tighter on auth,
AI and guest writes), bcrypt, token revocation, DTO whitelisting (unknown fields rejected), CSP in report-only mode until
verified in production, Claude Code guard hook (`scripts/claude-guard.mjs`) blocking access to
secret files.
