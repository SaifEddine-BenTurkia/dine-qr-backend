# TableQR: discovery report

Read-only audit of the two repositories and the production server, made on 2026-10-02.
No code, configuration or data was changed. Secret values are never shown: variables
are listed by name, and keys are judged only by their prefix or host.

| Repository | Local path | Remote |
|---|---|---|
| Frontend | `C:\ARISHUB\Dev\dine-qr-style` | `SaifEddine-BenTurkia/dine-qr-style` (private), plus a second remote `mehdi-origin` = `mehdichekir/dine-qr-style` |
| Backend | `C:\ARISHUB\Dev\dine-qr-backend` | `SaifEddine-BenTurkia/dine-qr-backend` (private) |

---

## 1. Stack

### Frontend (`dine-qr-style`)

- **Language:** TypeScript 5.8, React 19.2.
- **Build:** Vite 7.3, a static single-page app.
- **Routing:** TanStack Router 1.168, file-based routes. The Vite plugin regenerates `src/routeTree.gen.ts` on every build.
- **Data:** TanStack Query 5.83, called through a hand-written `fetch` client in `src/lib/api.ts`.
- **UI:** Tailwind CSS 4.2, shadcn/ui components on Radix, lucide-react icons, sonner toasts, Recharts 2.15 for charts.
- **Other libraries:** qrcode.react 4.2 (QR codes), i18n-iso-countries and libphonenumber-js (sign-up form), react-hook-form + zod (installed, used only lightly).
- **Package manager:** npm (`package-lock.json`). The Bun files were removed.
- **Node:** 22 (CI). Local: Node 22.23.2, npm 10.9.8.
- **Origin:** generated with Lovable (`.lovable/project.json`; package name `tanstack_start_ts`), then rewritten.

```
src/
  main.tsx, router.tsx          SPA entry point and router
  routes/                       one file per page (see section 5)
  components/
    ui/                         shadcn/Radix components (retuned)
    app/                        shared app parts: page header, forms, dialogs
    menu/                       menu editor dialogs (dish, AI import, image picker)
    public-menu/                guest menu: templates, MenuView, template picker
    admin/                      admin badges, contact buttons, tabs
    site-header.tsx             landing page header
  lib/
    api.ts                      typed API client and all response types
    queries.ts                  TanStack Query hooks
    auth-context.tsx            JWT session in localStorage
    format.ts                   prices, dates, slugs, brand colours, plan names
  server.ts, start.ts, lib/error-capture.ts, lib/error-page.ts
                                unused TanStack Start (SSR) leftovers
public/_headers                 Cloudflare Pages security and cache headers
index.html                      lang="fr", meta tags, Google Fonts link
API_ENDPOINTS.md                original API spec from the Lovable phase (outdated)
SKILL.md                        UI/UX guideline file (git-ignored by the uncommitted .gitignore change)
wrangler.jsonc                  Cloudflare Pages output config (dist)
```

### Backend (`dine-qr-backend`)

- **Language:** TypeScript 5.9 on Node 22 (`engines: >=22`).
- **Framework:** NestJS 11.2 (Express platform).
- **Database access:** Prisma 6.19 on PostgreSQL 17.11.
- **Validation:** class-validator / class-transformer DTOs.
- **Security:** helmet; @nestjs/throttler, keyed on the `CF-Connecting-IP` header.
- **Auth:** @nestjs/jwt, bcrypt.
- **Third-party SDKs:** cloudinary 2.11, resend 6.31, multer (uploads).
- **Tests:** Jest 30, ts-jest, supertest.
- **Package manager:** npm.

