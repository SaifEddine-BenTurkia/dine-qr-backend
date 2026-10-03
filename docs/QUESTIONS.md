# Questions and requests for the owner

Each entry: what is needed, why, and exact steps. Assumptions Claude Code made to keep going are
listed at the end; say if one is wrong.

## Open requests

### Q1. Revoke the leaked keys and create capped sandbox keys (P0-00)
**Why:** the OpenRouter and Resend keys from the old frontend `.env` are in git history (and were
once shipped in browser code). They were deleted from the local frontend `.env` on 2026-10-02, but
they stay valid until you revoke them.
**Steps:**
1. OpenRouter → Settings → Keys: delete the old key. Create a key named `tableqr-prelaunch` with a
   monthly credit limit (for example $20).
2. Resend → API Keys: delete the old key. Create a key with "Sending access" only.
3. Open `C:\ARISHUB\Dev\dine-qr-backend\.env.sandbox` in a text editor (it was created by
   `npm run env:init`). Uncomment and fill `OPENROUTER_API_KEYS=` and `RESEND_API_KEY=`, and add your
   own email to `SANDBOX_ALLOWED_RECIPIENTS=`. Save.
4. In that folder run `npm run smoke`: each service prints OK or FAIL, never the key.
5. Reply "keys rotated" so P0-00 can be closed.

### Q2. The `mehdichekir/dine-qr-style` copy (P0-00)
**Why:** that repository contains the same git history, including the leaked keys.
**Steps:** check whether https://github.com/mehdichekir/dine-qr-style is public. If so, ask its owner
to make it private or delete it. Then tell me whether I may remove the `mehdi-origin` remote from
the local frontend repository (it is still there).

### Q3. Copying keys to the server (`deploy:env`) needs your decision (P0-00)
**Why:** the plan has a `deploy:env` script that copies the sandbox keys to
`/opt/tableqr/.env.production` without printing them. Claude Code's permission system refused to
let me write that script, because it writes into a secret store on the server. It is not built.
**Choose one:**
- (a) Keep doing it yourself: after Q1, SSH to the server, edit `/opt/tableqr/.env.production`
  (as the `deploy` user or with sudo), set the new `OPENROUTER_API_KEYS` and `RESEND_API_KEY`, add
  `APP_ENV=prelaunch` and `SANDBOX_ALLOWED_RECIPIENTS=<your email>`, then re-run the last
  "CI/CD" workflow on GitHub (Actions → latest run on main → Re-run all jobs) to restart the API.
- (b) Allow it: tell me explicitly that I may write and run a `deploy:env` script that writes into
  the server env file (values on stdin, never printed), and I will build it.

### Q4. Merging to main is blocked for Claude Code (every feature)
**Why:** the kickoff asks me to merge each feature once CI passes, but Claude Code's permission
system refused the merge ("merge without review"). Nothing reaches production until a PR is merged.
**Open now:** backend https://github.com/SaifEddine-BenTurkia/dine-qr-backend/pull/12 and frontend
https://github.com/SaifEddine-BenTurkia/dine-qr-style/pull/1 (CI green on both).
**Choose one:**
- (a) Review and merge each PR yourself (merge the backend PR first, then the frontend one). After
  a merge, tell me and I check the deploy (health and guest menu) and continue.
- (b) Allow me to merge: add a permission rule in Claude Code that allows merging these two
  repositories' pull requests, then tell me to continue.

### Q5. Stray "Workers Builds: dine-qr-style" check (housekeeping)
**Why:** every commit of the frontend shows a failed "Workers Builds: dine-qr-style" check. It comes
from a Cloudflare Workers project with the same name, not from Pages (Pages deploys fine). It was
already failing before P0-00.
**Steps:** Cloudflare dashboard → Workers & Pages → the Worker named `dine-qr-style` (not the Pages
project) → Settings → delete it, or disconnect its Git repository.

### Q6. Merge order for the pitch build (2026-10-03)
**Why:** the pitch features are on `feat/P1-guest-service`, stacked on P0-00. Nothing is live until
merged, and Claude Code cannot merge (Q4).
**Steps (on GitHub, in this order):**
1. Backend: merge PR "P0-00 Security fixes and sandbox guards" (#12), then the PR from
   `feat/P1-guest-service`. Wait for the "CI/CD" run on main to finish green (about 6 minutes; it
   backs up the database, migrates and health-checks automatically).
2. Frontend: merge PR #1, then the PR from `feat/P1-guest-service`. Cloudflare Pages deploys in
   about 2 minutes.
3. Tell me, and I check the live site (health, guest menu, service board) and fix anything.

### Q7. Replace the production test restaurants with demo data? (2026-10-03)
**Why:** the plan (P0-02) asks to replace the 2 test restaurants on production with the 3 demo
locations. That deletes data on the server, which needs your approval.
**Options:** (a) keep production as it is and use the demo data only locally (recommended until
real customers arrive: your pitch restaurant is there); (b) tell me which production restaurants
may be deleted, and I will prepare a one-off script for you to run.

### Q8. When should emails go to every restaurant owner? (2026-10-03)
**Why:** before launch the server only emails the addresses in `ADMIN_EMAILS` (assumption A1), so
owners who register do not get their verification link. Workaround now: Console → Restaurants →
account → "Valider l'email".
**To open emails to everyone (your decision, on the server):** first rotate the Resend key (Q1),
then in the server's TableQR env file (in `/opt/tableqr`) either set `APP_ENV=production` (live
mode: only after the first paying customer) or keep prelaunch and list the owners' addresses in
`SANDBOX_ALLOWED_RECIPIENTS` (comma-separated); then redeploy (re-run the last CI/CD run on main).

## Assumptions made (say if one is wrong)

- **A1 (P0-00).** A server without `APP_ENV` runs as `prelaunch`: sandbox rules apply and emails go
  only to `SANDBOX_ALLOWED_RECIPIENTS`, or to the `ADMIN_EMAILS` accounts while that list is empty.
  Consequence today: a stranger who signs up on menu.arishub.site gets no verification email. This
  is the plan's intended pre-launch protection.
- **A2 (pitch).** For the 2026-10-04 pitch the plan order was changed: after P0-00, the Phase 1
  guest and staff features were built before the rest of Phase 0.
- **A3.** Plan entitlements are not enforced on the new features until P0-03 builds plans; during
  the trial every feature is unlocked anyway (reverse trial).
- **A4.** The owner dashboard and staff board stay in French until the rest of P0-05; the guest
  menu is in French, Arabic and English.
