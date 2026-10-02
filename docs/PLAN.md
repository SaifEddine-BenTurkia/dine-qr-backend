# TableQR — Product & Build Plan for Claude Code

Oct 2, 2026 · @saif eddine ben turkia

## 1. How to use this plan with Claude Code

Claude Code builds TableQR's next features in 8 phases (0 to 7), one feature at a time, starting with Phase 0 (security fixes, sandbox guards and foundations). The UI/UX redesign is deliberately last (Phase 7). Every feature has an ID (for example `P1-05`), a scope and acceptance criteria. This version of the plan is based on the codebase audit of 2026-10-02 (`docs/DISCOVERY.md`).

### Where the plan lives

TableQR has two repositories in `C:\ARISHUB\Dev\`:

- `dine-qr-backend` (NestJS API) holds the plan and all project docs: `docs/PLAN.md`, `docs/DISCOVERY.md`, `docs/ARCHITECTURE.md`, `docs/features/`, `docs/CHANGELOG.md`, `docs/QUESTIONS.md`, `docs/UI_DEBT.md`.
- `dine-qr-style` (React frontend) has its own `CLAUDE.md` that points to `../dine-qr-backend/docs/PLAN.md`.

Claude Code is started from `C:\ARISHUB\Dev\` so it sees both repositories. Any ArisHub code in that folder is off-limits.

### Setup in VS Code

1. Export this doc as Markdown to `dine-qr-backend/docs/PLAN.md`. Make sure the audit sits at `dine-qr-backend/docs/DISCOVERY.md`.
2. Put the CLAUDE.md starter below in both repositories and commit.
3. Do the urgent owner steps in section 18 ("Before Phase 0", about 30 minutes) and start Docker Desktop.
4. Open VS Code at `C:\ARISHUB\Dev\`, start Claude Code there, and paste the kickoff prompt.

### Working agreement (rules Claude Code must follow)

- Read `CLAUDE.md`, `docs/PLAN.md` and `docs/DISCOVERY.md` at the start of every session.
- Build in plan order. Start a feature only when the previous one meets its acceptance criteria.
- Before coding a feature, write `docs/features/<ID>-<slug>.md`: files, migrations, endpoints, screens, tests, risks. Then proceed without waiting, except for anything touching money, security, the server, or deleting data: for those, ask first.
- Keep the stack: NestJS 11, Prisma 6, PostgreSQL 17 on the backend; React 19, Vite, TanStack Router and Query, Tailwind 4, shadcn/ui on the frontend. A new library needs a reason in the feature file.
- One branch per feature in each repo it touches: `feat/<ID>-<slug>`. Open a pull request. Before launch, Claude Code may merge to `main` itself once CI passes (merging deploys: backend through GitHub Actions, frontend through Cloudflare Pages). From the first paying customer, only the owner merges.
- Every new feature sits behind a feature flag and a plan entitlement check (section 4).
- **Pre-launch database rule:** there are no real users, so migrations may restructure freely and test data may be deleted or reseeded. The deploy script's pre-deploy backup stays on. From the first paying customer, migrations must be reversible and safe on real data.
- Tests are required: backend Jest unit and e2e (existing pipeline); frontend Vitest and Playwright (added in P0-02). Tests never call real external APIs.
- No secrets in code or in the frontend: frontend `.env` holds only public `VITE_` values. Every new variable goes into `.env.example` with a comment.
- All user-facing text goes through i18n (P0-05): French default, Arabic (RTL), English.
- Money is integer millimes (P0-04). Never floats.
- UI in Phases 1 to 6 is functional, not final: reuse shadcn components and the 5 guest templates, and log shortcuts in `docs/UI_DEBT.md`.
- Third-party endpoints come only from official docs, cited in the feature file.
- **Shared server:** the VPS also runs ArisHub. Claude Code touches only `/opt/tableqr`, `tableqr-*` containers and the TableQR nginx site. Never ArisHub files, containers or sites. Never restart Docker or the server without asking.
- Unclear or conflicting? Note it in `docs/QUESTIONS.md`, continue with a stated safe assumption, and stop only for money, security, server or data-deletion decisions.
- When a feature is done: update `docs/CHANGELOG.md`, tick its checklist, and write what to test manually.

### CLAUDE.md starter

```markdown
# TableQR — instructions for Claude Code

TableQR: digital menu SaaS for restaurants, cafés and hotels in Tunisia. Pre-launch: no real users yet.
Repos: dine-qr-backend (NestJS 11, Prisma 6, PostgreSQL 17, Jest) and dine-qr-style (React 19, Vite 7,
TanStack Router/Query, Tailwind 4, shadcn/ui). Frontend on Cloudflare Pages (menu.arishub.site);
API on an OVH VPS behind Cloudflare + nginx (menu-api.arishub.site), deployed by GitHub Actions.

Always:
- Read dine-qr-backend/docs/PLAN.md and docs/DISCOVERY.md before working.
- One feature ID at a time, in plan order; write docs/features/<ID>-<slug>.md first.
- Feature flags + plan entitlements on every new feature.
- Money = integer millimes (1 TND = 1000). Timezone Africa/Tunis.
- i18n for every user-facing string (fr, ar, en); Arabic renders RTL.
- Tests for logic, endpoints and webhooks; mock all external APIs.
- No secrets in code or in the frontend (VITE_ variables are public).
- Never open .env.sandbox or server env files; use env:check and the smoke scripts.
- Payments, WhatsApp, Google replies and email stay in sandbox/test mode until launch (PLAN section 20).
- The VPS is shared with ArisHub: touch only /opt/tableqr and tableqr-* containers.
  Never ArisHub; never restart Docker or the server without asking.