```
src/
  main.ts, app.module.ts, app.setup.ts, shared.module.ts
  config/environment.ts         env validation (required in production, secret length)
  auth/                         register, login, verify email, password reset
  restaurant/                   restaurant profile, slug check, logo/image upload, templates
  menu/                         categories and dishes (CRUD, reorder, availability, images)
  public-menu/                  guest menu, scan counting, feedback
  insights/                     scan stats, feedback list for owners
  billing/                      trial, subscription status, cash payment requests, plans
  admin/                        admin overview, accounts, manual payments, trial, suspend
  ai/                           AI menu import through OpenRouter (photo/text to dishes)
  media/                        Cloudinary uploads and a shared image library
  mail/                         Resend transactional emails
  health/                       /health/live and /health/ready
  common/                       JWT guard, admin guard, client IP, error filter, upload limits
  prisma/                       PrismaService
prisma/schema.prisma, prisma/migrations/   3 migrations
test/                           e2e suite (app.e2e-spec.ts) and its env setup
deployment/                     production compose, deploy.sh, backup.sh, bootstrap-env.sh, nginx
Dockerfile                      multi-stage: production image and migration image
compose.yml                     local Postgres (host port 5434)
.github/workflows/ci-cd.yml     verify -> build images -> deploy
.github/dependabot.yml
```

---

## 2. Hosting and deployment

| Part | Where | How it deploys |
|---|---|---|
| Frontend | Cloudflare Pages, project `dine-qr-style` → https://menu.arishub.site | Cloudflare's Git integration builds every push (`npm run build` → `dist`). `main` goes to production; other branches get preview URLs. GitHub Actions `ci.yml` only lints and builds. |
| Backend API | OVH VPS `54.37.224.213` (VPS-2: 4 vCores, 8 GB RAM, 75 GB disk, Gravelines; Ubuntu 26.04), behind Cloudflare → https://menu-api.arishub.site | GitHub Actions `ci-cd.yml` on push to `main`: **verify** (Prettier, ESLint, tsc, Jest, Prisma drift check, e2e on a Postgres service) → **image** (builds and pushes the API and migration images to GHCR, tagged by commit SHA) → **deploy** (SSH as `deploy` with a pinned host key, then runs `/opt/tableqr/deploy.sh`). |
| Database | PostgreSQL 17 container `tableqr-postgres-1` on the same VPS. No public port. | Migrations run by the migration image during each deploy. |

**What `deploy.sh` does:** takes a `pg_dump` backup → runs `prisma migrate deploy` → starts the new API container → waits for `/health/ready` → rolls back to the previous image if the check fails.

**Server layout:**
- Compose project `tableqr` in `/opt/tableqr`, owned by the `deploy` user (in the docker group, no sudo).
- API published on `127.0.0.1:3100` only. nginx proxies to it, with a Let's Encrypt certificate (certbot) and rate-limit zones keyed on the real client IP.
- The firewall only allows ports 80/443 from Cloudflare.

**Shared host:** the VPS also runs ArisHub (`/opt/arishub`: `arishub-api`, `arishub-postgres`, `arishub-redis`, site `api.arishub.site`). TableQR must not change it.

**Backups:**
- Nightly `pg_dump` by cron (02:30 UTC) to `/opt/tableqr/backups`, plus a dump before every deploy. Last nightly: `nightly-20261002T023001Z.dump`.
- Backups stay on the same disk; there is no off-site copy.

**Currently deployed:** backend image tag `243e168…` (deployed 2026-10-01 20:38 UTC). Frontend `main` at `591d782`.

**Incident on 2026-10-01:** the VPS froze at about 23:18 UTC with no error in the logs and was rebooted from the OVH panel. All containers came back on their own and the data was intact.

### Domains and environments

