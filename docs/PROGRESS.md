# TableQR build progress

Memory file for Claude Code: read it first in every session, update it after every feature.
Statuses: `todo`, `in progress`, `done`, `blocked-on-owner` (details in [QUESTIONS.md](QUESTIONS.md)).
Plan: [PLAN.md](PLAN.md). Changes: [CHANGELOG.md](CHANGELOG.md).

## Status

_Updated every 5 features._ (first status after 5 features)

## Phase 0: security, sandbox and foundations

Order: P0-00, P0-01, P0-02, P0-12, P0-13, P0-04, P0-11, P0-03, P0-05, P0-06, P0-07, P0-08, P0-09, P0-10.

| ID | Feature | Status | Note |
| --- | --- | --- | --- |
| P0-00 | Security fixes and sandbox guards | in progress | |
| P0-01 | Architecture doc | todo | |
| P0-02 | Tests, CI and seed data | todo | |
| P0-12 | Server hardening and reliability | todo | |
| P0-13 | Final domain | todo | |
| P0-04 | Money in millimes | todo | |
| P0-11 | Account model and roles | todo | |
| P0-03 | Plans, entitlements, feature flags | todo | |
| P0-05 | i18n and RTL | todo | |
| P0-06 | Event tracking | todo | |
| P0-07 | Jobs and scheduler | todo | |
| P0-08 | Notifications service | todo | |
| P0-09 | Audit log | todo | |
| P0-10 | LLM service | todo | |

## Phase 1: guest and owner quick wins

Order: P1-01, P1-04, P1-05, P1-06, P1-02, P1-03, P1-12, P1-08, P1-07, P1-09, P1-10, P1-11.

| ID | Feature | Status | Note |
| --- | --- | --- | --- |
| P1-01 | Tables and per-table QR codes | todo | |
| P1-04 | Sold-out toggle | todo | |
| P1-05 | Service buttons (guest side) | todo | |
| P1-06 | Staff live board | todo | |
| P1-02 | AI menu import (photo or PDF) | todo | |
| P1-03 | AI translation and language auto-detect | todo | |
| P1-12 | "Ma sélection" (guest list) | todo | |
| P1-08 | Guest feedback, Google review option, alerts | todo | |
| P1-07 | Scheduled menus | todo | |
| P1-09 | Owner analytics and ROI dashboard | todo | |
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
