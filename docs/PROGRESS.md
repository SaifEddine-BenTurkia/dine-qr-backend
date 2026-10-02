# TableQR build progress

Memory file for Claude Code: read it first in every session, update it after every feature.
Statuses: `todo`, `in progress`, `done`, `blocked-on-owner` (details in [QUESTIONS.md](QUESTIONS.md)).
Plan: [PLAN.md](PLAN.md). Changes: [CHANGELOG.md](CHANGELOG.md).

## Status

_Updated every 5 features._

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

## Phase 0: security, sandbox and foundations

Order: P0-00, P0-01, P0-02, P0-12, P0-13, P0-04, P0-11, P0-03, P0-05, P0-06, P0-07, P0-08, P0-09, P0-10.

| ID | Feature | Status | Note |
| --- | --- | --- | --- |
| P0-00 | Security fixes and sandbox guards | blocked-on-owner | Built, CI green (PRs #12 and #1). Waits for merge (Q4), key rotation (Q1), remote decision (Q2); deploy:env not built (Q3); CSP still report-only until deployed |
| P0-01 | Architecture doc | todo | |
| P0-02 | Tests, CI and seed data | todo | |
| P0-12 | Server hardening and reliability | todo | |
| P0-13 | Final domain | todo | |
| P0-04 | Money in millimes | todo | |
| P0-11 | Account model and roles | todo | |
| P0-03 | Plans, entitlements, feature flags | todo | |
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
