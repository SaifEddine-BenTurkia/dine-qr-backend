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

## Assumptions made (say if one is wrong)

- **A1 (P0-00).** A server without `APP_ENV` runs as `prelaunch`: sandbox rules apply and emails go
  only to `SANDBOX_ALLOWED_RECIPIENTS`, or to the `ADMIN_EMAILS` accounts while that list is empty.
  Consequence today: a stranger who signs up on menu.arishub.site gets no verification email. This
  is the plan's intended pre-launch protection.
