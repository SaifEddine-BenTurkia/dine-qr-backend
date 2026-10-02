# Changelog

Newest first. One entry per feature, with what to test manually.

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