- Never build review gating. Never raise prices automatically.
- No UI redesign before Phase 7.
- Unclear? Add to docs/QUESTIONS.md; stop only for money, security, server or data deletion.
```

### Kickoff prompt

```text
Read CLAUDE.md, docs/PLAN.md and docs/DISCOVERY.md fully.
Do P0-00 (security fixes and sandbox guards, plan section 8), then P0-01.
Write each feature file first, keep docs/CHANGELOG.md updated, and list
anything you need from me in docs/QUESTIONS.md. Do not touch ArisHub.
```

## 2. Current state (audit of 2026-10-02)

TableQR is live at menu.arishub.site with no real customers: 2 test accounts, 2 test restaurants (`chez-zriga`, `doja-food`) and 32 dishes. The foundations are solid (CI/CD with automatic rollback, nightly backups, backend tests, AI menu import), but the product is French-only, has one restaurant and one user per account, bills in cash only, and two API keys leaked in git history. Details: `docs/DISCOVERY.md`.

### Stack and hosting

| Part | Technology | Where and how it runs |
| --- | --- | --- |
| Frontend `dine-qr-style` | React 19, TypeScript, Vite 7 single-page app, TanStack Router and Query, Tailwind 4, shadcn/ui, Recharts | Cloudflare Pages; every push to `main` deploys; other branches get preview URLs |
| Backend `dine-qr-backend` | NestJS 11, Prisma 6, PostgreSQL 17, Jest | Docker on an OVH VPS (4 vCores, 8 GB RAM) behind nginx and Cloudflare. GitHub Actions: checks → images → deploy with backup, migration, health check and automatic rollback |
| Email | Resend | Transactional emails (verification, reset, billing) |
| Images | Cloudinary | Uploads and a shared image library |
| AI | OpenRouter | Menu import, several models with fallback (one free tier) |
| Server | Shared with ArisHub | Nightly backups on the same disk only; no swap, no monitoring; froze once on 2026-10-01 |

### What already works

| Area | Today |
| --- | --- |
| Accounts | Email and password, email verification, password reset, JWT (7 days, stored in the browser), admins listed in `ADMIN_EMAILS` |
| Restaurant | One per account: name, slug, description, logo, brand color, 5 guest templates (classic, elegant, minimal, street, night) |
| Menu editor | Categories and dishes, reorder, availability switch, prices in DT with 3 decimals, images |
| AI menu import | Photo or text → proposed categories and dishes, accepted by the owner |
| Guest menu | `/m/{slug}`: category bar, search, descriptions, feedback form; returns 402 (offline) when the subscription is not live |
| QR code | Generated in the browser: 1200 px PNG and a printable table card |
| Analytics | Deduplicated scan counts for owner and admin |
| Feedback | Rating and comment from guests, read in the dashboard |
| Trial and billing | 30-day trial created with the restaurant. One plan: 49 DT per month or 490 DT per year, paid in cash through payment requests that the admin confirms. No online payment |
| Admin | Overview (accounts, revenue), accounts list, payment queue, extend trial, suspend |

### Gaps this plan closes

- **Security:** leaked OpenRouter and Resend keys; session token in the browser without a Content-Security-Policy; SSH open to the internet; local development pointed at the production API.
- **Reliability:** no swap, no off-site backup, no uptime monitoring, no staging.
- **Product:** French only and no right-to-left layout; one restaurant and one user per account; no tables, service buttons, schedules, reviews hub, WhatsApp, ordering or online payments.
- **Commercial:** one flat plan; prices duplicated between the landing page and the backend environment.

## 3. Strategy: positioning, goals, target segments

TableQR moves from "a menu guests look at" to "a tool that makes the restaurant more money and saves staff time." View-only QR menus are a commodity: a complete QR menu system with source code sells for $50 on [Khamsat](https://khamsat.com/programming/custom-website-development/4283936), view-only menus in West Africa are quoted around 5,000 FCFA per month ([Kolonell](https://kolonell.com/fr/blog/menu-qr-code-commande-table-restaurant-2026)), and even in France a view-only QR menu costs about €69 per month, with ordering priced higher ([Pennylane / TastyCloud](https://www.pennylane.com/fr/blog/contenu-dirigeants/qr-code-indispensable-reouverture-restaurant)). Price follows measurable value, so every feature in this plan must produce a number the owner can see.

### Product principles

- **Prove value on screen.** Each feature writes events that feed the ROI dashboard (`P1-09`): extras sold, reviews gained, waiter calls answered, time saved.
- **Local first.** French, Arabic and Darija, tourist languages, TND, Tunisian payments, Ramadan, WhatsApp.
- **Owner on a phone.** Every owner action must work one-handed on a phone between services.
- **AI suggests, the owner decides.** Replies, prices and decisions are proposed; humans approve anything public or financial.
- **Compliant by design.** No review gating, no automatic price increases, consent for marketing (section 5).

### Target segments

| Priority | Segment | Main pains | Plan to sell |
| --- | --- | --- | --- |
| 1 | Mid and upscale restaurants in cities (Tunis, La Marsa, Les Berges du Lac, Sfax, Sousse) | Slow service, Google reputation, reprinting menus, unknown best-sellers | Pro, then Business |
| 1 | Tourist-area restaurants (Hammamet, Sousse, Monastir, Djerba) | Languages, tourist reviews on Google, card payments | Pro, then Business |
| 2 | Hotels | Several outlets, room service, many languages | Hôtel / Chaîne |
| 3 | Cafés and salons de thé | Catching the waiter, WiFi requests, loyalty; very price-sensitive | Essentiel or Pro |
| 3 | Fast food and takeaway | Ordering speed, takeaway, WhatsApp orders | Business |

Do not price for the corner café. Cafés are volume on the cheap plan; the revenue comes from priority 1 and 2.

### Metrics to track from Phase 0

- **Activation:** share of new signups with a live menu within 24 hours.
- **Trial to paid conversion** at day 30.
- **ARPA:** average revenue per account per month, in TND.
- **Plan mix:** share of accounts on Pro or higher.
- **Monthly churn.**
- **Value delivered per account:** the ROI dashboard totals (extras sold, reviews, calls).

Targets for these are set by the owner (section 19).

### Brand note

"TableQR" is generic and close to an existing product, TableMenuQR ([Capterra](https://www.capterra.com.au/software/1096515/TableMenuQR)). A subdomain on arishub.site also reads as a side project. Because no real customer has printed a QR code yet, the final domain is handled early, in `P0-13`; an optional rename stays in `P7-04`. The code never hardcodes the domain or name.

## 4. Plans, pricing, add-ons and entitlements

TableQR sells four plans plus add-ons. Prices below are starting hypotheses to test with customers, so every price, limit and plan assignment must live in the database and be editable from a super-admin screen, never hardcoded.

**Today:** one plan at 49 DT per month or 490 DT per year, paid in cash through payment requests the admin confirms. Prices sit in the backend env (`PAYMENT_PLANS`) and are hardcoded on the landing page; `P0-03` moves them into the `Plan` table. Today's 49 DT sits between the proposed Essentiel and Pro prices.

### Plans (prices in TND per month, excluding tax)

| Plan | For | Starting price to test | Core idea |
| --- | --- | --- | --- |
| Essentiel | Cafés, small places | 29–39 | A beautiful, fast, multilingual menu |
| Pro | Restaurants | 79–99 | Service buttons, reviews hub, schedules, ROI dashboard |
| Business | Busy restaurants, fast food | 179–249, optional small fee on online payments | Table ordering, kitchen display, payments, smart pricing, loyalty |
| Hôtel / Chaîne | Hotels, multi-branch groups | From \~500, or custom quote | Multi-outlet, room service, central dashboard |

Also: annual billing with 2 months free; an optional one-time setup fee of 150–300 TND (menu entry, translations, printed stands); printed QR stands sold as hardware.

Trial: 30 days with Pro features unlocked (a "reverse trial"), so owners experience the value before choosing. What happens at day 30 is an open question (section 19).

### Add-ons

| Add-on | Available on | Starting price to test |
| --- | --- | --- |
| Conseiller IA (decision engine) | Pro | \~49 TND/month (included in Business) |
| Guest WhatsApp bot | Business, Hôtel | \~59 TND/month + WhatsApp message costs passed through |
| Marketing campaigns | Business, Hôtel | Pay per message sent |
| Extra location | Business | Per location per month |

### Entitlement matrix

Use these keys in code. "Limit" values are numbers stored per plan.

| Entitlement key | Feature | Essentiel | Pro | Business | Hôtel / Chaîne |
| --- | --- | --- | --- | --- | --- |
| `menu.core` | Menu, categories, photos, QR | Yes | Yes | Yes | Yes |
| `menu.languages` | Number of menu languages | 2 | Unlimited | Unlimited | Unlimited |
| `menu.ai_translate` | AI translation | No | Yes | Yes | Yes |
| `menu.ai_import` | AI import from photo/PDF (per month) | 1 | 10 | 30 | 100 |
| `menu.sold_out` | Sold-out toggle | Yes | Yes | Yes | Yes |
| `menu.schedules` | Scheduled menus, happy hour, Ramadan | No | Yes | Yes | Yes |
| `tables.per_table_qr` | One QR per table | No | Yes | Yes | Yes |
| `service.wifi` | WiFi button | Yes | Yes | Yes | Yes |
| `service.calls` | Call waiter, request bill | No | Yes | Yes | Yes |
| `guest.selection` | "Ma sélection" list | Yes | Yes | Yes | Yes |
| `feedback.guest` | In-menu feedback and alerts | No | Yes | Yes | Yes |
| `analytics.basic` | Scans and views | Yes | Yes | Yes | Yes |
| `analytics.roi` | ROI dashboard and menu insights | No | Yes | Yes | Yes |
| `print.studio` | Print templates | 1 template | All | All | All |
| `reports.weekly` | Weekly report (email, WhatsApp) | No | Yes | Yes | Yes |
| `reviews.hub` | Google reviews sync and AI drafts (per month) | No | 100 | 300 | 1,000 |
| `reviews.auto_publish` | Auto-publish rules | No | Yes | Yes | Yes |
| `ai.advisor` | Conseiller IA | No | Add-on | Yes | Yes |
| `whatsapp.owner` | Owner alerts and approvals on WhatsApp | No | Yes | Yes | Yes |
| `ordering.table` | Table ordering | No | No | Yes | Yes |
| `ordering.kds` | Kitchen display and ticket printing | No | No | Yes | Yes |
| `payments.online` | Flouci, Konnect, split bill | No | No | Yes | Yes |
| `ordering.upsell` | Upsell rules | No | No | Yes | Yes |
| `pricing.smart` | Costs, margins, deals, price suggestions | No | No | Yes | Yes |
| `loyalty.stamps` | Digital stamp card | No | No | Yes | Yes |
| `crm.campaigns` | Guest campaigns | No | No | Add-on | Add-on |
| `locations.max` | Locations | 1 | 1 | 1 (+ add-on) | Unlimited |
| `staff.max` | Staff accounts | 1 | 5 | 15 | Unlimited |
| `hotel.room_service` | Outlets and room service | No | No | No | Yes |
| `whatsapp.guest_bot` | Guest WhatsApp bot | No | No | Add-on | Add-on |

### Implementation rules (built in `P0-03`)

- A single helper decides access, for example `can(restaurant, "service.calls")` and `limit(restaurant, "reviews.hub")`. It is checked on the server for every request, not only in the UI.
- Usage counters per restaurant per month for every limited key (AI imports, review drafts, WhatsApp messages, AI tokens).
- Locked features stay visible with a short upgrade prompt ("Disponible avec Pro"), because that is how owners discover the next plan.
- Super-admin can override any entitlement for one restaurant (pilots, partners, discounts).
- There are no customers to migrate yet; test accounts are reseeded.

## 5. Tunisia constraints and legal/policy guardrails

These rules are non-negotiable and apply to every phase. If a feature request conflicts with one of them, Claude Code must stop and flag it.

### Local conventions

| Topic | Rule for the code |
| --- | --- |
| Currency | TND. 1 dinar = 1,000 millimes. Store all amounts as integer millimes (`12500` = 12.500 DT). Display format comes from locale config (default French: `12,500 DT`). |
| Timezone | `Africa/Tunis` for schedules, reports, "today", and Ramadan times. Store timestamps in UTC. |
| Dates | Display `dd/mm/yyyy`. Weeks start Monday. |
| Languages (UI and menus) | French (default), Arabic (full RTL layout, not just translated text), English. Menu content also in German, Italian, Russian for tourists. Locale list must be configurable. |
| Darija | Reviews and WhatsApp messages often use Tunisian Darija in Latin letters with digits ("3ajbetni barcha", "9adech"). All AI parsing and classification must handle it, plus Arabic script and French/Arabic mixing. |
| Ramadan | Dates move every year and iftar time changes daily by city. Never hardcode. Owner sets the period and service hours, or the app uses a maintained prayer-time source configured per city. |
| Alcohol | Some venues sell alcohol, many do not. Items carry a `contains_alcohol` flag; schedules can hide categories during a period (for example during Ramadan). |

### Legal and platform rules

| Rule | What the code must do | Source |
| --- | --- | --- |
| Price display is mandatory. Not displaying prices, displaying them incompletely, or lacking a compliant price board is an offence under law n°36 of 2015, with fines of 50 to 2,000 TND. Consumers have a right to know prices before buying. | The price shown when a guest orders is the price charged, locked on the order. Any price change is logged. The printable price board (`P5-06`) always matches the live menu. | [allAfrica, May 2026](https://fr.allafrica.com/stories/202605270171.html) |
| Some café drink prices have been set by the Ministry of Commerce, with partial liberalization decided on 7 June 2021. | Items carry `is_price_regulated`. Smart pricing (`Phase 5`) never touches regulated items. | [African Manager](https://africanmanager.com/liberalisation-des-prix-de-trois-boissons-chaudes/), [Tunisie Numérique](https://www.tunisienumerique.com/tunisie-liberalisation-des-prix-de-3-boissons-chaudes/) |
| Cash registers are becoming mandatory in phases: tourist-classified restaurants, tea rooms and 2nd/3rd category cafés from 1 November 2025; other companies serving on-site from 1 July 2026; individuals on the real tax regime from 1 July 2027. | Order and price data must be exportable and consistent with the register. Integration is researched in `P6-07`. | [La Presse](https://www.lapresse.tn/2025/10/15/restauration-cafes-salons-de-the-les-caisses-enregistreuses-deviennent-obligatoires-en-tunisie/) |
| Google prohibits "review gating": discouraging negative reviews or selectively asking happy customers for reviews. Gating can lead to review removal. | Every guest sees the same Google review option, whatever rating they gave. No discounts or rewards for reviews. Private feedback is allowed but never replaces or filters the Google option. | [Vendasta](https://www.vendasta.com/blog/?p=69382), [Synup](https://synpost.synup.com/what-is-review-gating/) |
| Since 15 January 2026, Meta prohibits general-purpose AI chatbots on the WhatsApp Business Platform; business-specific bots (support, bookings, sales) remain allowed. | WhatsApp bots stay inside their business task. Off-topic questions get a short redirect to a human, never open-ended AI answers. | [respond.io](https://respond.io/blog/whatsapp-ai-chatbot-policy) |
| WhatsApp messaging windows and opt-in. | Free-form replies only within 24 hours of the user's last message. After that, only pre-approved templates. Marketing messages only to contacts who opted in, with a working opt-out. | Meta WhatsApp Cloud API docs (section 16) |
| Personal data: Tunisia's personal data law (Organic Law 2004-63) and its authority, the INPDP. | Collect guest phone numbers or emails only with explicit, logged consent per purpose (loyalty, marketing). Export and delete on request. Define retention periods. Declaration obligations are an open question for the owner (section 19). | To confirm with a local lawyer |
| Honest food images. | AI may enhance an owner's own photo (light, crop, background). Never generate fake dish photos presented as the real dish. | Product rule |

## 6. Architecture principles and cross-cutting requirements

The stack stays as audited: NestJS 11, Prisma 6 and PostgreSQL 17 for the API; a React 19 + Vite single-page app with TanStack Router and Query, Tailwind 4 and shadcn/ui for the frontend. New infrastructure reuses what already runs: PostgreSQL for jobs (pg-boss), Server-Sent Events through nginx and Cloudflare for realtime. A new server process needs a reason in the feature file.

### Pre-launch and post-launch rules

- **Pre-launch (no real users):** schema, URLs and data may change freely; test data can be deleted or reseeded.
- **From the first paying customer:** printed QR links are a public contract and never break (old formats redirect); migrations are reversible and data-safe; new features reach pilot restaurants first, behind flags.
- **Shared server:** TableQR work touches only `/opt/tableqr`, `tableqr-*` containers and the TableQR nginx site. Changes that affect the whole VPS need the owner's approval.

### Multi-tenancy

- Hierarchy: `Account` (the business that pays) → `Location` (one venue; the existing Restaurant model) → `Table`. Hotels add `Outlet` between Location and menus (`P6-04`).
- Every query is scoped by tenant. Add an automated test that fails if one restaurant can read another's data.
- Roles: `owner`, `manager`, `staff` (waiter), `kitchen`, plus internal `superadmin`.

### Guest identity and QR security

- QR URL carries an opaque, random table token, never a sequential ID: `https://<domain>/m/<location-slug>?t=<table_token>`.
- Each guest visit gets an anonymous session ID (no login) used for events, "ma sélection", feedback and orders.
- Rate-limit service calls and orders per session and per table, so nobody can spam "call waiter" from outside the restaurant. Owners can rotate a table's token.

### Modules

Organize new code into clear modules with their own folder, tests and docs: `menu`, `tables`, `guest`, `service`, `feedback`, `analytics`, `reports`, `reviews`, `advisor`, `whatsapp`, `leads`, `ordering`, `kitchen`, `payments`, `pricing`, `loyalty`, `crm`, `billing`, `admin`.

### Integrations behind adapters

Every external service sits behind an interface with a real implementation and a fake for tests:

- `LLMProvider` (OpenRouter today)
- `ReviewsProvider` (Google Business Profile)
- `MessagingProvider` (WhatsApp Cloud API, email)
- `PaymentProvider` (Flouci, Konnect)
- `PrinterAdapter` (ESC/POS thermal printers)

### Background work

- A pg-boss queue (stored in the existing PostgreSQL) with retries and exponential backoff for AI calls, review sync, WhatsApp sends, PDF generation and reports.
- `@nestjs/schedule` for recurring jobs (review sync, weekly reports, schedule switching, insights). All schedules use `Africa/Tunis`.
- Jobs are idempotent: running one twice never sends two messages or posts two replies.

### Webhooks

- Verify signatures on every inbound webhook (WhatsApp, payments).
- Store the raw payload, process asynchronously, and deduplicate by provider event ID.

### Realtime

- Waiter calls, bill requests and orders reach staff screens within 2 seconds, through Server-Sent Events from NestJS.
- nginx disables response buffering on the stream route; the server sends a heartbeat every 25 seconds so nginx and Cloudflare keep the connection open.
- Fallback: polling every 5 seconds.

### AI layer

- Provider: OpenRouter, already used in `src/ai`, moved behind `LLMProvider` in P0-10. Paid model variants outside development.
- Prompts live in the repo under `prompts/`, versioned, one file per task.
- AI outputs are structured JSON validated against a schema; invalid output is retried once, then fails safely.
- Model IDs come from environment variables (section 16), so they can change without code edits.
- Log tokens and cost per account per task (feeds usage limits).
- Send the minimum personal data to the model. Strip phone numbers and emails from review text before analysis.
- Anything public (review replies) or financial (prices) needs human approval unless an explicit owner rule allows it.

### Events (analytics backbone)

An append-only `events` store records guest and staff actions. Every feature in Phases 1 to 6 emits events. Minimum fields: `type`, `account_id`, `location_id`, `table_id`, `session_id`, `item_id`, `occurred_at`, `props` (JSON). Event types are listed in `P0-06`.

### Audit log

Record who changed what and when for: prices, plans and entitlements, published review replies, schedules, payment settings, staff roles.

### Configuration

Product name, domain, brand colors, supported locales, plan prices and limits come from config or the database, never from code constants.

## 7. Core data model

This is the target model. Existing Prisma models map onto it: `User` stays (login identity); `Restaurant` is the plan's "Location" (keep the name `Restaurant` in code); `Category` and `Dish` (the plan's "Item") stay; `Subscription` moves from `User` to `Account`; `Scan` evolves into `GuestSession` and `Event`; `Feedback` gains tags, table and consent fields; `PaymentRequest` (cash) stays and links to a `Plan`. New models arrive only in the phase that needs them. Money fields hold integer millimes and translatable text is JSON keyed by locale. Prisma uses camelCase field names; this doc uses snake\_case for readability.

