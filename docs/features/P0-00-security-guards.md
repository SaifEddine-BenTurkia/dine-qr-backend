# P0-00 Security fixes and sandbox guards

Plan: section 8 (P0-00) and section 20 (guards). Repos: both.

## Scope

### Frontend (`dine-qr-style`)
- `.env` keeps only public `VITE_` values: the leaked `RESEND_API_KEY` and `VITE_OPENROUTER_KEYS` lines are deleted (by `sed`, never displayed). `VITE_API_URL` defaults to `http://localhost:3001` in development (`src/lib/api.ts`), and `.env.production` keeps the production URL for Cloudflare builds.
- Remove the ngrok host from `vite.config.ts`.
- Remove the TanStack Start leftovers: `src/server.ts`, `src/start.ts`, `src/lib/error-capture.ts`, `src/lib/error-page.ts`; dependencies `@tanstack/react-start` and `resend`; the `server-only` lint rule that mentions TanStack Start.
- `API_ENDPOINTS.md` becomes a pointer to `dine-qr-backend/docs/ARCHITECTURE.md`.
- Content-Security-Policy in `public/_headers`: first deployed as `Content-Security-Policy-Report-Only`, checked with Playwright on the landing page, dashboard and guest menu, then switched to enforced in the same feature.
- `scripts/env-check.mjs` (`npm run env:check`, also `predev` and `prebuild`): refuses non-`VITE_` variables and secret-looking values in any frontend env file; prints names only.
- `scripts/secrets-scan.mjs` (`npm run secrets:scan`): scans tracked files and `dist/` for key patterns; prints file, line and kind only. Runs in CI after the build.
- Commit the pending `.gitignore` change.

### Backend (`dine-qr-backend`)
- `APP_ENV` (`development` | `prelaunch` | `production`). Default when unset: `prelaunch` if `NODE_ENV=production`, otherwise `development`. The server has no `APP_ENV` yet, so it runs as `prelaunch`.
- Mode rules (`src/config/app-env.ts`), enforced at boot by `validateEnvironment` and by `npm run env:check`:
  - development / prelaunch: `FLOUCI_ENV` must be `test`; `KONNECT_API_URL` must be the sandbox host; `GOOGLE_REVIEWS_WRITE_MODE` must be `dry_run`; no value may carry a live-key marker (`sk_live_`, `pk_live_`, `rk_live_`).
  - production: the reverse (sandbox markers refused).
- Outbound allowlist (`src/mail/recipient-policy.ts`): outside `production`, email goes only to `SANDBOX_ALLOWED_RECIPIENTS`; when that list is empty, to the platform admins (`ADMIN_EMAILS`) so the owner can still test on the VPS. Dropped messages are logged with a masked address. WhatsApp will reuse the same policy (P3-01).
- Log redaction (`src/common/redacting-logger.ts`): the app logger masks the value of every secret-like env variable, known key formats, bearer tokens and email addresses.
- `npm run env:check` (`scripts/env-check.ts`): loads `.env.sandbox` if present, else `.env`, prints `APP_ENV`, then `OK` or `FAIL: <NAME> <reason>` lines, and `WARN` for unused variables. Never prints values.
- `npm run env:init` (`scripts/env-init.ts`): creates `.env.sandbox` when missing, with generated `JWT_SECRET`, `SCAN_HASH_SALT`, `SECRETS_ENCRYPTION_KEY`, `WA_VERIFY_TOKEN` and local defaults; never prints values and never overwrites an existing key.
- Config loading: `.env.sandbox` first, then `.env`.
- `npm run smoke` (`scripts/smoke.ts`): one line per configured service (database, Resend, OpenRouter, Cloudinary): `OK`, `FAIL (<http status>)` or `SKIP (not configured)`. Read-only calls only.
- `npm run smoke:public -- <api-url> <frontend-url> <slug>` (`scripts/smoke-public.ts`): health, guest menu and frontend, used after each deploy.
- `npm run deploy:env` (`scripts/deploy-env.sh`): copies the keys of `.env.sandbox` to `/opt/tableqr/.env.production` through the `tableqr-deploy` SSH alias (created in P0-12), values on stdin only, never printed. Refuses when the server file says `APP_ENV=production`; never copies server-owned keys (database, JWT, salts, URLs, sender, Cloudinary folder, `NODE_ENV`, `PORT`); sets `APP_ENV=prelaunch`; recreates only the `tableqr` API container.
- `npm run secrets:scan`: same scanner as the frontend, run in CI.
- Removed from the local `.env`: `PADDLE_*`, `PRICE_EUR`, `PRICE_USD` (unused).
- Claude Code settings: `C:\ARISHUB\Dev\.claude\settings.json` and one per repo, with the deny rules from PLAN section 20 and a `PreToolUse` hook (`scripts/claude-guard.mjs`) that blocks any tool call whose path or command mentions `.env.sandbox` or the server env file. A copy lives in `docs/claude-settings.json`.

## Not in scope / owner
- Revoking the leaked OpenRouter and Resend keys, and the `mehdi-origin` decision (QUESTIONS.md Q1, Q2).
- Running `deploy:env` needs `.env.sandbox` filled by the owner and the `tableqr-deploy` alias (P0-12).

## Tests
- `app-env.spec.ts`: default env per `NODE_ENV`, mode rules both ways, planted live Konnect URL fails, live-key marker fails.
- `recipient-policy.spec.ts`: production allows all; prelaunch allows only allowlist, falls back to admins, case-insensitive.
- `redacting-logger.spec.ts`: secret env values, `sk-or-v1-…`, `re_…`, bearer tokens and emails are masked.
- e2e keeps passing (CI runs with `APP_ENV` unset → development).
- Manual: `npm run env:check`, `npm run smoke`, `npm run secrets:scan` in both repos.

## Risks
- Enforcing CSP can break a third-party resource (fonts, Cloudinary, Unsplash sample photos in the preview). Mitigation: report-only first, Playwright console check on every main screen.
- The prelaunch allowlist drops verification emails to non-admin sign-ups on the VPS. Intended pre-launch; documented in QUESTIONS.md.
