# UX-03 Professional landing page, open sign-up

**Status:** done (2026-10-03). Owner request: "update the main page menu.arishub.site to follow the
same style, make it more professional; open access to anyone to create accounts".

## Landing page (frontend `src/routes/index.tsx`, `site-header.tsx`)
- Same look as the app (`app-ui`): neutral surfaces, the UI font, borders instead of gradients.
- Hero: "Menu QR, commande à table et caisse, en un seul outil", the caisse board in a browser
  frame and the guest's order tracker on a phone (static mock-ups, no real data).
- Facts strip, the service flow in four steps, features grouped for guests / team / owner, the
  live menu style picker, the three packs, FAQ ("Puis-je commencer tout de suite ?", "Quel
  matériel faut-il ?"), a dark closing call to action, a footer with links (including /staff).
- Every claim matches a built feature; nothing about Google Wallet or online payment.

## Open sign-up
**Before:** the API refused every request from an account whose email was not confirmed, and
before launch the server only emails the admin addresses (A1). A stranger could create an account
but never use it.

**Now:**
- A **restaurant account works as soon as it is created**: dashboard, restaurant, menu, trial.
- An **admin account must still confirm its email first.** Admin rights come from the address
  (`ADMIN_EMAILS`); without this rule anyone could sign up with an admin address, before its owner,
  and set up the second factor themselves. Admin routes keep answering 404 to such an account.
- `REQUIRE_EMAIL_VERIFICATION=true` in the server env brings back the strict rule for everyone
  (for example if fake accounts appear).
- `/auth/me` returns `emailDelivery`: whether this server can email the address. The dashboard
  shows "Confirmez votre adresse · Renvoyer le lien" only then, so no one waits for a link that
  cannot arrive before launch.
- Sign-up goes straight to the dashboard (no "check your inbox" page).

## Limits that stay
- Before launch, password reset emails only reach the allowlist: a stranger who forgets their
  password needs you (Console → Restaurants) until emails open (QUESTIONS Q8).
- AI import and translation are limited per IP address (20 and 10 per hour) and by the capped
  OpenRouter key (Q1): strangers cannot spend more than the cap.

## Acceptance
- [x] Unit: the rule (restaurant in, admin out until confirmed, strict switch, confirmed never
      blocked)
- [x] e2e: a new account reads `/restaurant` at once; an unconfirmed admin address gets 404 on the
      console and the second-factor setup, 403 elsewhere; 48 e2e tests pass
- [x] Playwright: sign-up to dashboard; reminder only when the email can arrive (12 tests)
- [x] Real browser against the local API: sign up, create the restaurant, sign out, sign in again
- [x] Landing page at 360, 768, 1024, 1280 and 1440 px: no horizontal scroll, no console error
