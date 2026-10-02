# TableQR — instructions for Claude Code

TableQR: digital menu SaaS for restaurants, cafés and hotels in Tunisia. Pre-launch: no real users yet.
Repos: dine-qr-backend (NestJS 11, Prisma 6, PostgreSQL 17, Jest) and dine-qr-style (React 19, Vite 7,
TanStack Router/Query, Tailwind 4, shadcn/ui). Frontend on Cloudflare Pages (menu.arishub.site);
API on an OVH VPS behind Cloudflare + nginx (menu-api.arishub.site), deployed by GitHub Actions.

Start of every session: read docs/PROGRESS.md (where the work stands), then docs/PLAN.md,
docs/ARCHITECTURE.md and docs/DISCOVERY.md (audit snapshot of 2026-10-02).

Always:
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

Useful commands (backend): `npm run env:check`, `npm run env:init`, `npm run smoke`,
`npm run smoke:public`, `npm run secrets:scan`, `npm test`, `npm run test:e2e`.
Local database: `docker compose up -d postgres` (port 5434).