### Foundation (Phase 0 and 1)

| Entity | Key fields | Phase |
| --- | --- | --- |
| `Plan` | `code` (essentiel, pro, business, hotel), `name_i18n`, `price_monthly_millimes`, `price_yearly_millimes`, `entitlements` (JSON), `active` | P0-03 |
| `Account` | `name`, `plan_id`, `plan_status` (trial, active, past\_due, cancelled), `trial_ends_at`, `billing_cycle`, `entitlement_overrides` (JSON) | P0-03 |
| `UsageCounter` | `account_id`, `key`, `period` (YYYY-MM), `count` | P0-03 |
| `User` | `account_id`, `name`, `email`, `phone`, `role`, `location_ids`, `whatsapp_opt_in`, `notification_prefs` | P0-11 |
| `Location` | `account_id`, `name`, `slug`, `city`, `address`, `phone`, `timezone`, `default_locale`, `enabled_locales`, `wifi_ssid`, `wifi_password`, `google_location_name` (nullable), `theme` (JSON) | P0-01 |
| `Table` | `location_id`, `label`, `zone`, `seats`, `token` (random, rotatable), `active` | P1-01 |
| `Menu` | `location_id`, `name`, `is_default` | existing |
| `Category` | `menu_id`, `name_i18n`, `position`, `visible` | existing |
| `Item` | `category_id`, `name_i18n`, `description_i18n`, `price_millimes`, `photos`, `allergens`, `dietary_tags`, `spicy_level`, `contains_alcohol`, `is_price_regulated`, `is_sold_out`, `sold_out_until`, `prep_station`, `position` | existing + P1 |
| `TranslationMeta` | `entity`, `entity_id`, `field`, `locale`, `source` (manual, ai), `reviewed`, `source_hash` (detects stale translations) | P1-03 |
| `MenuImport` | `location_id`, `files`, `status` (uploaded, extracting, review, applied, failed), `extracted` (JSON), `warnings`, `applied_at` | P1-02 |
| `Schedule` | `location_id`, `name`, `kind` (daily, period, ramadan, happy\_hour), `days_of_week`, `start_time`, `end_time`, `start_date`, `end_date`, `show_category_ids`, `hide_category_ids`, `deal_id` (nullable) | P1-07 |
| `GuestSession` | `location_id`, `table_id`, `locale`, `device_class`, `started_at`, `last_seen_at` | P0-06 |
| `Event` | `type`, `account_id`, `location_id`, `table_id`, `session_id`, `item_id`, `occurred_at`, `props` | P0-06 |
| `ServiceRequest` | `location_id`, `table_id`, `session_id`, `type` (waiter, bill\_cash, bill\_card), `status` (open, acknowledged, done, cancelled), `acknowledged_by`, `acknowledged_at`, `resolved_at` | P1-05 |
| `Selection` | `session_id`, `lines` \[{`item_id`, `qty`, `note`}\] | P1-12 |
| `Feedback` | `location_id`, `table_id`, `session_id`, `rating` (1–5), `tags`, `comment`, `google_link_clicked`, `contact_consent`, `contact` (only with consent), `alert_sent_at`, `resolved_by`, `resolved_at` | P1-08 |
| `Notification` | `user_id`, `channel` (in\_app, email, whatsapp), `type`, `payload`, `status`, `sent_at` | P0-08 |
| `AIUsage` | `account_id`, `task`, `model`, `tokens_in`, `tokens_out`, `cost_usd_micros`, `created_at` | P0-10 |
| `AuditLog` | `actor_id`, `account_id`, `action`, `entity`, `entity_id`, `before`, `after`, `created_at` | P0-09 |

### Reviews and advisor (Phase 2)

| Entity | Key fields |
| --- | --- |
| `GoogleConnection` | `account_id`, `google_account_name`, `refresh_token` (encrypted), `scopes`, `status`, `connected_by`, `last_error` |
| `Review` | `location_id`, `source` (google, in\_app), `external_name` (Google resource name), `author_display_name`, `rating`, `text`, `language`, `created_at_source`, `updated_at_source`, `reply_text`, `reply_state`, `reply_policy_violation`, `synced_at` |
| `ReviewAnalysis` | `review_id`, `sentiment` (-1 to 1), `topics` \[{`topic`, `sentiment`, `evidence_span`}\], `item_ids`, `staff_names`, `language`, `prompt_version`, `model` |
| `ReplyDraft` | `review_id`, `text`, `locale`, `status` (draft, approved, scheduled, published, rejected, failed), `mode` (manual, auto), `approved_by`, `publish_at`, `prompt_version` |
| `ReplyRule` | `location_id`, `mode_by_rating` (JSON: 1–5 → manual or auto), `delay_minutes`, `tone`, `signature`, `enabled` |
| `Insight` | `location_id`, `period_start`, `type`, `title_i18n`, `body_i18n`, `evidence` (JSON), `action`, `expected_impact`, `confidence`, `sample_size`, `status` (new, accepted, dismissed, done), `metric_key`, `baseline_value`, `followup_value`, `followup_due_at` |

### WhatsApp and leads (Phase 3)

| Entity | Key fields |
| --- | --- |
| `WaContact` | `wa_id` (E.164 phone), `profile_name`, `kind` (lead, owner, guest), `locale`, `opt_in_marketing`, `opt_in_at`, `last_inbound_at` |
| `WaMessage` | `contact_id`, `direction`, `wamid`, `type`, `payload`, `status` (sent, delivered, read, failed), `template_name`, `pricing_category`, `created_at` |
| `BotSession` | `contact_id`, `flow` (sales\_qualification), `state`, `data` (JSON), `expires_at` |
| `Lead` | `contact_id`, `answers` (JSON), `score`, `recommended_plan`, `recommended_addons`, `status` (new, qualified, demo\_sent, trial\_started, won, lost), `demo_location_id`, `assigned_to`, `source` (utm, ad id) |

### Ordering and payments (Phase 4)

| Entity | Key fields |
| --- | --- |
| `ModifierGroup` / `Modifier` | `item_id`, `name_i18n`, `min`, `max` / `name_i18n`, `price_delta_millimes` |
| `Order` | `location_id`, `table_id`, `session_id`, `status` (placed, accepted, preparing, ready, served, cancelled), `subtotal_millimes`, `discount_millimes`, `total_millimes`, `note`, `placed_at` |
| `OrderLine` | `order_id`, `item_id`, `name_snapshot`, `unit_price_millimes_snapshot`, `qty`, `modifiers_snapshot`, `station`, `status` |
| `Bill` | `location_id`, `table_id`, `order_ids`, `total_millimes`, `split_mode` (none, equal, by\_items), `status` (open, partially\_paid, paid) |
| `Payment` | `bill_id`, `provider` (flouci, konnect, cash, card\_terminal), `provider_ref`, `amount_millimes`, `status`, `raw_webhook`, `paid_at` |
| `UpsellRule` | `location_id`, `trigger_item_ids`, `trigger_category_ids`, `suggest_item_ids`, `message_i18n`, `schedule_id`, `active` |
| `Printer` | `location_id`, `name`, `station`, `connection` (network IP, bridge), `paper_width` |

### Pricing, loyalty, CRM (Phases 5 and 6)

| Entity | Key fields |
| --- | --- |
| `Ingredient` | `account_id`, `name`, `unit`, `cost_per_unit_millimes`, `cost_updated_at` |
| `RecipeLine` | `item_id`, `ingredient_id`, `qty` |
| `PriceChange` | `item_id`, `old_price_millimes`, `new_price_millimes`, `reason`, `source` (manual, suggestion), `approved_by`, `effective_at` |
| `PriceSuggestion` | `item_id`, `suggested_price_millimes`, `rationale`, `status` (new, accepted, dismissed) |
| `Deal` | `location_id`, `kind` (off\_peak, end\_of\_day), `item_ids`, `category_ids`, `discount_percent` or `discount_millimes`, `schedule_id`, `max_per_day` |
| `GuestProfile` | `account_id`, `phone`, `name`, `locale`, `first_seen_at`, `visits` |
| `Consent` | `guest_profile_id`, `purpose` (loyalty, marketing), `granted_at`, `source`, `revoked_at` |
| `LoyaltyProgram` / `LoyaltyCard` | `stamps_required`, `reward_i18n` / `guest_profile_id`, `stamps`, `rewards_redeemed` |
| `Campaign` | `account_id`, `channel`, `template_name`, `segment` (JSON), `scheduled_at`, `status`, `stats` |
| `Outlet` | `location_id`, `name`, `type` (restaurant, bar, pool, room\_service), `menu_ids`, `hours` |

## 8. Phase 0: security, sandbox and foundations

Phase 0 fixes what the audit found, adds the sandbox guards, and builds the foundations every later phase needs. The original "repository audit" task is done (`docs/DISCOVERY.md`).

Build order: P0-00, P0-01, P0-02, P0-12, P0-13, P0-04, P0-11, P0-03, P0-05, P0-06, P0-07, P0-08, P0-09, P0-10.

### P0-00 Security fixes and sandbox guards

Depends on the owner's urgent steps in section 18 (key rotation, the `mehdichekir/dine-qr-style` decision).

- Remove `RESEND_API_KEY` and `VITE_OPENROUTER_KEYS` from the frontend `.env`. The frontend env keeps only public `VITE_` values, and `VITE_API_URL` defaults to `http://localhost:3001` for local work.
- Remove the `mehdi-origin` remote locally once the owner confirms.
- Remove the ngrok host from `vite.config.ts`, the unused Paddle and `PRICE_EUR`/`PRICE_USD` variables, and the TanStack Start leftovers (`src/server.ts`, `src/start.ts`, `lib/error-capture.ts`, `lib/error-page.ts`, unused dependencies). Replace `API_ENDPOINTS.md` with a pointer to `docs/ARCHITECTURE.md`.
- Add a Content-Security-Policy to `public/_headers` (own scripts, Google Fonts, Cloudinary images, the API host). Run it in report-only mode first, then enforce.
- Commit the pending `.gitignore` change.
- Build the guards from section 20 in both repos: `env:check`, provider mode rules, outbound allowlist, log redaction, `.claude/settings.json` with the secrets hook, smoke scripts, and `deploy:env` (copies sandbox values to the VPS without printing them).

* [ ] Secret scan of tracked files and the frontend build output finds nothing
* [ ] Owner confirms the leaked keys are revoked
* [ ] Frontend `npm run dev` uses the local API by default
* [ ] CSP enforced with no console errors on landing page, dashboard and guest menu
* [ ] `env:check` passes with the owner's values and fails on a planted live payment URL (tested)
* [ ] Smoke scripts print only OK or FAIL for each configured service

### P0-01 Architecture doc

Turn `docs/DISCOVERY.md` into `docs/ARCHITECTURE.md`: stack, modules, data model, deploy flow, environment variables, server layout, URL formats. Keep it updated after every feature; keep the audit as a dated snapshot.

- [ ] `docs/ARCHITECTURE.md` exists and is linked from both `CLAUDE.md` files

### P0-02 Tests, CI and seed data

The backend already runs Jest unit and e2e tests in CI. Add to the frontend: Vitest with Testing Library, and Playwright for key flows on a phone viewport, both in `ci.yml`. Add a backend seed script for 3 demo locations: "Café Tunis Centre" (French and Arabic, 12 tables), "Restaurant Hammamet Plage" (5 languages, 30 tables), "Hôtel Djerba" (2 outlets). Replace the 2 test restaurants with this seed.

- [ ] Frontend CI runs lint, type check, unit tests, build and a Playwright smoke test (guest menu opens, owner logs in)
- [ ] One command seeds a local database
- [ ] High-severity frontend `npm audit` advisories with non-breaking fixes are fixed; Dependabot covers the frontend too

### P0-12 Server hardening and reliability

TableQR changes stay inside `/opt/tableqr`. Two changes affect the whole shared server (swap and SSH), so the owner approves them first.

- Add a 4 GB swap file (owner approval).
- SSH: key-only login, password login off, brute-force protection (owner approval).
- Memory limits on TableQR containers so they cannot starve ArisHub.
- Off-site backups: copy nightly dumps to S3-compatible storage (for example OVH Object Storage), keep 30 days, test a restore monthly.
- Uptime monitoring of `/health/ready` and the guest menu, with email alerts (WhatsApp after P3-05).
- A daily-use SSH alias for the `deploy` user (no sudo); the sudo account is used only for approved tasks.
- Server facts and runbooks in `docs/OPERATIONS.md`.

* [ ] Restore from the off-site copy tested into a local database
* [ ] An alert arrives when the API is stopped for 2 minutes
* [ ] Owner approved swap and SSH changes before they ran

### P0-13 Final domain

No real customer has printed a QR code yet, so the domain should change now rather than in Phase 7. The owner picks the domain (section 19). Claude Code makes the domain configuration-only (frontend, CORS, emails and Resend sender, QR links), sets permanent redirects from `menu.arishub.site` and `menu-api.arishub.site`, and updates the docs. DNS records are added by the owner in Cloudflare, or by Claude Code with a token limited to the new zone.

