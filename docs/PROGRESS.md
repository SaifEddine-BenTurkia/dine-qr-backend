# TableQR build progress

Memory file for Claude Code: read it first in every session, update it after every feature.
Statuses: `todo`, `in progress`, `done`, `blocked-on-owner` (details in [QUESTIONS.md](QUESTIONS.md)).
Plan: [PLAN.md](PLAN.md). Changes: [CHANGELOG.md](CHANGELOG.md).

## Status

_Updated every 5 features._

**2026-10-03, complete build (owner: "finish everything").** On branch `feat/complete` in both
repos, on top of the merged ordering work.

- **Done (14):** P0-03 three packs with entitlements; O-06 order screen with ring, web push and
  installable staff app; L-01, L-02, L-03 loyalty, Google Wallet service, card designer; S-01 to
  S-04 stock, expiry, sales, anti-waste suggestions and promo prices; UX-01 usability pass
  (navigation, home, settings, guest ordering).
- **Blocked on the owner:** merge of the two PRs (Q4); Google Wallet issuer account (Q10); real
  phone check of notifications (Q11); thermal printer (Q9); key rotation (Q1).
- **Assumptions:** A8 (trial unlocks everything), A9 (a pack payment applies at once), A10 (stock
  held when the order is created), A11 (push keys kept in the database), A12 (multi-outlet not sold
  yet), A13 (CSP still report-only).
- **Next:** verify the deploy and notifications on real devices, enforce the CSP, then P1-10 print
  studio, P1-11 weekly report, Account/Membership for several outlets, P7 visual redesign.

**2026-10-03, ADM-02 and data reset.** PRs #15/#3 merged and live. Production data reset at the
owner's request (only the admin login kept; backup taken first). ADM-02: the console is hidden (404)
and protected by an authenticator code.

