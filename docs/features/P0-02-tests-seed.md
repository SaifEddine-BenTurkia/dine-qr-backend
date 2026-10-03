# P0-02 Tests, CI and seed data

**Status:** done locally and in CI (2026-10-03); replacing the production test restaurants waits
for the owner (QUESTIONS Q7).

## Built
- Frontend: Vitest + Testing Library (`npm test`): price/date helpers, guest language choice,
  account roles, "Ma sélection" surviving a reload.
- Frontend: Playwright on a Pixel 7 viewport (`npm run test:e2e`), built against a fake API origin
  and answered by `e2e/mock-api.ts` (no server, no real service): guest menu at a table in French
  then Arabic, restaurant login without admin entries, admin sent to the console.
- Frontend CI (`ci.yml`): lint, type check, unit tests, env check, build, secret scan; a second job
  runs the Playwright smoke tests and keeps traces on failure.
- `npm audit fix` on the frontend: the high advisories (vite, postcss) are fixed; 2 moderate ones
  need breaking upgrades and are left for a planned upgrade.
- Dependabot in both repos: one grouped weekly PR for minor/patch updates, majors ignored (they
  caused the conflicts and the Prisma 7 deploy failure on 2026-10-03).
- Backend `npm run seed`: Café Tunis Centre (fr/ar, 12 tables), Restaurant Hammamet Plage (5
  languages, 30 tables), Hôtel Djerba as 2 outlets (one account each until P6-03), with two weeks
  of guest visits, service calls and feedback. Accounts `<key>@seed.tableqr.test`, password
  `Demo-pass-123`. Replaces only its own accounts; refuses any non-local database or server mode.

## Acceptance
- [x] Frontend CI runs lint, type check, unit tests, build and a Playwright smoke test (guest menu opens, owner logs in)
- [x] One command seeds a local database (`npm run seed`)
- [x] High-severity frontend `npm audit` advisories with non-breaking fixes are fixed; Dependabot covers the frontend too
- [ ] Replace the 2 production test restaurants with this seed: deleting server data needs the owner (Q7)
