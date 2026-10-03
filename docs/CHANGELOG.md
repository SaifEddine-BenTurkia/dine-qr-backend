# Changelog

Newest first. One entry per feature, with what to test manually.

## ADM-01 Platform admin console (2026-10-03)

- The platform owner's tools moved out of the restaurant dashboard into their own console at
  `/admin`: overview, activity across all restaurants, restaurants, payments, system status.
- Admins land on the console after login; "Mon restaurant" switches to the restaurant dashboard.
- Prisma pinned back to 6 (Dependabot moved it to 7, which blocked the deploy).

**Test manually:** log in with an `ADMIN_EMAILS` account → you land on `/admin`. Open Activité
(switch 24 h / 7 j / 30 j), Restaurants, Paiements, Système. Log in as a normal owner and open
`/admin`: you are sent back to `/dashboard`.

## Pitch build: P1-01, P1-03, P1-04, P1-05, P1-06, P1-08, P1-09, P1-12 (2026-10-03)

- Tables with their own QR codes (bulk add, zones, PNG/SVG, print all, rotate a QR).
- Guest bar: call the waiter, ask for the bill (cash or card), WiFi with a join QR, "Ma sélection"
  with "Montrer au serveur", and feedback.
- Staff live board with sound, waiting-time colours and low-rating alerts.
- Sold out until tomorrow 05:00 or until reset, live on the guest menu.
- Menu in French, Arabic (right-to-left) and English; AI translation with a Tunisian dish glossary;
  "IA · à vérifier" flags.
- Feedback with tags, consented contact and a Google review button shown to everyone.
- "Ce mois-ci avec TableQR" value dashboard, heatmap, languages, top and low-conversion dishes.
- Restaurant settings: WiFi, Google Place ID, menu languages.

**Test manually:** see docs/PITCH_DEMO.md (the demo script doubles as the manual test).

## P0-00 Security fixes and sandbox guards (2026-10-02)

- Frontend `.env` holds only `VITE_API_URL` (local API by default); the leaked keys are gone from it.
- Removed the TanStack Start leftovers, the `@tanstack/react-start` and `resend` frontend
  dependencies, and the ngrok host. `API_ENDPOINTS.md` now points to the architecture doc.
- Content-Security-Policy in `public/_headers` (report-only first, then enforced), with the API
  origin written at build time.
- Backend: `APP_ENV` with sandbox mode rules checked at boot, outbound email allowlist, log
  redaction, `env:check`, `env:init`, `smoke`, `smoke:public`, `secrets:scan`; CI runs the secret
  scan and the env guard in both repos.
- Claude Code settings with deny rules and a secrets hook (Dev folder and both repos).

**Test manually:** in the backend run `npm run env:check` and `npm run smoke`; in the frontend
`npm run dev` must call `http://localhost:3001`; on menu.arishub.site the landing page, dashboard
and a guest menu must load with no console errors.