**2026-10-03, after the pitch build.** Everything above is merged and live (owner merged; the
Prisma 7 bump from Dependabot broke the deploy and was pinned back to 6 in backend PR #14).
Owner request ADM-01: the admin tools moved to their own console at `/admin` (see
features/ADM-01-admin-console.md).

**2026-10-03, pitch build.** The owner asked for a pitch-ready product by 2026-10-04, so plan order
was changed on purpose: after P0-00, the guest and staff features of Phase 1 that show value in a
demo were built first, on branch `feat/P1-guest-service` (stacked on P0-00) in both repos.

- **Done (8):** P1-01 tables and QR, P1-04 sold out, P1-05 service buttons, P1-06 staff live
  board (no web push), P1-03 translations + guest language and RTL, P1-12 selection, P1-08
  feedback with Google button, P1-09 value dashboard (with a minimal P0-06 events table).
- **Blocked on the owner:** every merge (Q4: Claude Code may not merge), key rotation (Q1),
  `mehdi-origin` (Q2), `deploy:env` (Q3).
- **Assumptions:** A1 (prelaunch email allowlist), A2 (plan order changed for the pitch), A3
  (entitlements not enforced until P0-03), A4 (owner dashboard stays French until P0-05).
- **Next:** P0-01 architecture doc, P0-02 tests/seed, then back to plan order (P0-12, P0-13,
  P0-04, P0-11, P0-03, P0-05 remainder, P0-06 aggregates, …), then P1-02, P1-07, P1-10, P1-11.

**2026-10-02, stopped after P0-00.** P0-00 is built and green in CI (backend PR #12, frontend PR #1),
but merging to main was refused by Claude Code's permission system, so nothing is deployed yet.

## New roadmap (owner decision 2026-10-03, see ROADMAP.md)

Order: P0-04, P0-11, O-01, O-02, O-03, O-04, O-05, P0-03 (3 plans), L-01, L-02, L-03, S-01, S-02,
S-03, S-04, then P1-10, P1-11, P7. Dropped: online payments, Google reviews hub, AI advisor.

| ID | Feature | Status | Note |
| --- | --- | --- | --- |
| O-01 | Cart and table ordering | done | Guest cart → order with table QR, live status |
| O-02 | Caisse screen | done | Live caisse, accept/refuse/ready/served |
| O-03 | Ticket printing | done | Kitchen ticket, receipt, Z at 58/80 mm; real printer check waits for Q9 |
| O-04 | Bill and payment at the counter | done | Pay per table, discount, cash/card, Z report |
| O-05 | Counter sales | done | Counter grid, takeaway paid at once |
| L-01 | Loyalty program | done | Stamps, guest card, stamp at payment, reward |
| L-02 | Google Wallet card | done | Service built and tested against fakes; live pass waits for Q10 |
| L-03 | Card designer | done | Colour, title, stamp icon, live preview |
| S-01 | Stock per dish | done | Sold out at 0, stock held by orders |
| S-02 | Batches and expiry | done | Sell-by time, expired stock leaves as waste |
| S-03 | Sales vs stock | done | Per dish: today, 7 days, pace, days of stock |
| S-04 | Anti-waste suggestions | done | Promo, restock and slow-seller rules; promo price in one tap |
| O-06 | Order screen: ring, notifications, installable app | done | Web push; real phone check waits for Q11 |
| UX-01 | Usability pass | done | Navigation, home, settings tabs, guest ordering flow |

## Owner requests outside the plan

| ID | Feature | Status | Note |
| --- | --- | --- | --- |
| UX-02 | Professional look, full-screen caisse | done | Theme, shell, order cards, "Plein écran" kept per device; frontend branch feat/ui-pro |
| ADM-02 | Admin console security (hidden, TOTP, 8 h sessions) | done | Branch feat/admin-2fa |
| ADM-01 | Platform admin console at /admin | done | Activity across restaurants, system status; branch feat/admin-console |

## Phase 0: security, sandbox and foundations

Order: P0-00, P0-01, P0-02, P0-12, P0-13, P0-04, P0-11, P0-03, P0-05, P0-06, P0-07, P0-08, P0-09, P0-10.

| ID | Feature | Status | Note |
| --- | --- | --- | --- |
| P0-00 | Security fixes and sandbox guards | blocked-on-owner | Built, CI green (PRs #12 and #1). Waits for merge (Q4), key rotation (Q1), remote decision (Q2); deploy:env not built (Q3); CSP still report-only until deployed |
| P0-01 | Architecture doc | done | docs/ARCHITECTURE.md; in PR #15 with ADM-01 |
| P0-02 | Tests, CI and seed data | done | Vitest, Playwright smoke, `npm run seed`, grouped Dependabot; prod test data replacement waits for Q7 |
| P0-12 | Server hardening and reliability | todo | |
| P0-13 | Final domain | todo | |
| P0-04 | Money in millimes | done | Integer millimes in DB, shared helpers, exact migration |
| P0-11 | Account model and roles | done (lean) | Staff PIN logins and roles; Account/Membership restructure deferred (A5) |
| P0-03 | Plans, entitlements, feature flags | done | Standard / Premium / Business, enforced on the server |
| P0-05 | i18n and RTL | in progress | Guest menu done (fr/ar/en, RTL) with P1-03; dashboard, emails, lint rule still to do |
| P0-06 | Event tracking | in progress | Event table, guest tracker and server events built with P1-09; daily aggregates and Scan migration still to do |
| P0-07 | Jobs and scheduler | todo | |
| P0-08 | Notifications service | todo | |
| P0-09 | Audit log | todo | |
| P0-10 | LLM service | todo | |

## Phase 1: guest and owner quick wins

Order: P1-01, P1-04, P1-05, P1-06, P1-02, P1-03, P1-12, P1-08, P1-07, P1-09, P1-10, P1-11.

| ID | Feature | Status | Note |
| --- | --- | --- | --- |
| P1-01 | Tables and per-table QR codes | done | Branch feat/P1-guest-service, not merged (Q4); entitlement waits for P0-03 |
| P1-04 | Sold-out toggle | done | 4.9 s to the guest menu; "hide instead" setting not built |
| P1-05 | Service buttons (guest side) | done | Waiter, bill cash/card, WiFi with QR; cooldown and rate limits |
| P1-06 | Staff live board | done | SSE + polling, sound, alerts; web push and Arabic board not built |
| P1-02 | AI menu import (photo or PDF) | todo | |
| P1-03 | AI translation and language auto-detect | done | Needs a working OpenRouter key on the server (Q1) |
| P1-12 | "Ma sélection" (guest list) | done | |
| P1-08 | Guest feedback, Google review option, alerts | done | Saving as Review waits for Phase 2 |
| P1-07 | Scheduled menus | todo | |
| P1-09 | Owner analytics and ROI dashboard | done | Raw-event queries; aggregates with P0-06 |
| P1-10 | Print studio | todo | |
| P1-11 | Weekly report | todo | |

## Phase 2: Google reviews hub, AI replies, decision engine

| ID | Feature | Status | Note |
| --- | --- | --- | --- |
| P2-01 | Google Business Profile connection | todo | |
| P2-02 | Review sync | todo | |
| P2-03 | AI reply drafts and publishing | todo | |
| P2-04 | Review analysis | todo | |
| P2-05 | Decision engine ("Conseiller IA") | todo | |
| P2-06 | Closed loop: measure what changed | todo | |

## Phase 3: WhatsApp, sales bot, owner notifications

| ID | Feature | Status | Note |
| --- | --- | --- | --- |
| P3-01 | WhatsApp Cloud API infrastructure | todo | |
| P3-02 | Sales qualification bot | todo | |
| P3-03 | Demo menu from a photo | todo | |
| P3-04 | Lead CRM and human handoff | todo | |
| P3-05 | Owner notifications and approvals on WhatsApp | todo | |

## Phase 4: ordering, kitchen, printing, payments

Order: P4-07 first, then P4-01 to P4-06.

| ID | Feature | Status | Note |
| --- | --- | --- | --- |
| P4-07 | Online subscription payments for owners | todo | |
| P4-01 | Cart and table ordering | todo | |
| P4-02 | Order management and kitchen display | todo | |
| P4-03 | Ticket printing (spike) | todo | |
| P4-04 | Online payments (Flouci, Konnect) | todo | |
| P4-05 | Split bill | todo | |
| P4-06 | Upsell rules | todo | |

## Phase 5: smart pricing and margin alerts

| ID | Feature | Status | Note |
| --- | --- | --- | --- |
| P5-01 | Ingredient costs and recipe costing | todo | |
| P5-02 | Margin alerts | todo | |
| P5-03 | Off-peak deals | todo | |
| P5-04 | End-of-day perishables | todo | |
| P5-05 | AI price suggestions | todo | |
| P5-06 | Price change log and printable price board | todo | |

## Phase 6: loyalty, CRM, multi-branch, hotels, guest bot, cash register

| ID | Feature | Status | Note |
| --- | --- | --- | --- |
| P6-01 | Loyalty stamp card | todo | |
| P6-02 | Guest CRM and campaigns | todo | |
| P6-03 | Multi-branch | todo | |
| P6-04 | Hotel module | todo | |
| P6-05 | Guest WhatsApp bot (add-on) | todo | |
| P6-06 | Reservations | todo | |
| P6-07 | Cash register integration (spike) | todo | |

## Phase 7: UI/UX overhaul

| ID | Feature | Status | Note |
| --- | --- | --- | --- |
| P7-00 | UX audit and design direction | todo | |
| P7-01 | Guest menu redesign | todo | |
| P7-02 | Owner app, mobile-first | todo | |
| P7-03 | Landing page and pricing page | todo | |
| P7-04 | Brand and domain | todo | |
| P7-05 | Accessibility and performance pass | todo | |

## Working notes

- GitHub CLI is not installed: CI status, pull requests and merges go through the REST API with the
  local git credential (helper script in `~/.tableqr-tools/ghapi.sh`, never prints the token).
- Local stack: `docker compose up -d postgres` (5434); API on 3001 from `.env.sandbox` (created by
  `npm run env:init`) with `.env` as fallback; demo seed until P0-02 replaces it.
- `ssh arishub-db` (sudo) is on the "ask" list; the deploy-user alias arrives with P0-12.