- [ ] No hardcoded `arishub.site` remains in code
- [ ] Old URLs redirect permanently
- [ ] QR codes and emails use the new domain

### P0-04 Money in millimes

Today `Dish.price` and payment amounts are `Decimal(10,3)`. With no real data, migrate them to integer millimes (`priceMillimes Int`), which also suits Konnect's API (confirm the amount unit in its docs). Add one money helper shared by backend and frontend: parse "12,500", "12.5", "12D500" and "12 DT"; format per locale; percent; sum.

- [ ] Migration converts the test dishes exactly (before/after report)
- [ ] No floating-point number is used for stored money (tested)
- [ ] Guest menu shows the same prices as before

### P0-11 Account model and roles

Today one user equals one restaurant, and admins come from `ADMIN_EMAILS`. Restructure while it is free to do so:

- `Account` (the paying business) owns many `Restaurant`s (the plan's "Location") and has members through `Membership` (`userId`, `accountId`, `role`: owner, manager, staff, kitchen).
- `Subscription` moves from `User` to `Account`.
- Platform admins become a database role with audit logging; `ADMIN_EMAILS` is removed afterwards.
- Invitations by email (WhatsApp later). A shared-tablet staff screen unlocked with a 4-digit PIN.
- Restaurant `slug` stays globally unique (it is in the URL).

* [ ] Every owner and staff endpoint checks membership and role on the server
* [ ] An e2e test proves one account cannot read another's data
* [ ] Admin access no longer depends on an environment variable

### P0-03 Plans, entitlements, feature flags

Replace `PAYMENT_PLANS`, `PRICE_TND` and the hardcoded landing-page prices with `Plan` rows (section 4) served by a public plans endpoint. Add a NestJS guard and decorator (for example `@RequiresEntitlement('service.calls')`), `can()` and `limit()` services, monthly usage counters, per-account feature flags, and a plan screen in the existing admin area.

The trial keeps today's behavior (30 days, menu offline with 402 when not live) but unlocks Pro features during the trial. Cash payment requests keep working and now point to a plan.

- [ ] Landing page and billing page show prices from the API only
- [ ] A locked feature returns `plan_required` from the API even if the UI is bypassed
- [ ] Usage counters reset monthly (`Africa/Tunis`)
- [ ] Admin can change a plan, override an entitlement and see usage

### P0-05 i18n and RTL

All strings are hardcoded French today. Frontend: add react-i18next (namespaces per area; French default, Arabic, English), set `lang` and `dir` on `<html>`, replace left/right Tailwind classes with logical ones (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`), and give the 5 guest templates an Arabic-capable font. Backend: email templates per locale, and error messages returned as codes the frontend translates. Guest language order: explicit choice → phone languages → restaurant default → French. (Translating dish names is P1-03.)

- [ ] A lint rule blocks new hardcoded user-facing strings
- [ ] Playwright screenshots of guest menu and dashboard in Arabic pass an RTL review on a phone viewport
- [ ] Emails arrive in the user's language

### P0-06 Event tracking

Evolve today's `Scan` (salted visitor hash, deduplicated) into `GuestSession` and `Event` tables, keeping the deduplication. A small client tracker batches events without personal data; daily aggregate tables feed dashboards. Event types: `menu_opened`, `language_changed`, `category_viewed`, `item_viewed`, `selection_item_added`, `wifi_viewed`, `service_requested`, `service_acknowledged`, `service_resolved`, `feedback_submitted`, `google_review_clicked`, `upsell_shown`, `upsell_accepted`, `order_placed`, `order_status_changed`, `payment_completed`, `deal_shown`, `loyalty_stamp_added`.

- [ ] Existing scan statistics keep working from the new tables
- [ ] Tracker adds under 5 KB and never blocks rendering
- [ ] Aggregation job is idempotent

### P0-07 Jobs and scheduler

Use pg-boss (job queue stored in the existing PostgreSQL) and `@nestjs/schedule` for recurring jobs, so no new service runs on the shared VPS. Jobs run in the API container, or in a worker container from the same image if load requires.

- [ ] Failed jobs retry with backoff and are visible in admin
- [ ] Running a job twice has no duplicate side effects (tested)

### P0-08 Notifications service

Build on the existing Resend mail service: one `NotificationsService` with in-app (bell and unread count), email, and a WhatsApp channel completed in P3-05. Each user sets preferences per notification type.

- [ ] One call notifies a user on all enabled channels
- [ ] Preferences screen for owners and managers

### P0-09 Audit log

- [ ] Changes to prices, plans, entitlements, schedules, roles, payment settings and admin actions are logged with before and after values
- [ ] Owners see their account's log; platform admins see all

### P0-10 LLM service

Refactor the existing `src/ai` (OpenRouter, several keys, model fallback) into an `LLMProvider` interface with the OpenRouter implementation and a fake for tests. Prompts move to `prompts/<task>.md` with a version header. Outputs are validated against a schema, retried once, and logged with tokens and cost per account (`AIUsage`). A monthly cost cap per account. Outside development, only paid model variants are used (free variants have request caps).

- [ ] Existing AI import works through the adapter and its tests still pass
- [ ] The cost cap blocks calls with a clear message and alerts admins
- [ ] Model IDs come from `LLM_MODEL_SMART` and `LLM_MODEL_FAST`, never from code

## 9. Phase 1: guest and owner quick wins (Pro tier)

Phase 1 makes the Pro plan worth paying for: service buttons, AI onboarding, translations, schedules, compliant feedback, and a dashboard that shows value. Build in this order: P1-01, P1-04, P1-05, P1-06, P1-02, P1-03, P1-12, P1-08, P1-07, P1-09, P1-10, P1-11.

### P1-01 Tables and per-table QR codes

Starting point: one QR code per restaurant, generated in the browser, pointing to `/m/{slug}`. Per-table codes add `?t=<token>`.

Owners create tables one by one or in bulk ("Ajouter 20 tables", with zones such as Terrasse, Salle, Étage). Each table gets a random token and its own QR code. The old single-QR menu keeps working: when there is no table token, features that need a table ask "Votre numéro de table ?" with a picker.

- [ ] Bulk create with automatic labels (T1 to T20) and editable zones
- [ ] QR download per table and for all tables (PNG, SVG, PDF)
- [ ] Rotating a token invalidates the old QR for that table only
- [ ] Existing printed QR codes still open the menu

### P1-02 AI menu import (photo or PDF)

Starting point: AI import already exists (photo or text → OpenRouter → proposed dishes accepted in a dialog). This feature upgrades it: an onboarding-first flow, PDF and several photos, the price rules below, a better review screen, and a fixture-based accuracy test.

The first screen after signup says "Prenez une photo de votre menu". The owner uploads up to 10 photos or one PDF (max 20 MB). The AI extracts categories, items, descriptions, prices and sizes (for example "petit / grand"). The owner reviews and applies.

Rules for extraction:

- Prices in any local format ("12.5", "12,500", "12D500", "12 DT") are converted to millimes.
- A price that cannot be read is left empty and flagged. Never guess a price.
- Low-confidence fields are highlighted in the review screen.
- Detected source language is stored; translations are a separate step (P1-03).

* [ ] Review screen lets the owner edit, delete, merge and reorder before applying
* [ ] Apply into a new draft menu, or append to an existing one
* [ ] On a fixture set of 10 real Tunisian menus (provided by the owner), at least 90% of items and prices are correct before edits
* [ ] Usage counted against `menu.ai_import`
* [ ] Signup to live menu possible in under 5 minutes for a 40-item menu (manual test)

### P1-03 AI translation and language auto-detect

One button per language: "Traduire en anglais". Names and descriptions are translated. Tunisian dish names stay in their original form, with a short explanation for tourists, using a glossary file the owner can extend (`brik`, `lablabi`, `ojja`, `kafteji`, `mloukhia`, `couscous`, `chakchouka`, `makroudh`, `bambalouni`...). Example: "Brik — crispy pastry with egg and tuna".

- [ ] Each translated field is marked "IA" until the owner edits or validates it
- [ ] Changing the source text marks that field's translations as "à revoir" (stale)
- [ ] Guest language picker shows language names, not flags
- [ ] Guest menu opens in the phone's language when the menu has it (P0-05 order)

### P1-04 Sold-out toggle ("Épuisé")

Starting point: dishes already have an `available` switch. This adds the timed reset, staff access and live update on the guest menu.

One tap from the owner or staff phone. Options: sold out "jusqu'à demain" (resets at 05:00 `Africa/Tunis`) or until manually reset.

- [ ] Toggle reflects on the guest menu within 5 seconds
- [ ] Guest sees the item greyed with "Épuisé"; setting to hide it instead
- [ ] A sold-out item cannot be added to "ma sélection" or ordered

### P1-05 Service buttons (guest side)

Three buttons on the guest menu: "Appeler le serveur", "L'addition" (then "Espèces" or "Carte"), and "WiFi".

- **Call and bill:** after tapping, the guest sees "Serveur prévenu" with elapsed time and a cancel button. Cooldown of 2 minutes per table per type.
- **WiFi:** shows network name and password with a copy button, plus a WiFi QR code (`WIFI:T:WPA;S:<ssid>;P:<password>;;`) for quick joining.

* [ ] Requests need a valid table token (or a picked table number)
* [ ] Rate limits per session and per table are enforced on the server
* [ ] Events `service_requested` and `wifi_viewed` recorded

### P1-06 Staff live board

A staff screen for a tablet or phone (PWA) lists open requests, oldest first: table label, zone, type, minutes waiting. New requests play a sound and vibrate. Staff tap "J'arrive" (acknowledged) then "Fait" (done). Rows turn amber after 2 minutes and red after 5.

- [ ] New request appears within 2 seconds (realtime, with polling fallback)
- [ ] Works in French and Arabic (RTL)
- [ ] Optional web push to staff phones when the screen is in the background
- [ ] Manager sees average response time per day and per staff member

### P1-07 Scheduled menus (breakfast, happy hour, Ramadan)

Schedules show or hide categories by day and time (breakfast 07:00–11:00), by date range (summer menu), as happy hour (a category with its own items and prices, shown only in its window), or as Ramadan mode (iftar and shour sections, hide chosen categories during the period).

- [ ] Preview: "Voir le menu comme le samedi à 20h00"
- [ ] Items outside their window are hidden, or shown as "Disponible de 12h à 15h" (owner setting)
- [ ] Ramadan period and hours are set by the owner each year; nothing is hardcoded
- [ ] Overlapping schedules resolve predictably (documented rule, tested)

### P1-08 Guest feedback, Google review option, manager alerts

Starting point: the guest menu already collects a rating and a comment, shown in the dashboard. This adds tags, the Google button, consent, the table link and alerts.

This must comply with section 5: no review gating.

Entry points: after "L'addition", and a permanent "Votre avis" link. The guest gives a 1–5 rating, optional tags (service, plats, attente, prix, propreté, ambiance), an optional comment, and optional contact details with consent.

The Google review button (link format `https://search.google.com/local/writereview?placeid=<PLACE_ID>`) is shown to every guest, on the same screen, with the same wording and prominence, whatever rating they gave. No rewards or discounts for reviews.

When a rating is 3 or lower, the manager gets an instant notification with table and comment ("Table 7 — 2/5 — attente trop longue"), so the problem can be fixed before the guest leaves.

- [ ] Automated test: the Google button renders identically for ratings 1 and 5
- [ ] Low-rating alert arrives within 10 seconds
- [ ] Feedback is also saved as a `Review` with `source = in_app` for Phase 2 analysis
- [ ] Owner sets the Google Place ID once; a helper explains where to find it

### P1-09 Owner analytics and ROI dashboard

Starting point: deduplicated scan counts for owners and admins. This builds on the P0-06 events.

The owner's home screen shows: scans today and this week, peak hours as a day × hour heatmap, language mix, most viewed items, "souvent vus, rarement choisis" (viewed often, rarely added to selection; later, rarely ordered), service requests and average response time, feedback average and count, Google review link clicks.

A "Ce mois-ci avec TableQR" card summarizes delivered value. In Phase 1 it shows counts only (calls handled, feedback captured, Google review clicks, menu updates without reprinting). Money values appear only from Phase 4, when real order data exists. Never show invented estimates.

- [ ] Dashboard loads in under 2 seconds on 4G using daily aggregates
- [ ] Works on a phone first; desktop is a wider version of the same layout
- [ ] Every number links to its definition (tooltip)

### P1-10 Print studio

Starting point: a 1200 px PNG and a printable table card, both generated in the browser.

Print-ready PDFs with logo, brand color, table label, QR code and a call to action in two languages. Templates: table tent (10 × 15 cm), round sticker (8 cm), A4 poster, window sticker. Batch export for all tables.

- [ ] PDFs include 3 mm bleed and crop marks
- [ ] QR codes with a logo in the center use error correction level H; tested to scan on 3 phones
- [ ] Essentiel gets 1 template; Pro and above get all

### P1-11 Weekly report

Every Monday at 09:00 `Africa/Tunis`, owners receive a short report by email (WhatsApp added in P3-05): last week vs the week before, top 3 items, slowest service hour, feedback summary, and one simple insight (rule-based in Phase 1; AI-written from Phase 2).

- [ ] Report job is idempotent and respects notification preferences
- [ ] Report renders well in Gmail on a phone, in French and Arabic

### P1-12 "Ma sélection" (guest list)

Guests tap "+" on items to build a list with quantities and notes, see the running total, then tap "Montrer au serveur": a full-screen view with large text and the table number. Nothing is sent to the kitchen yet; Phase 4 turns this into ordering.

- [ ] Selection survives a page reload on the same phone during the visit
- [ ] Event `selection_item_added` recorded per item

## 10. Phase 2: Google reviews hub, AI replies, decision engine

Phase 2 connects each restaurant's Google Business Profile, drafts replies with AI, classifies every review (Google and in-menu), and turns reviews plus menu data into at most 3 concrete decisions per week. Google API access must be approved before P2-01 can be tested against real data (section 18).

### P2-01 Google Business Profile connection

The owner clicks "Connecter Google", signs in with the Google account that owns or manages the business, and maps each Google location to a TableQR location.

- OAuth 2.0 with offline access (refresh token), scope `https://www.googleapis.com/auth/business.manage`.
- Accounts and locations come from the Account Management and Business Information APIs; reviews from the v4 API (section 16).
- Refresh tokens are encrypted at rest. Revoked or expired access sets the connection to `error` and notifies the owner.

* [ ] Connect, map, disconnect flows work; disconnect deletes stored tokens
* [ ] Clear error when the Google account is not an owner or manager of the profile

### P2-02 Review sync

First connection backfills all reviews. Then a job syncs every 2 hours, plus an on-demand "Actualiser" button. Use `accounts.locations.reviews.list` with paging (`pageSize`, `pageToken`), or `accounts.locations.batchGetReviews` for several locations. Upsert by the review's resource name and detect edits from the update time.

Store reply state, policy-violation details and the reply URL, which Google now returns on reviews ([Google changelog](https://developers.google.com/my-business/content/latest-updates)). Map star rating enums (`ONE` to `FIVE`) to 1–5. If a comment contains Google's auto-translation ("(Translated by Google)" plus "(Original)"), keep the original text and language.

- [ ] Backfill of 500 reviews completes without hitting quota errors (backoff on 429)
- [ ] New review appears in TableQR within 2 hours, or immediately on "Actualiser"
- [ ] Sync is idempotent (no duplicates after repeated runs)

### P2-03 AI reply drafts and publishing

Every new review gets a draft reply. The owner reviews it in a "Avis" inbox and approves, edits or rejects. From Phase 3, approval also works from WhatsApp.

Reply rules (in the prompt and checked after generation):

- Reply in the reviewer's language when the location supports it; Darija reviews get a reply in French or Arabic (owner setting).
- Mention one specific detail from the review. Thank, acknowledge, and for complaints invite the guest to continue privately (phone or email from location settings).
- Never argue, never blame the guest, never reveal personal data, never admit legal liability, never offer discounts or rewards publicly.
- Avoid repetition: if a draft is too similar to one of the last 20 replies for that location, regenerate once.
- Owner settings: tone (chaleureux, professionnel), signature ("L'équipe du Café X"), default contact.

Publishing modes per star rating (`ReplyRule`):

| Rating | Default | Can the owner enable auto-publish? |
| --- | --- | --- |
| 5 or 4, with text | Manual approval | Yes, with a random delay between 2 and 24 hours |
| 5 or 4, no text | Manual approval | Yes, short thank-you with a delay |
| 3, 2, 1 | Manual approval | No, never auto-published; the owner is alerted immediately |

Publish with the v4 reply endpoint (`PUT .../reviews/{reviewId}/reply`). After publishing, track the moderation state; if Google rejects a reply for a policy violation, notify the owner and reopen the draft.

- [ ] A 1–3 star review triggers an owner alert and is never auto-published (tested)
- [ ] Similarity check prevents near-identical replies (tested with fixtures)
- [ ] Draft generation counts against `reviews.hub`
- [ ] Published replies are recorded in the audit log

### P2-04 Review analysis

Every review (Google and in-menu feedback) is analyzed once, in batch: language (French, Arabic, Darija in Latin letters, English, other), overall sentiment (-1 to 1), and topics from a fixed taxonomy stored in config:

`service_speed`, `staff_attitude`, `food_quality`, `food_temperature`, `portion_size`, `price_value`, `cleanliness`, `ambiance_noise`, `wifi`, `payment`, `menu_variety`, `reservation`, `parking`, plus mentioned dishes (fuzzy-matched to `item_id` across languages) and staff first names.

Each topic stores a short evidence span from the review. Personal data (phone numbers, emails) is stripped before sending text to the model. Use a fast, cheap model for this task (section 16).

- [ ] Fixture set of 200 labelled reviews (French, Arabic, Darija, English): sentiment polarity agrees with labels on at least 85%
- [ ] Dish mentions map to the right item on at least 80% of fixture cases
- [ ] Changing the prompt version can re-run analysis on the last 90 days

### P2-05 Decision engine ("Conseiller IA")

Every Sunday night (`Africa/Tunis`), for each location with `ai.advisor`, the engine produces at most 3 decisions for the week.

How it works:

1. **Compute signals** with plain code: review topic counts and sentiment (last 28 days vs the 28 before), item views vs selections or orders, service response times by day and hour, scans by hour, low ratings by table and zone, language of guest phones vs languages offered.
2. **Run detectors** (deterministic rules with minimum sample sizes) that output candidate insights with their numbers.
3. **Rank and write** with the LLM: it picks the top 3, writes them in the owner's language, and attaches one concrete action each. The LLM only receives computed numbers and may only use those.
4. **Validate**: every number in the text must exist in the evidence; otherwise regenerate once, then drop the insight.

Urgent detectors (cleanliness, food safety words) notify the owner immediately instead of waiting for Sunday.

Starting detectors:

| Detector | Trigger (minimums) | Example action shown to owner |
| --- | --- | --- |
| `slow_service_window` | 5+ negative `service_speed` mentions in 28 days and response time in one day/hour window 50% above the location median | "Ajouter un serveur le vendredi de 19h à 23h" |
| `dish_low_conversion` | 100+ views in 28 days and conversion under 40% of the category median | "Changer la photo ou la description du couscous au poulpe" |
| `dish_praised` | 5+ positive mentions of one dish | "Mettre le plat en avant avec un badge Coup de cœur" |
| `price_value_complaints` | 5+ mentions and 30%+ negative `price_value` | "Revoir la portion ou le prix des plats cités" |
| `cleanliness_alert` (urgent) | 3+ negative `cleanliness` mentions in 14 days | "Vérifier les toilettes et les tables, avis récents joints" |
| `language_gap` | 15%+ of sessions from phones in a language the menu lacks | "Ajouter l'allemand à votre menu" |
| `unanswered_reviews` | 3+ Google reviews without reply | "5 brouillons de réponse sont prêts" |
| `staff_praise` | 3+ positive mentions of one staff name | "Félicitez Sami, cité dans 4 avis" |

Each insight shows: title, evidence (numbers and at most 2 short review excerpts), the action, confidence (low, medium, high, from sample size), and buttons "Je m'en occupe", "Pas pertinent" (with a reason), "Fait".

- [ ] Detectors have unit tests with fixtures for trigger and no-trigger cases
- [ ] No insight is generated below its minimum sample size
- [ ] Number validation rejects any number not in the evidence (tested)
- [ ] Insights appear in the dashboard, the weekly report, and (Phase 3) WhatsApp

### P2-06 Closed loop: measure what changed

When the owner marks an insight "Fait", store the baseline value of its metric and a follow-up date (14 or 28 days, per detector). The follow-up job measures the metric again and reports the result, for example: "Depuis votre changement, les mentions d'attente sont passées de 12 à 7 (-40 %)." If the sample is too small, say so instead of claiming a result. Dismiss reasons are stored and lower the rank of similar insights for that location.

- [ ] Follow-up results appear in the weekly report and on the insight card
- [ ] Results are never shown without baseline and follow-up sample sizes

## 11. Phase 3: WhatsApp infrastructure, sales bot, owner notifications

Phase 3 adds one WhatsApp number for TableQR that qualifies restaurant owners, recommends the right plan, builds a live demo menu from a photo, and later lets existing owners receive alerts and approve review replies. The bot is business-specific by design, to comply with Meta's 2026 policy (section 5).

### P3-01 WhatsApp Cloud API infrastructure

- **Webhook:** a GET endpoint answers Meta's verification (`hub.mode`, `hub.verify_token`, `hub.challenge`). A POST endpoint verifies the `X-Hub-Signature-256` header (HMAC SHA-256 of the raw body with the app secret), stores the raw payload, deduplicates by message ID, and processes asynchronously.
- **Sending:** `POST https://graph.facebook.com/<GRAPH_VERSION>/<PHONE_NUMBER_ID>/messages` with a bearer token. Graph version, phone number ID and token come from env vars.
- **Message types:** text, reply buttons (up to 3 buttons), list messages (up to 10 rows), image, document, and templates. Claude Code verifies current character limits for button and row titles in Meta's docs and enforces them in code.
- **Inbound media:** images arrive as a media ID; fetch its URL, then download with the token, and store in the app's file storage.
- **24-hour window:** before any free-form message, check the contact's last inbound message is under 24 hours old; otherwise only an approved template may be sent. Enforced in one place in code.
- **Templates registry:** template names, languages and variables are declared in code; the templates are submitted through the API by Claude Code and approved by Meta (section 20).
- **Opt-in and opt-out:** consent is stored per contact and purpose. Keywords "STOP", "ARRET" and "وقف" unsubscribe immediately and confirm.
- **Status tracking:** sent, delivered, read, failed, with the pricing category recorded per message for cost reporting.

* [ ] Signature verification rejects tampered payloads (tested)
* [ ] Same webhook delivered twice produces one action (tested)
* [ ] Sending outside the 24-hour window without a template is impossible (tested)

### P3-02 Sales qualification bot

Entry points: a "WhatsApp" button on the landing page, Instagram and Facebook click-to-WhatsApp ads, and QR codes on flyers. Each entry uses a prefilled first message carrying a source code (for example `https://wa.me/<number>?text=Bonjour%20TableQR%20[LP]`), stored on the `Lead`.

The bot is a state machine with buttons and lists. Free text is allowed at every step: the LLM maps it to the current question ("on a 25 tables" → 10 to 30) or to an in-scope intent.

| # | State | Bot asks (French default; Arabic and English available) | Input |
| --- | --- | --- | --- |
| 1 | `welcome` | "Aslema ! Je suis l'assistant TableQR. 6 questions rapides et je vous dis exactement ce qu'il vous faut." | Buttons: Commencer, Un conseiller, العربية |
| 2 | `venue_type` | "Vous êtes :" | List: Café, Salon de thé, Restaurant, Fast-food, Hôtel, Autre |
| 3 | `tables` | "Combien de tables ?" | Buttons: Moins de 10, 10 à 30, Plus de 30 |
| 4 | `locations` | "Combien d'établissements ?" | Buttons: 1, 2 à 5, 6 ou plus |
| 5 | `clientele` | "Vos clients sont surtout :" | Buttons: Locaux, Touristes, Les deux |
| 6 | `main_pain` | "Votre plus gros problème aujourd'hui ?" | List: Service lent, Pas assez d'avis Google, Réimprimer le menu, L'addition prend du temps, Clients qui ne reviennent pas, Commandes à emporter |
| 7 | `ordering_interest` | "Vous voulez que les clients commandent et paient depuis la table ?" | Buttons: Oui, Pas encore, C'est quoi ? |
| 8 | `city` | "Dans quelle ville ?" | Free text |
| 9 | `recommendation` | Plan, up to 3 reasons, price from the database | Buttons: Créer ma démo, Démarrer l'essai, Un conseiller |
| 10 | `demo_photo` | "Envoyez une ou plusieurs photos de votre menu papier." | Images (P3-03) |
| 11 | `trial_signup` | Signup link prefilled with the lead's answers | Link |
| 12 | `handoff` | "Un conseiller vous répond très vite." Bot pauses for this contact | Human (P3-04) |
| 13 | `followup_consent` | "Voulez-vous un rappel demain ?" | Buttons: Oui, Non |

Scope rules: in-scope free-text questions (prices, features, payments, how QR menus work, trial) are answered only from a FAQ file in the repo (`content/faq.<locale>.md`). Anything else gets: "Je peux vous aider uniquement pour TableQR. Voulez-vous parler à un conseiller ?" Sessions expire after 24 hours; a returning contact gets "On reprend où on s'était arrêtés ?".

**Recommendation rules** (deterministic function `recommend(answers)`, first match wins, unit-tested):

1. Venue is Hôtel, or 6+ locations → Hôtel / Chaîne, custom quote, go to `handoff`.
2. 2 to 5 locations → Business plus extra locations; offer a call.
3. Ordering interest is Oui, or venue is Fast-food, or pain is "L'addition prend du temps" or "Commandes à emporter" or "Clients qui ne reviennent pas" → Business.
4. Venue is Café or Salon de thé, fewer than 10 tables, pain is "Réimprimer le menu", clientele is Locaux → Essentiel.
5. Otherwise → Pro.

Modifiers: tourists in clientele upgrade Essentiel to Pro (AI translation). Pain "Pas assez d'avis Google" on Pro adds the Conseiller IA add-on as a suggestion. Reasons shown to the prospect are picked from a fixed list tied to their answers (for example "Menu traduit automatiquement en allemand, italien, russe pour vos touristes").

**Lead score** for sales priority: 30+ tables +30, 10 to 30 tables +20, 2+ locations +25, Hôtel +30, tourists +15, ordering interest +20, demo created +20, completed all questions +10. A score of 70 or more is "chaud" and notifies sales.

- [ ] Full flow works in French, Arabic and English
- [ ] `recommend()` has a test for every rule and modifier
- [ ] Off-topic questions never get an open-ended AI answer (tested with fixtures)
- [ ] Source code from the entry link is saved on the lead

### P3-03 Demo menu from a photo

In `demo_photo`, the bot accepts up to 10 images, replies "Je prépare votre menu… environ 2 minutes", runs the P1-02 import pipeline, creates a demo location (`is_demo = true`, "Démo" watermark, expires after 14 days), and sends the live link plus a QR image. If the prospect signs up, the demo becomes their real menu.

- [ ] Demo link sent within 3 minutes of the last photo for a 40-item menu
- [ ] Maximum 2 demos per phone number; extra requests go to handoff
- [ ] Expired demos are deleted with their images

### P3-04 Lead CRM and human handoff

A "Leads" board for super-admin and sales: columns by status (new, qualified, demo\_sent, trial\_started, won, lost), lead score, answers, source, conversation history. Sales can reply from the board (free text inside 24 hours, templates after), assign leads, add notes, and close the handoff to give control back to the bot.

- [ ] Bot never replies while a human handoff is open
- [ ] CSV export of leads with answers and source

### P3-05 Owner notifications and approvals on WhatsApp

Owners opt in from settings and verify their number with a one-time code. Then they receive, through approved utility templates:

- Low in-menu rating alert (from P1-08).
- New Google review of 1–3 stars, with the AI draft and quick-reply buttons: Publier, Modifier, Ignorer.
- Weekly report summary and the week's insights (P1-11, P2-05).
- Optional daily summary at closing time.

"Publier" publishes the draft immediately; "Modifier" opens the draft in the dashboard.

- [ ] Approvals are accepted only from the verified number of a user with permission for that location
- [ ] Every approval is in the audit log
- [ ] Notification preferences control which alerts go to WhatsApp

## 12. Phase 4: table ordering, kitchen display, printing, payments (Business tier)

Phase 4 turns "ma sélection" into real orders that reach the kitchen, adds upsells, and lets guests pay from their phone with Tunisian payment providers. This is where the ROI dashboard starts showing money.

### P4-01 Cart and table ordering

With `ordering.table`, "Montrer au serveur" becomes "Commander". Items support modifier groups (taille, suppléments, cuisson) with price deltas, and a note per line.

- The order needs a valid table token. Prices are snapshotted on each order line and never change afterwards (section 5).
- Owner setting: orders are auto-accepted, or the first order of each guest session needs staff validation (protects against prank orders).
- Guests can add more orders during the visit; all go to the same open bill for the table.
- The guest sees a status timeline: Reçue, En préparation, Prête, Servie.

* [ ] Order reaches the staff board and kitchen display within 2 seconds
* [ ] Sold-out items cannot be ordered (re-checked on the server at order time)
* [ ] Order total equals the sum of snapshotted line prices (tested, including modifiers)

### P4-02 Order management and kitchen display (KDS)

A kitchen screen per station (cuisine, bar, pâtisserie). Order lines are routed by the item's `prep_station`. Each ticket shows table, time since order, lines, modifiers and notes, with "Prêt" buttons per line or per ticket. Managers can cancel or modify a line with a reason (audit log).

- [ ] Tickets older than a configurable time (default 15 minutes) turn red
- [ ] Works on a cheap Android tablet in landscape
- [ ] Station screens keep working through a short connection loss and resync

### P4-03 Ticket printing (spike first)

Browsers cannot print raw ESC/POS to network printers. Start with a spike that compares two options and recommends one to the owner:

- **A. Local print bridge:** a small app on the restaurant's network (Android or desktop) that receives jobs from TableQR and prints to 58 mm or 80 mm ESC/POS printers.
- **B. Cloud-print printers:** printers that fetch jobs from a server over the internet.

Prints are kitchen tickets and pre-bills. They are not fiscal receipts; label them accordingly. Fiscal receipts come from the restaurant's cash register (`P6-07`).

- [ ] Spike report in `docs/features/P4-03-printing.md` with cost, setup steps and reliability
- [ ] Chosen option prints a kitchen ticket within 5 seconds of the order
- [ ] Arabic text prints correctly (or a documented fallback)

### P4-04 Online payments (Flouci, Konnect)

Guests tap "Payer" on their bill, choose an amount (full or their share), optionally add a tip, and pay through a provider's hosted page. A webhook confirms the payment; the bill updates and staff are notified.

- Each restaurant connects **its own** merchant account, so money goes directly to the restaurant. TableQR never holds guest funds.
- Flouci accepts its own wallet, other licensed wallets, bank cards and post office cards, with payment links and APIs that support webhooks ([Flouci docs](https://docs.flouci.com/)).
- Konnect accepts Visa and Mastercard and integrates Flouci; a 2023 report cites a 1.6% transaction fee, to be confirmed with Konnect before launch ([We Are Tech](https://www.wearetech.africa/en/fils/solutions/tunisie-konnect-propose-divers-services-financiers-grace-a-ses-plateformes-web-et-mobile)).
- Any TableQR platform fee on payments is invoiced to the restaurant separately, not split from the guest's payment, unless a provider offers a supported split feature.
- A reconciliation job checks pending payments with the provider and resolves stuck states.
- Refunds are done in the provider's dashboard at first and recorded in TableQR.

* [ ] Both providers implemented behind `PaymentProvider` with fakes for tests
* [ ] Webhooks are verified per provider docs (signature, or a server-side status check when the provider has none) and idempotent
* [ ] A payment is never marked paid from the browser redirect alone; only from a verified webhook or provider API check

### P4-05 Split bill

Modes: equal parts (choose number of people) or by items (each guest picks their lines). Each part is paid separately online, or marked as paid in cash or card at the counter by staff.

- [ ] Bill status moves open → partially paid → paid correctly with mixed payment methods
- [ ] Rounding never loses or invents a millime (tested)

### P4-06 Upsell rules

Owners create rules: when a guest adds an item (or any item from a category), suggest specific items with a short message ("Ajouter des frites ? +3,000 DT"). A checkout rule can suggest a dessert or coffee. Limits: one suggestion per add, two per order, always dismissible.

Later, the advisor (P2-05) proposes new rules from items often ordered together.

- [ ] Events `upsell_shown` and `upsell_accepted` recorded with the item and value
- [ ] ROI dashboard shows "Extras vendus ce mois-ci" in TND from accepted upsells, plus revenue through TableQR orders and average time from bill request to payment

### P4-07 Online subscription payments for owners

Today owners pay TableQR in cash, confirmed by the admin. Add online payment of TableQR's own subscription through the same `PaymentProvider` adapters, using TableQR's merchant account: the owner picks a plan and period, pays online, and the verified payment extends `currentPeriodEnd` exactly like a confirmed cash payment. Cash requests stay available. Renewal reminders go out 7 days and 1 day before expiry (email, and WhatsApp after P3-05). Build this first in Phase 4: it removes manual cash collection.

- [ ] A payment extends the period once, even if the confirmation arrives twice (tested)
- [ ] Cash and online payments appear together in the admin revenue views
- [ ] A receipt is emailed in the owner's language

## 13. Phase 5: smart pricing and margin alerts

Phase 5 is "smart pricing", not surge pricing: TableQR tracks costs and margins, proposes discounts in slow hours and on perishables, and suggests price changes that the owner approves. Raising prices at peak time is excluded, both for guest trust and because of Tunisia's price display rules (section 5).

### Hard rules for all of Phase 5

- Prices never increase automatically. Every increase is a suggestion the owner approves, effective from a set date.
- Deals only lower the price from the displayed base price, and never below cost when costs are known.
- All guests see the same price for the same item at the same moment. No per-guest price testing.
- Items with `is_price_regulated = true` are excluded from deals and suggestions.
- Every change is logged (`PriceChange`) and the printable price board is updated (P5-06).

### P5-01 Ingredient costs and recipe costing

Owners enter ingredients with a unit and cost (or import a CSV), and link items to recipes (quantity per ingredient). TableQR shows food cost and margin per item.

- [ ] Unit conversion for g/kg, ml/l and pieces (tested)
- [ ] CSV import with a preview and error report
- [ ] Margin per item visible in the owner's menu list

### P5-02 Margin alerts

When an ingredient cost changes, margins are recalculated. Items above the owner's target food cost (set per category; default 30%, editable) trigger an alert with the per-unit impact. Example of why this matters: the professional price of coffee went from 20 to 34.5 TND per kilo in late 2024 ([African Manager](https://africanmanager.com/?p=515718)); owners need to see the effect per cup immediately.

- [ ] Alert shows old and new cost per item and the price needed to return to target margin
- [ ] Alert links to a price suggestion (P5-05)

### P5-03 Off-peak deals

The system finds slow hours (lowest quarter of open hours by scans and orders over the last 4 weeks) and proposes a deal, for example "-15 % sur les boissons, mardi à jeudi, 15h–17h". The owner approves, edits or rejects. During the deal, the guest menu shows the base price struck through, the deal price, and the end time ("Happy hour jusqu'à 17h"). Orders snapshot the deal price.

- [ ] Deal price is always lower than base and never below cost when cost is known (tested)
- [ ] After 4 weeks, the deal card shows the change in orders for those hours vs the 4 weeks before

### P5-04 End-of-day perishables

Owners mark items as perishable (pâtisseries, plat du jour). At a set time before closing, staff enter the quantity left in one tap; a discount applies ("Dernières pièces -30 %") until the quantity reaches zero.

- [ ] Quantity decreases with each order and the deal stops at zero
- [ ] Unsold quantity at closing is recorded (waste tracking)

### P5-05 AI price suggestions

Suggestions combine: cost changes and margin, conversion from views to orders, price vs similar items in the category, and `price_value` review mentions (P2-04). Each suggestion shows the proposed price, the reasons with numbers, and the expected effect stated cautiously. Accepting creates a `PriceChange` effective from the next day at 05:00 and prompts the owner to print the updated price board.

- [ ] No more than one suggestion per item per 30 days
- [ ] Never auto-applied (tested)
- [ ] Regulated items never receive suggestions (tested)

### P5-06 Price change log and printable price board

Every price change (manual, suggestion or deal) is logged with who, when, old and new price. A "Tableau des prix" PDF (A4 and A3, French and Arabic) always matches the live menu and shows its date. After any price change, the owner is reminded to print and display the new board.

- [ ] Price board PDF matches the live menu exactly (automated comparison test)
- [ ] Price history per item visible to owner and manager

## 14. Phase 6: loyalty, CRM, multi-branch, hotels, guest bot, cash register

Phase 6 grows revenue per account: guests come back (loyalty, campaigns), bigger customers fit (multi-branch, hotels), and TableQR reaches diners on WhatsApp. Each feature starts with a short spec review with the owner, since priorities may change after Phases 1 to 5 are live.

### P6-01 Loyalty stamp card

Guests join from the menu with their phone number and explicit consent, verified by a one-time code. A stamp is added when staff confirm a visit (scan the guest's card QR or enter a code) or automatically on a paid TableQR order. Reward example: "Le 10e café est offert".

- [ ] One stamp per guest per visit window (default 3 hours) to prevent abuse
- [ ] Guest sees their card on the menu without an app
- [ ] Consent stored in `Consent` with purpose `loyalty`

### P6-02 Guest CRM and campaigns

Guest profiles (only with consent), segments (visited in the last 30 days, not seen for 60 days, frequent guests), and campaigns by WhatsApp marketing templates or email. Before sending, the owner sees the number of recipients and the estimated message cost.

- [ ] Only contacts with `marketing` consent can be targeted (tested)
- [ ] Frequency cap: at most 2 campaigns per guest per month
- [ ] Results: delivered, read, and visits or orders within 7 days

### P6-03 Multi-branch

An account-level dashboard compares locations side by side. A shared menu can be used by several locations, with per-location overrides for price, availability and schedules. Roles can be limited to specific locations.

- [ ] Editing the shared menu updates all linked locations except their overrides
- [ ] Comparison view: scans, ratings, response times, revenue per location

### P6-04 Hotel module

Outlets (restaurant, bar, pool, room service), each with its own menus and hours. Room QR codes use room numbers instead of tables. Room service orders can be paid online or recorded as "charged to room" (property management system integration later).

- [ ] One hotel dashboard across outlets
- [ ] Room QR tokens rotate at checkout (manual button in Phase 6)

### P6-05 Guest WhatsApp bot (add-on)

Diners message the restaurant's own WhatsApp number. The bot asks budget, dietary needs, spice level and party size, then recommends dishes **from that restaurant's menu only**. It can take takeaway orders with a payment link and reservation requests. Scope rules from P3-02 apply.

This requires each restaurant's number to be connected to TableQR, which means TableQR must onboard restaurants through Meta's flow for technology providers or through a WhatsApp business solution provider. Confirm the path in a spike before building.

- [ ] Spike doc chooses the onboarding path with costs and steps
- [ ] Recommendations never include sold-out or out-of-schedule items

### P6-06 Reservations

Request-based reservations (date, time, party size, name, phone) from the menu page and the guest bot. The owner confirms or declines from the dashboard or WhatsApp. Reminder template the day before. No-shows are recorded.

- [ ] Confirmation and reminder messages in the guest's language
- [ ] Owner sets capacity per time slot

### P6-07 Cash register integration (spike)

Cash registers are becoming mandatory for restaurants and cafés in phases (section 5). Research the decree's technical requirements, which registers are approved, and which ones target customers use. Recommend one of: export orders and prices to registers, partner with a register provider, or pursue certification for TableQR itself.

- [ ] Recommendation doc in `docs/features/P6-07-cash-register.md`; nothing is built without the owner's decision

## 15. Phase 7: UI/UX overhaul (final step)

The full redesign happens last, once every feature exists, so the new design covers the complete product in one coherent pass. Until then, Claude Code keeps new screens functional and isolated, and records every UI shortcut in `docs/UI_DEBT.md` (screen, problem, idea) so nothing is forgotten.

### P7-00 UX audit and design direction

Before any code: the owner shares screenshots of every screen (landing, signup, onboarding, dashboard, menu editor, guest menu on a phone, staff board, kitchen display). An audit and a design direction (typography, color tokens, spacing, components, motion) are produced and approved. Claude Code then implements them as design tokens and a component library.

- [ ] Approved design direction in `docs/design/DIRECTION.md`
- [ ] Design tokens (colors, type, spacing, radius, shadows) for light and dark, LTR and RTL

### P7-01 Guest menu redesign

- Instant first view: no splash screen, skeleton loading, usable in under 1 second on 4G.
- Photo-first item cards; optional short looping dish videos; images in modern formats with responsive sizes.
- Smart filters: allergens, vegetarian, spicy level, sans alcool, "Coup de cœur" badges from P2-05.
- Polished Arabic RTL, large tap targets, readable in sunlight on a terrace.
- Service buttons, selection or cart, feedback and loyalty integrated into one calm bottom bar.
- Theme options per restaurant within the design system (logo, accent color, font pairing), never breaking readability.

### P7-02 Owner app, mobile-first

- Home = today's actions: open calls, reviews to approve, insights, sold-out toggles.
- One-handed quick actions; every common task in 2 taps or fewer.
- Onboarding wizard built around AI import (P1-02) with progress to "menu en ligne".
- Installable PWA with push notifications.

### P7-03 Landing page and pricing page

- Headline sells the outcome, not the QR code (for example "Votre menu qui vend plus et répond à vos avis").
- Live demo menus to try on a phone, a pricing page from the `Plan` table, the WhatsApp button (P3-02), and real customer proof as it accumulates.
- French, Arabic and English versions; fast and indexable.

### P7-04 Brand and domain

- The domain move happens early, in `P0-13`, before any real QR code is printed.
- P7-04 keeps only the optional product rename and the brand refresh; the name comes from config (section 6).

### P7-05 Accessibility and performance pass

- [ ] Guest menu: mobile Lighthouse performance 90+ and accessibility 90+ on the 3 seed menus
- [ ] Color contrast meets WCAG AA in light and dark themes
- [ ] Every screen checked in Arabic RTL on a real phone

## 16. Integrations reference

Four services are already integrated (OpenRouter, Resend, Cloudinary, Cloudflare); five are new. Claude Code reads each provider's official docs before building and records the exact endpoints in the feature file.

| Service | Status | Used in | Docs | Env variables | Notes |
| --- | --- | --- | --- | --- | --- |
| OpenRouter (AI) | Existing (`src/ai`) | P0-10, P1-02, P1-03, P2-03 to P2-05, P3-02, P5-05 | [Limits](https://openrouter.ai/docs/api/reference/limits) | `OPENROUTER_API_KEYS`, `LLM_MODEL_SMART`, `LLM_MODEL_FAST` | Each key can carry its own credit limit with a reset schedule. Free model variants have platform request caps; paid variants do not ([OpenRouter](https://openrouter.ai/docs/api/reference/limits)). |
| Resend (email) | Existing (`src/mail`) | Auth emails, P0-08, P1-11 | resend.com docs | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | The `resend.dev` test sender delivers only to the Resend account's own email ([Resend](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain)). |
| Cloudinary (images) | Existing (`src/media`) | Menu images, image library | cloudinary.com docs | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER`, `CLOUDINARY_LIBRARY_FOLDER` | No test mode; one folder per environment. |
| Cloudflare | Existing | Frontend hosting (Pages), DNS, proxy in front of the API, security headers | Cloudflare dashboard | None in the app | Long-lived realtime streams need regular heartbeats (section 6). |
| Google Business Profile | New | P2-01 to P2-03 | [Business Profile APIs](https://developers.google.com/my-business), [latest updates](https://developers.google.com/my-business/content/latest-updates) | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_REVIEWS_WRITE_MODE` | Scope `business.manage`. Reviews in the v4 API (`reviews.list`, `get`, `batchGetReviews`, `updateReply`, `deleteReply`). API access must be requested. |
| WhatsApp Cloud API (Meta) | New | P3-01 to P3-05, P6-02, P6-05 | Meta for Developers: WhatsApp Cloud API | `WA_PHONE_NUMBER_ID`, `WA_BUSINESS_ACCOUNT_ID`, `WA_ACCESS_TOKEN`, `WA_APP_SECRET`, `WA_VERIFY_TOKEN`, `WA_GRAPH_VERSION` | Business-specific bots only ([policy summary](https://respond.io/blog/whatsapp-ai-chatbot-policy)). |
| Flouci | New | P4-04, P4-07 | [docs.flouci.com](https://docs.flouci.com/) | `FLOUCI_ENV`, `FLOUCI_PUBLIC_KEY`, `FLOUCI_PRIVATE_KEY` | Guest payments use each restaurant's own keys (encrypted in the database); `FLOUCI_*` env values are TableQR's own, for subscriptions. |
| Konnect | New | P4-04, P4-07 | [docs.konnect.network](https://docs.konnect.network/docs/en/api-integration/endpoints/initiate-payment) | `KONNECT_API_URL`, `KONNECT_API_KEY`, `KONNECT_WALLET_ID` | Sandbox and production use different API hosts ([API reference](https://api.konnect.network/api/v2/konnect-gateway)). Same per-restaurant rule as Flouci. |
| S3-compatible storage | New | P0-12 off-site backups | Provider docs (for example OVH Object Storage) | `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY`, `BACKUP_S3_SECRET_KEY` | Key limited to the backup bucket. |
| Thermal printers | New | P4-03 | ESC/POS reference of the chosen printers | Per-location config | Decided by the P4-03 spike. |

### AI task to model mapping

Models are chosen by measurement, not preference: for each task, Claude Code runs the fixture evaluation on 2 or 3 OpenRouter models and picks the cheapest one that meets the accuracy target. The choice is recorded in the feature file and set through env variables.

| Task | Model variable | Needs |
| --- | --- | --- |
| Menu import from photos and PDF (P1-02) | `LLM_MODEL_SMART` | Vision, careful structured extraction |
| Menu translation (P1-03) | `LLM_MODEL_SMART` | Quality; runs rarely |
| Review analysis and tagging (P2-04) | `LLM_MODEL_FAST` | High volume, fixed taxonomy, Darija |
| Review reply drafts (P2-03) | `LLM_MODEL_SMART` | Public text, tone |
| Advisor ranking and writing (P2-05) | `LLM_MODEL_SMART` | Weekly, low volume, reasoning |
| Bot free-text mapping and FAQ (P3-02) | `LLM_MODEL_FAST` | Short, frequent, low latency |
| Price suggestion rationale (P5-05) | `LLM_MODEL_SMART` | Financial, low volume |

Each task has its prompt file in `prompts/`, an output schema, and fixture tests: against the fake provider in CI, and against the real API only in a manual evaluation script.

## 17. Non-functional requirements

These apply to every feature and are part of each feature's definition of done.

### Performance budgets

| Measure | Budget (Phases 0–6) | Target after Phase 7 |
| --- | --- | --- |
| Guest menu Largest Contentful Paint, mid-range Android on 4G | Under 2.5 s | Under 1.5 s |
| Guest menu JavaScript, compressed | No increase vs the P0-01 baseline | Under 100 KB |
| Single menu image | Under 150 KB, responsive sizes | Modern formats (WebP or AVIF) |
| Guest API endpoints, 95th percentile | Under 300 ms | Under 200 ms |
| Service call, order or status to staff screen | Under 2 s | Under 1 s |
| Owner dashboard load on 4G | Under 2 s | Under 1.5 s |

### Reliability

- The guest menu must work when AI, WhatsApp, Google or payment providers are down. Those features degrade with a clear message; the menu never breaks.
- Deploys already back up the database, migrate, health-check and roll back automatically; keep that flow for every change.
- Nightly backups copied off-site, with a monthly restore test (P0-12).
- Uptime monitoring with alerts (P0-12).
- Before the first paying customer: decide on a dedicated VPS and a staging environment (section 19).

### Security

- Tenant isolation tests (section 6) run in CI.
- OAuth tokens and payment credentials are encrypted at rest; the key is in an environment variable.
- Rate limits on all public endpoints: service calls, feedback, orders, payments, webhooks, login, staff PIN (lock after 5 failed tries for 15 minutes).
- Signature verification on every webhook.
- Input validation on every endpoint; output encoding against XSS; CSRF protection on owner forms.
- Dependency vulnerability scan in CI.
- No personal data (phone numbers, emails, review author names) in application logs.

### Privacy

- Consent is recorded per purpose with time and source; guests can withdraw it.
- Guest data export and deletion on request, executed by super-admin in Phase 1, self-service later.
- Retention: raw events 24 months (aggregates kept), WhatsApp message bodies 12 months, feedback contact details 12 months unless the guest joined loyalty.
- Privacy policy and terms are updated before Phase 3 and Phase 6 launches (owner with a lawyer, section 18).

### Observability

- Structured logs with request ID, account ID and location ID.
- Error tracking (existing tool, or one chosen in P0-02).
- Visible job dashboard with failures and dead letters.
- Uptime checks on the guest menu, the WhatsApp webhook and payment webhooks.
- Super-admin alerts for webhook failures, stuck payments, and AI or WhatsApp cost spikes (more than 2× the 7-day average).

### Testing

- Unit tests for all business rules (entitlements, money, schedules, detectors, recommendations, pricing rules).
- Integration tests for endpoints and webhooks with recorded fixtures.
- End-to-end tests for critical guest flows on a phone viewport: open menu, switch to Arabic, call waiter, give feedback, order, pay (with fake providers).
- AI evaluation scripts with fixture sets (menus, reviews, bot conversations) that report accuracy, run manually before changing a prompt or model.

### Cost control

- AI and WhatsApp costs tracked per account per month and shown in super-admin.
- Per-plan limits (section 4) and a global monthly cost cap per account.

## 18. Owner to-do

About 30 urgent minutes now, then one setup session per phase, then a launch switch. Claude Code cannot create accounts, pass identity checks or log into dashboards; everything else it does itself. Exact sandbox steps are in section 20.

### Before Phase 0 (urgent, about 30 minutes)

- [ ] **OpenRouter:** delete the leaked key. Create one new key named `tableqr-prelaunch` with a monthly credit limit (for example $20) and put it in `.env.sandbox`. Claude Code copies it to the VPS with `deploy:env`.
- [ ] **Resend:** delete the leaked key. Create one new key with sending access only and put it in `.env.sandbox`.
- [ ] **`mehdichekir/dine-qr-style`:** check whether it is public. If so, ask for it to be made private or deleted. Tell Claude Code whether it may remove the `mehdi-origin` remote.
- [ ] Confirm the 2 existing restaurants are test data that can be deleted.
- [ ] Start Docker Desktop (local database).
- [ ] Decide on the final domain, or keep `arishub.site` for now (P0-13).
- [ ] Approve the two whole-server changes in P0-12 (4 GB swap, SSH hardening), since ArisHub shares the VPS.
- [ ] Create an S3-compatible bucket for off-site backups (for example OVH Object Storage) with a key limited to that bucket, into `.env.sandbox`.

### Before Phase 1

- [ ] Photos of 10 real Tunisian menus (with permission) as AI import test fixtures.
- [ ] A quick review of the Tunisian dish glossary (P1-03).

### Before Phase 2

- [ ] Google Cloud project, OAuth consent screen and API access request (section 20). Start now: approval can take weeks.
- [ ] One real Google Business Profile you manage, for read-only testing.
- [ ] Check 200 reviews pre-labelled by Claude for the analysis test set.

### Before Phase 3

- [ ] Meta sandbox app with the free test number and a System User token (section 20).
- [ ] Approve the FAQ in French, Arabic and English (`content/faq.*.md`, drafted by Claude Code).
- [ ] Name the person who handles sales handoffs.

### Before Phase 4

- [ ] Flouci developer account (test app keys) and Konnect sandbox account (section 20).
- [ ] Test hardware: one 80 mm and one 58 mm thermal printer, one low-cost Android tablet.

### Launch switch (when the first paying customer signs)

- [ ] Create live keys: OpenRouter production key with a limit, Resend production key, WhatsApp real number with Meta business verification, Google app published and verified, Flouci "Go Live", Konnect production account.
- [ ] Enter them directly in `/opt/tableqr/.env.production` on the server and set `APP_ENV=production`.
- [ ] Turn on branch protection for `main` in both repos (from then on, only you merge).
- [ ] Decide on a dedicated VPS and a staging environment (section 19).
- [ ] Lawyer review: terms, privacy policy, INPDP declaration, payment flows, price display.

### Later

- [ ] Talk to 2 or 3 cash register vendors and an accountant (P6-07).
- [ ] Share screenshots of every screen for the UX audit (P7-00).

## 19. Decisions and open questions

The audit and the owner's answers settled most early questions. Claude Code builds on the decisions and recommendations below; anything new goes to `docs/QUESTIONS.md`.

### Decided

| Topic | Decision |
| --- | --- |
| Users and data | Pre-launch: no real users; existing data is test data |
| Trial end | Keep today's behavior: guest menu goes offline (402) when the subscription is not live |
| Owner billing | Keep cash payment requests; add online payment of subscriptions (P4-07) |
| Guest payments | Flouci and Konnect, each restaurant with its own merchant account (P4-04) |
| Languages | French, Arabic (RTL) and English for the app; menus also German, Italian, Russian; AI translation with owner edits |
| Account model | Several restaurants and staff logins per account (P0-11) |
| Admins | Database role with audit log, replacing `ADMIN_EMAILS` (P0-11) |
| AI provider | Keep OpenRouter behind an adapter; paid model variants outside development (P0-10) |
| Analytics | Built-in events only (P0-06); no third-party tracker, so no cookie banner is needed for analytics |
| Pre-launch environment | The current VPS runs in `prelaunch` mode with sandbox or capped keys until the first paying customer (section 20) |

### Recommended, waiting for the owner

- [ ] **Final domain** (P0-13): choose it now, before any real QR code is printed.
- [ ] **Dedicated VPS** before launch: TableQR off the shared ArisHub server (it froze once and has no swap).
- [ ] **Staging environment** before launch: a second compose project with its own database and API subdomain.
- [ ] **Country scope:** keep sign-up open to all countries, billing in TND only, and revisit later.

### Still open

- [ ] Plan prices (section 4): keep 49 DT as a single plan for the first customers, or launch the tiers?
- [ ] Metric targets for activation, trial conversion, ARPA, plan mix and churn (section 3).
- [ ] Tourist languages beyond German, Italian and Russian?
- [ ] Waiters: personal phones or shared tablets for the staff board?
- [ ] Table ordering default: auto-accept, or staff validates each session's first order?
- [ ] Tips on online payments: offered or not?
- [ ] TableQR fee on guest online payments: yes or no, and what rate?
- [ ] One WhatsApp number for sales and owner notifications, or two?
- [ ] Default food cost target per category (the plan assumes 30%)?
- [ ] Should Essentiel keep AI import after the trial?
- [ ] Personal data declaration obligations with the INPDP (lawyer).

## 20. Environments, credentials and sandbox guards

Until the first paying customer, every environment, including the VPS, runs on sandbox or spend-capped keys. Claude Code manages those keys through scripts without reading them, so the owner only creates accounts. At launch, the owner switches the server to live keys (section 18).

### Environments

| `APP_ENV` | Where | Database | Keys | Who deploys |
| --- | --- | --- | --- | --- |
| `development` | Developer machine | Docker Postgres on `localhost:5434` (existing `compose.yml`) | `dine-qr-backend/.env.sandbox` | Claude Code |
| `prelaunch` | Current VPS, until the first paying customer | VPS Postgres (test data only) | The same sandbox or capped keys, copied to `/opt/tableqr/.env.production` by `deploy:env` | Claude Code (merges to `main` after CI) |
| `production` | VPS (or a dedicated one) after launch | Real data | Live keys entered on the server by the owner | Owner merges to `main` |

A staging environment is recommended before launch (section 19). Until it exists, Cloudflare preview builds are not used for API testing.

### How access works

- **Keys without seeing them.** The backend loads `.env.sandbox` in development. Claude Code runs scripts and reads only their output ("OK", or "FAIL: KONNECT\_API\_KEY missing"). Values it can generate itself (`JWT_SECRET`, `SCAN_HASH_SALT`, `SECRETS_ENCRYPTION_KEY`, `WA_VERIFY_TOKEN`) are written by an `env:init` script without being printed.
- **Server.** Daily work uses an SSH alias for the `deploy` user (no sudo), created in P0-12. The existing `arishub-db` alias (sudo) needs the owner's approval each time.
- **Git.** Local credentials. Before launch, Claude Code may merge to `main` after CI passes; after launch, only the owner merges.
- **Dashboards.** Never accessed with the owner's password; only API keys and tokens.

### Platform setup (owner, once per platform)

| Platform | Owner does once | Sandbox here means | Variables in `.env.sandbox` | Caveats |
| --- | --- | --- | --- | --- |
| OpenRouter (AI) | Delete the leaked key; create `tableqr-prelaunch` with a monthly credit limit | A real key, capped by its own credit limit ([OpenRouter](https://openrouter.ai/blog/tutorials/team-spend-controls-setup/)) | `OPENROUTER_API_KEYS`, `LLM_MODEL_SMART`, `LLM_MODEL_FAST` | Paid model variants on the VPS. |
| Resend (email) | Delete the leaked key; create a sending-only key | Locally, sender `onboarding@resend.dev`, which only reaches your own Resend email. On the VPS, the verified domain with the app's recipient allowlist | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | The allowlist (guard 3) is what protects real people pre-launch. |
| Cloudinary | Nothing new | Separate folders per environment | `CLOUDINARY_*`, `CLOUDINARY_FOLDER=tableqr-dev` (VPS: `tableqr-prelaunch`) | No test mode exists. |
| WhatsApp | On developers.facebook.com, create a Business app "TableQR Sandbox" with WhatsApp; add your phones as recipients; create an admin System User with `whatsapp_business_messaging` and `whatsapp_business_management`; generate a token with no expiry | Free test number that reaches only 5 verified recipients ([WeWeb docs](https://docs.weweb.io/integrations/whatsapp.html)) | `WA_PHONE_NUMBER_ID`, `WA_BUSINESS_ACCOUNT_ID`, `WA_ACCESS_TOKEN`, `WA_APP_SECRET`, `WA_GRAPH_VERSION` | Setup-page tokens expire in about 24 hours; the System User token does not ([Veryfront](https://veryfront.com/docs/cloud/integrations/whatsapp)). Webhook callback: the VPS API URL Claude Code gives you. Templates are submitted by Claude Code through the API. |
| Google Business Profile | Google Cloud project `tableqr-sandbox`, Business Profile APIs enabled, OAuth consent screen External + Testing with your account as test user, Web OAuth client, API access request | No sandbox exists; read-only use of a real profile you manage; replies forced to dry-run | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_REVIEWS_WRITE_MODE=dry_run` | Testing-mode authorizations expire after 7 days ([Google](https://support.google.com/cloud/answer/10311615)); re-run `google:connect` when told. |
| Flouci | Developer account; copy the automatic "TEST APP" keys | Test app with test cards ([Flouci](https://docs.flouci.com/essentials/testing.md)) | `FLOUCI_ENV=test`, `FLOUCI_PUBLIC_KEY`, `FLOUCI_PRIVATE_KEY` | Wallet payments cannot be tested; do not "Go Live" before launch. |
| Konnect | Account on the sandbox dashboard; copy API key and wallet ID | Separate sandbox API host ([Konnect](https://api.konnect.network/api/v2/konnect-gateway)) | `KONNECT_API_URL`, `KONNECT_API_KEY`, `KONNECT_WALLET_ID` | Confirm the sandbox URL in Konnect's docs. |
| Off-site backups | S3-compatible bucket and a key limited to it | Not a sandbox; holds test data until launch | `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY`, `BACKUP_S3_SECRET_KEY` | Kept after launch. |

### `.env.sandbox` template (backend)

Committed as `.env.example` (names only). Frontend `.env` holds only `VITE_API_URL=http://localhost:3001`.

```bash
# --- Environment ---
APP_ENV=development                 # development | prelaunch | production
SANDBOX_ALLOWED_RECIPIENTS=         # your test emails and phones, comma-separated
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173

# --- Existing services ---
DATABASE_URL=                       # postgresql://...@localhost:5434/tableqr
JWT_SECRET=                         # generated by env:init
JWT_EXPIRES_IN=7d
SCAN_HASH_SALT=                     # generated by env:init
ADMIN_EMAILS=                       # removed after P0-11
RESEND_API_KEY=
RESEND_FROM_EMAIL=onboarding@resend.dev
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_FOLDER=tableqr-dev
CLOUDINARY_LIBRARY_FOLDER=
OPENROUTER_API_KEYS=                # capped prelaunch key
LLM_MODEL_SMART=                    # OpenRouter model ID chosen by evaluation
LLM_MODEL_FAST=
PAYMENT_WHATSAPP=
PAYMENT_CONTACT_EMAIL=
PAYMENT_PHONE=
TRIAL_DAYS=30
SECRETS_ENCRYPTION_KEY=             # generated by env:init

# --- New integrations (fill when the phase needs them) ---
WA_PHONE_NUMBER_ID=
WA_BUSINESS_ACCOUNT_ID=
WA_ACCESS_TOKEN=
WA_APP_SECRET=
WA_VERIFY_TOKEN=                    # generated by env:init
WA_GRAPH_VERSION=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
GOOGLE_REVIEWS_WRITE_MODE=dry_run
FLOUCI_ENV=test
FLOUCI_PUBLIC_KEY=
FLOUCI_PRIVATE_KEY=
KONNECT_API_URL=                    # sandbox host from Konnect's docs
KONNECT_API_KEY=
KONNECT_WALLET_ID=
BACKUP_S3_ENDPOINT=
BACKUP_S3_BUCKET=
BACKUP_S3_ACCESS_KEY=
BACKUP_S3_SECRET_KEY=
```

`PAYMENT_PLANS`, `PRICE_TND`, Paddle and `PRICE_EUR`/`PRICE_USD` are removed (P0-00, P0-03).

### Guards (built in P0-00)

1. **`env:check`** runs at boot and before every Claude Code task, in both repos. It checks `APP_ENV`, the variables each phase needs, and the rules below. It prints names only, never values.
2. **Mode rules.** In `development` and `prelaunch`: `FLOUCI_ENV=test`, Konnect on its sandbox host, `GOOGLE_REVIEWS_WRITE_MODE=dry_run`, WhatsApp only on the test number. In `production`, the reverse: sandbox markers are refused, so the launch cannot be half-configured.
3. **Outbound allowlist.** In `development` and `prelaunch`, emails and WhatsApp messages go only to `SANDBOX_ALLOWED_RECIPIENTS`; others are logged and dropped.
4. **Redaction.** The logger masks every secret value.
5. **Spend caps.** OpenRouter key limit plus the app's own AI cost cap (P0-10).
6. **Server scope.** `deploy:env` and server scripts refuse to run when the server says `APP_ENV=production`, and act only inside `/opt/tableqr` on `tableqr-*` containers.

### Claude Code permission settings

Claude Code is launched from `C:\ARISHUB\Dev\`, so the settings file is `C:\ARISHUB\Dev\.claude\settings.json` (a copy is versioned in `dine-qr-backend/docs/`). Format from the [Claude Code settings docs](https://docs.claude.com/en/docs/claude-code/settings):

```json
{
  "permissions": {
    "deny": [
      "Read(./dine-qr-backend/.env)",
      "Read(./dine-qr-backend/.env.sandbox)",
      "Read(./dine-qr-backend/.env.local)",
      "Read(./dine-qr-style/.env.local)",
      "Edit(./dine-qr-backend/.env.sandbox)",
      "Bash(cat ./dine-qr-backend/.env.sandbox)",
      "Bash(printenv)",
      "Bash(env)"
    ],
    "ask": [
      "Bash(ssh arishub-db:*)"
    ]
  }
}
```

These rules reduce accidental exposure but are not a guarantee: Bash rules match prefixes and can be bypassed, and users have reported deny rules not being enforced in some versions ([GitHub issue](https://github.com/anthropics/claude-code/issues/6699)). So P0-00 also adds a `PreToolUse` hook that blocks any tool call mentioning `.env.sandbox` or the server's env file. The real protection is that every pre-launch key is sandbox-only or capped.
