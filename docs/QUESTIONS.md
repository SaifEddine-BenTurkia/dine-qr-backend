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

### Q8. When should emails go to every restaurant owner? (2026-10-03, updated)
**Why:** before launch the server only emails the addresses in `ADMIN_EMAILS` (assumption A1).
Since UX-03 new owners can use their account without the link, but they still receive no
confirmation and **no password reset email**. Workaround: Console → Restaurants → account
("Valider l'email"); for a forgotten password, ask me for an admin reset button if it happens.
**To open emails to everyone (your decision, on the server):** first rotate the Resend key (Q1),
then in the server's TableQR env file (in `/opt/tableqr`) either set `APP_ENV=production` (live
mode: only after the first paying customer) or keep prelaunch and list the owners' addresses in
`SANDBOX_ALLOWED_RECIPIENTS` (comma-separated); then redeploy (re-run the last CI/CD run on main).

### Q9. A thermal printer to test tickets (2026-10-03)
**Why:** tickets are built for 80/58 mm thermal printers and checked in print preview; a real
printer check is still needed. **What:** one 80 mm USB thermal printer (ESC/POS, e.g. Xprinter
XP-80, around 150–250 DT). Setup steps are in docs/features/O-03-printing.md.

### Q10. Google Wallet issuer account (2026-10-03)
**Why:** loyalty cards can be added to Google Wallet only with an issuer account in your name.
Until then guests use the web card (same stamps, same QR code).
**Steps:**
1. https://pay.google.com/business/console → "Google Wallet API" → create the issuer account
   (free). Note the **Issuer ID**.
2. https://console.cloud.google.com → a project → enable "Google Wallet API" → IAM → Service
   accounts → create one → Keys → add a JSON key (downloads a file).
3. In the Wallet console → Users → invite the service account's email as **Developer**.
4. On the server, in the TableQR env file: `GOOGLE_WALLET_ISSUER_ID=<the ID>` and
   `GOOGLE_WALLET_SERVICE_ACCOUNT=<the JSON file encoded in base64 on one line>`
   (`base64 -w0 key.json`), then redeploy. The account starts in demo mode: only test users you add
   in the console can save passes, until Google approves it for everyone.

### Q11. Check notifications on real phones (2026-10-03)
**Why:** push delivery depends on the phone and cannot be tested from here.
**Steps after the deploy:** follow CHANGELOG "Test manually" steps 2 and 3 with an Android phone
(Chrome) locked in your pocket. On an iPhone: Safari → Share → "Sur l'écran d'accueil" first, open
the app from the icon, then activate notifications. Tell me what you see.

### Q12. Loyalty cards store personal data (2026-10-03)
**Why:** the card keeps a first name and a phone number, with the guest's consent tick. In Tunisia
personal data processing is declared to the INPDP (law 2004-63). **Decision for you / your
adviser:** declare the processing before real customers join; the consent text is in
`guest-i18n.ts` (`loyaltyConsent`).

### Q13. Confirm the pack prices (2026-10-03)
49 / 99 / 179 DT per month, a year = 10 months. To change them: `PRICE_TND`, `PRICE_PREMIUM_TND`,
`PRICE_BUSINESS_TND` on the server (and the defaults in `src/lib/plans.tsx` for the landing page).

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
- **A5.** P0-11 is built in a lean form (staff with PINs inside one restaurant). The Account /
  Membership model for several outlets per account comes with the Business plan's multi-outlet.
- **A6.** A service day runs from 05:00 to 05:00 Tunis time (order numbers and the closing).
- **A7.** Receipts say "Ticket non fiscal": TableQR is not a certified fiscal cash register.
- **A8.** The trial unlocks every feature (the owner tries everything, then picks a pack).
- **A9.** A pack payment applies the pack at once and adds the time after what remains; there is no
  pro-rata when changing pack mid-period (payments are manual, the admin can adjust).
- **A10.** Stock is held when an order is created, and returned if it is refused or cancelled.
- **A11.** The web push keys live in the database, sealed with a key derived from `JWT_SECRET`.
- **A12.** "Several outlets" is not sold in the Business pack yet (needs the account model).
- **A13.** The CSP stays report-only for this release; it passed enforced on 15 screens locally.
- **A14.** Open sign-up (owner request, UX-03): restaurant accounts work before confirming their
  email; admin accounts must confirm first; `REQUIRE_EMAIL_VERIFICATION=true` restores the strict
  rule. Emails stay in prelaunch mode (hard limit): opening them is still Q8.
- **A15.** No per-account AI quota yet: AI import and translation are limited per IP address and by
  the capped OpenRouter key. A per-account daily quota comes with the first sign of abuse.