| Environment | Frontend | API | Database |
|---|---|---|---|
| Production | menu.arishub.site | menu-api.arishub.site | VPS container `tableqr` |
| Preview | Cloudflare branch preview URLs | **production API** (CORS allows only menu.arishub.site, so previews can't call it) | — |
| Staging | none | none | none |
| Development | localhost:5173 | localhost:3001 (set by a local env override) | Docker Postgres on localhost:5434 (`tableqr`; plus `tableqr_e2e` and `tableqr_shadow` for tests and migrations) |

Note: the frontend's local `.env` points `VITE_API_URL` at **production**, so `npm run dev` without an override talks to the live API.

### Command-line tools on this machine (local checks only, no API calls)

| CLI | Installed | Logged in |
|---|---|---|
| gh | no | — (git uses the Windows credential manager) |
| vercel, netlify, railway, supabase, wrangler, flyctl, heroku, doctl, gcloud, az | no | — |
| firebase | yes | unknown: the CLI crashes on start (missing template file in the global install) |
| docker | yes (Docker Desktop) | the engine is not running right now |
| aws | yes | no profiles, no credentials file |
| hf (Hugging Face) | yes | a token file exists (`~/.cache/huggingface/token`); the account was not checked, because that would call the API |
| ssh | yes | alias `arishub-db` → `ubuntu@54.37.224.213` works (sudo without password) |

---

## 3. Database

- **Engine:** PostgreSQL 17.11, managed with the Prisma 6 ORM and Prisma Migrate.
- **Hosting:** a Docker container on the VPS, with data in a named volume.
- **Migrations:**
  1. `20261001130230_init`
  2. `20261001140320_manual_cash_payments`
  3. `20261001201147_menu_template`

| Table | Key columns | Relations | Prod rows |
|---|---|---|---|
| `User` | id (uuid), email (unique), passwordHash, fullName, phone, phoneCountryCode, country (default TN), address, taxId, emailVerifiedAt, tokenVersion | has one Restaurant, one Subscription; many UserToken, PaymentRequest | 2 |
| `UserToken` | userId, type (EMAIL_VERIFICATION / PASSWORD_RESET), tokenHash (unique, SHA-256), expiresAt, usedAt | → User (cascade) | 2 |
| `Restaurant` | userId (unique), name, slug (unique), description, logoUrl, primaryColor, template (default `classic`) | → User (cascade); many Category, Scan, Feedback | 2 |
| `Category` | restaurantId, name, position | → Restaurant (cascade); many Dish | 4 |
| `Dish` | categoryId, name, description, price (decimal 10,3), imageUrl, position, available | → Category (cascade) | 32 |
| `Subscription` | userId (unique), status (trialing / active / past_due / canceled), currency (default TND), trialEndsAt, currentPeriodEnd | → User (cascade) | 2 |
| `PaymentRequest` | reference (unique, e.g. `TQ-7F3K2A`), userId, months, amount, currency, contactMethod (WHATSAPP / EMAIL / PHONE), note, status (PENDING / PAID / REJECTED / CANCELED), amountReceived, adminNote, handledBy, handledAt, periodStart, periodEnd | → User (cascade) | 0 |
| `Scan` | restaurantId, visitorHash (salted hash of the visitor IP) | → Restaurant (cascade) | 7 |
| `Feedback` | restaurantId, rating, comment | → Restaurant (cascade) | 3 |
| `_prisma_migrations` | Prisma bookkeeping | — | 3 |

Each user has at most one restaurant (`Restaurant.userId` is unique) and one subscription. There is no multi-restaurant or multi-staff model.

---

## 4. Auth

**Method:** email and password.
- Passwords are hashed with bcrypt, and logins on unknown emails take the same time as real ones.
- On success the API returns a JWT (HS256, expires after `JWT_EXPIRES_IN`, default 7 days).
- The frontend keeps the token in `localStorage["tableqr_token"]` and sends it as `Authorization: Bearer`.
- Each token carries `tokenVersion`. A password reset bumps it, which revokes older tokens. The guard reloads the user on every request.

**Email verification:** registration sends a verification link (Resend). Most routes reject unverified accounts. A few are explicitly allowed for them, such as `/auth/me` and resend-verification.

**Password reset:** single-use links by email. Only the SHA-256 hash of each token is stored.

**Roles:**
- **Owner:** every registered user. Each owner has one restaurant.
- **Admin:** an owner whose email is listed in the `ADMIN_EMAILS` env variable (`src/common/admin.ts`, `AdminGuard`). There is no role column in the database.
- **Guest:** an anonymous visitor on the public menu.
- There is no staff, waiter or multi-user restaurant role.

**How accounts are created:**
- Self-service sign-up at `/register`: full name, email, password, phone with country code, and country (a selector of all countries, default TN).
- No social login and no invitations.
- The restaurant and its trial are created later, during onboarding in the dashboard.

---

## 5. Existing features

| Feature | How it works | Main files |
|---|---|---|
| Landing page | Hero with a live template switcher, how it works, features, pricing (Mensuel/Annuel toggle), FAQ | FE `src/routes/index.tsx`, `src/components/site-header.tsx` |
| Sign-up, login, verify email, forgot/reset password | As described in section 4 | FE `src/routes/{register,login,verify-email,forgot-password,reset-password}.tsx`, `src/lib/auth-context.tsx`; BE `src/auth/*`, `src/mail/mail.service.ts` |
| Onboarding and restaurant profile | Name; slug (auto-generated, availability check); description; logo; brand colour; menu template; live phone preview | FE `dashboard/index.tsx`, `dashboard/settings.tsx`, `components/app/restaurant-form.tsx`; BE `src/restaurant/*` |
| Menu editor | Categories: create, rename, reorder, delete. Dishes: create, edit, reorder, availability switch, price in DT with 3 decimals, image | FE `dashboard/menu.tsx`, `components/menu/dish-dialog.tsx`; BE `src/menu/*` |
| Images | Upload to Cloudinary, or pick from a shared image library | FE `components/menu/image-picker-dialog.tsx`; BE `src/media/*`, `src/common/image-upload.ts` |
| AI menu import | Photo or text of a menu → OpenRouter model → proposed categories and dishes to accept. Tries several models in order. | FE `components/menu/ai-import-dialog.tsx`; BE `src/ai/*` |
| **Guest menu** | URL format **`https://menu.arishub.site/m/{slug}`**. Data from `GET /public/menu/{slug}`. Sticky category bar, search when there are more than 10 dishes, expandable long descriptions, feedback form. Returns 402 "unavailable" when the subscription is not live. | FE `src/routes/m.$slug.tsx`, `components/public-menu/menu-view.tsx`; BE `src/public-menu/*` |
| Themes and templates | 5 templates (classic, elegant, minimal, street, night) that change fonts, layout, header and category chips. All take the restaurant's brand colour, adjusted for contrast. Fonts load from Google Fonts on demand. The owner dashboard itself has no dark mode. | FE `components/public-menu/templates.ts`, `template-picker.tsx`; BE `restaurant.dto.ts` (`MENU_TEMPLATES`) |
| QR code | Generated in the browser with `qrcode.react`, pointing at the guest menu URL. Download as a 1200 px PNG or a printable table card. No server-side QR. | FE `dashboard/qr.tsx` |
| Analytics | Each guest-menu load posts `/public/menu/{slug}/scan`, stored with a salted visitor hash and de-duplicated. The owner sees scan stats (`/stats/scans`); the admin sees 30-day scans. No third-party analytics script. | BE `src/public-menu/public-menu.service.ts`, `src/insights/*`; FE `dashboard/index.tsx`, `lib/queries.ts` |
| Guest feedback | Rating and comment on the guest menu; the owner reads them in the dashboard | FE `dashboard/feedback.tsx`; BE `insights.controller.ts`, `public-menu` |
| **Languages** | **French only.** All strings are hard-coded; no i18n library or translation files. i18n-iso-countries is used only for country names in the sign-up form. | — |
| **30-day trial** | Created automatically, together with the restaurant, in one transaction: status `trialing`, `trialEndsAt = now + TRIAL_DAYS` (30). `POST /subscription/start-trial` covers older accounts. An expired trial or paid period counts as `past_due` (`effectiveStatus`), and the guest menu then returns 402. | BE `restaurant.service.ts`, `billing/subscription-status.ts`, `billing/billing.service.ts` |
| **Subscriptions and billing** | Cash only, Tunisia only. Plans come from `PAYMENT_PLANS` (`1:49,12:490` → 49 DT/month or 490 DT/year). The owner creates a payment request (plan + WhatsApp/email/phone), gets a reference code, and the admin is emailed. The admin collects the cash and marks it paid, which extends `currentPeriodEnd` from the later of now and the current end; the owner gets an email. One pending request per user at a time. The admin can also record a cash payment directly, extend a trial or suspend an account. **No online payment provider is integrated.** | BE `src/billing/*`, `src/admin/*`; FE `dashboard/billing.tsx`, `admin.payments.tsx`, `admin.accounts.tsx` |
| Admin dashboard | Overview: accounts, live menus, revenue this month / total / 12 months, statuses, accounts expiring in 7 days. Accounts list with search and filters, and a detail panel. Payment queue. | FE `src/routes/_authenticated/admin.*.tsx`, `components/admin/admin-shared.tsx`; BE `src/admin/*` |
| Health | `/health/live` (process up), `/health/ready` (database reachable) | BE `src/health/*` |

---

## 6. Credentials

"Live" or "test" is judged only from variable names, hosts and key prefixes. Production values on the server were **not** inspected; their names come from `deployment/bootstrap-env.sh`, the template used to create `/opt/tableqr/.env.production`.

| Service | Env variable names | Files that use them | Test or live | Used? |
|---|---|---|---|---|
| PostgreSQL | `DATABASE_URL`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | `prisma/schema.prisma`, `src/config/environment.ts`, `deployment/compose.production.yml`, `bootstrap-env.sh` | Local: localhost:5434 (dev). Prod: internal host `postgres` (generated password). | used |
| JWT | `JWT_SECRET`, `JWT_EXPIRES_IN` | `src/shared.module.ts`, `src/config/environment.ts` | Prod value generated by `openssl rand` | used |
| Scan hashing | `SCAN_HASH_SALT` | `src/public-menu/public-menu.service.ts`, `environment.ts` | Prod value generated | used |
| App URLs / CORS | `FRONTEND_URL`, `CORS_ORIGINS`, `NODE_ENV`, `PORT` | `src/mail/mail.service.ts`, `src/app.setup.ts`, `src/main.ts` | Local: localhost. Prod: menu.arishub.site | used |
| Resend (email) | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | `src/mail/mail.service.ts`, `environment.ts` | Backend local: key empty, sender on `resend.dev` (sandbox). Prod: sender on `mail.arishub.site` (live domain). | used |
| Resend, in the **frontend** `.env` | `RESEND_API_KEY` | **no frontend file** | `re_…` key (Resend has no test/live split) | **unused**, and should not be in the frontend at all |
| Cloudinary | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER`, `CLOUDINARY_LIBRARY_FOLDER` | `src/media/media.service.ts`, `environment.ts` | Local: empty. Prod: set (no test/live split at Cloudinary) | used |
| OpenRouter (AI) | `OPENROUTER_API_KEYS`, `OPENROUTER_MODEL` | `src/ai/ai.service.ts`, `environment.ts` | Local backend: empty. Prod: set. Model list mixes a `:free` model and a paid one. | used |
| OpenRouter, in the **frontend** `.env` | `VITE_OPENROUTER_KEYS` | **no current file.** Used in browser code in the old commit `1ca90b4` | `sk-or-v1-…` = **live** key format | **unused now, but exposed** (see below) |
| Payment contacts | `PAYMENT_WHATSAPP`, `PAYMENT_CONTACT_EMAIL`, `PAYMENT_PHONE` | `src/billing/billing.service.ts` | Not secret | used (missing from the local backend `.env`) |
| Pricing and trial | `PRICE_TND`, `PAYMENT_PLANS`, `TRIAL_DAYS` | `billing.service.ts`, `restaurant.service.ts` | Not secret | used |
| Admin | `ADMIN_EMAILS` | `src/common/admin.ts`, `environment.ts`, `test/e2e-env.ts` | Not secret | used |
| Paddle | `PADDLE_ENV`, `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `PADDLE_PRICE_ID` | **none** | Local `PADDLE_ENV=sandbox`; keys empty | **unused** (left over from an earlier Paddle plan) |
| Multi-currency prices | `PRICE_EUR`, `PRICE_USD` | **none** | Not secret | **unused** |
| Frontend API URL | `VITE_API_URL` | `src/lib/api.ts`, `src/routes/verify-email.tsx`, `.env.production` (committed, public), CI `vars.VITE_API_URL` | Production URL | used |
| GitHub Actions deploy | secrets `VPS_HOST`, `VPS_PORT`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS`; built-in `GITHUB_TOKEN` (GHCR push) | `.github/workflows/ci-cd.yml` | Live | used |

### Secrets found in code or git history

**Exposed keys:**
- **OpenRouter key exposed (critical).** The frontend `.env` was committed in `292aac5` ("prod v1"), `1ca90b4` ("prod v2") and `31a97e5` ("register"), and only removed from tracking in `e7edfa5`.
  - `1ca90b4` adds `VITE_OPENROUTER_KEYS` and reads it in browser code (`src/lib/api.ts` at that commit, `import.meta.env.VITE_OPENROUTER_KEYS`). Any build from that period put the key in public JavaScript.
  - The key in history is **the same key that is in the local frontend `.env` today**.
  - These commits are in `origin/main` (private) and in `mehdi-origin/main` (`mehdichekir/dine-qr-style`; its visibility was not checked).
  - It is not known whether the production backend uses the same key.
- **Resend key exposed.** Commit `31a97e5` also contains the frontend `RESEND_API_KEY`, again identical to the current local value.

**False positives:** the secret-pattern scan of tracked files found no other real keys. Its other hits were:
- the test database URL in `ci-cd.yml:39`
- a dummy URL in `src/config/environment.spec.ts:4`
- the generated password in `bootstrap-env.sh:16`
- test passwords in `test/app.e2e-spec.ts` (lines 99, 122, 302, 427, 433)
- `@IsUrl` decorators in `menu.dto.ts` and `restaurant.dto.ts`

**Audit note:** while checking the commit above, the full value of the leaked OpenRouter key was shown once in the auditor's own command output (not in this file). That is one more reason to rotate it.

---

## 7. Quality

| Check | Frontend | Backend |
|---|---|---|
| Lint | `eslint .`: 0 errors, 10 warnings (react-refresh export rule ×9, one missing `navigate` hook dependency in `verify-email.tsx`) | `eslint`: clean |
| Type check | `tsc --noEmit`: clean | `tsc --noEmit`: clean |
| Unit tests | **none** | 27 tests in 6 suites, all pass (plans, subscription status, AI service, menu parser, env validation, error filter) |
| E2E tests | none (browser checks were run ad hoc during development, not committed) | `test/app.e2e-spec.ts`: 10 scenarios across the whole API, run in CI against Postgres; not run in this audit (local Docker was off) |
| CI | `ci.yml`: lint + build | `ci-cd.yml`: format, lint, types, unit, migration drift, e2e, image, deploy |
| CI status | Not checkable here (`gh` not installed) | Latest `main` (`243e168`) is the deployed image, so the pipeline passed through deploy |
| Dependency audit | 9 production advisories (6 high: `vite` (direct), `postcss`, `nanoid`, `js-yaml`, `undici`, `browserslist`), mostly build-time | `npm audit` reports issues, some needing breaking upgrades; Dependabot is configured |
| TODO/FIXME | none | none |

### Problems found

**Security**
1. **Leaked live keys.** The OpenRouter and Resend keys in git history (section 6) still need rotating.
2. **JWT in `localStorage`.** Any successful cross-site scripting (XSS) attack can steal a session that lasts 7 days. Mitigations today: no `dangerouslySetInnerHTML` on user content, and React escaping. There is no Content-Security-Policy header in `public/_headers`.
3. **Admin role from an env variable.** Admins are whoever is in `ADMIN_EMAILS`. That's fine for one operator, but it can't be audited in the database.
4. **SSH open to the internet.** Port 22 on the VPS shows constant brute-force attempts in the logs. Firewall rules only cover 80/443; SSH key-only login was not checked.
5. **Leftover ngrok host.** `vite.config.ts` allows the ngrok host `andrew-mistyped-mercedez.ngrok-free.dev` for the dev server.

**Operations**
6. **Single VPS, shared with ArisHub.** No swap, backups on the same disk (no off-site copy), no uptime monitoring. It froze once on 2026-10-01 without leaving a trace in the logs.
7. **No staging environment.** Cloudflare preview builds point at the production API, and CORS blocks them anyway.
8. **AI depends on credit.** AI import relies on OpenRouter credit and a free-tier model that can rate-limit.

**Dead code and outdated docs**
9. **TanStack Start leftovers.** `src/server.ts`, `src/start.ts`, `lib/error-capture.ts`, `lib/error-page.ts` and the dependencies `@tanstack/react-start` and `resend` are never used by the SPA.
10. **Outdated API spec.** `API_ENDPOINTS.md` (port 3000, old response shapes) no longer matches the API.
11. **Unused variables.** Paddle and `PRICE_EUR` / `PRICE_USD` remain in the local backend `.env`.
12. **Prices in two places.** The landing page hard-codes 49 / 490 (`PRICING` in `src/routes/index.tsx`); the backend reads `PAYMENT_PLANS`. They must be changed together.

**Product gaps**
13. **French only.** No Arabic or English, and no RTL support, although the market is Tunisia.
14. **One restaurant per account,** no staff accounts, no online payment.
15. **Uncommitted change.** The `.gitignore` edit (ignoring `SKILL.md`) is still uncommitted.

---

## 8. Conflicts with docs/PLAN.md

**`docs/PLAN.md` does not exist** in either repository, so there is nothing to compare against. Send the plan, or say where it lives, and this section can be filled in.

---

## 9. Questions before Phase 0

1. **The plan:** where is `docs/PLAN.md`, and what does Phase 0 cover?
2. **Key rotation:** can the OpenRouter and Resend keys be rotated now? Was the Lovable-era build (commit `1ca90b4`) ever deployed publicly? Is `mehdichekir/dine-qr-style` public, and should that remote be removed or that repo deleted or made private?
3. **Domain:** is `arishub.site` still temporary? What is the final domain and when does it change? Guest QR codes encode `menu.arishub.site/m/{slug}`, so printed codes break if the domain changes without a redirect.
4. **Online payments:** which provider and when (for example Konnect, Flouci, Paymee, or card payments through ClicToPay)? Should cash requests stay as an option afterwards?
5. **Languages:** should the guest menu (and the dashboard) support Arabic (RTL) and English? Per-dish translations entered by the owner, or automatic?
6. **Account model:** one restaurant per account, or several branches and staff logins?
7. **Hosting:** keep sharing the VPS with ArisHub, or move TableQR to its own server? Is a staging environment wanted, and is an off-site backup target available (S3-compatible bucket, OVH Object Storage)?
8. **Country scope:** sign-up still allows every country, but billing is TND cash only. Should non-Tunisian sign-ups be blocked, or kept for later?
9. **Admins:** keep `ADMIN_EMAILS`, or add a role column with audit logging?
10. **Analytics:** are the built-in scan counts enough, or is a product analytics tool wanted (and is a cookie banner then needed)?
11. **The two older restaurants** (`chez-zriga`, `doja-food`): real customers, or test data to clean up?
