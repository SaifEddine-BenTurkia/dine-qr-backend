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

## Assumptions made (say if one is wrong)

- **A1 (P0-00).** A server without `APP_ENV` runs as `prelaunch`: sandbox rules apply and emails go
  only to `SANDBOX_ALLOWED_RECIPIENTS`, or to the `ADMIN_EMAILS` accounts while that list is empty.
  Consequence today: a stranger who signs up on menu.arishub.site gets no verification email. This
  is the plan's intended pre-launch protection.
