# UX-02 Professional look, full-screen caisse

**Status:** done (2026-10-03). Owner request: "make it more professional; the caisse needs a full
screen option, it will be shown on a device next to the till that prints". Part of P7-00 / P7-02;
the guest menu (P7-01) is unchanged.

## Built
- **Theme** (`src/styles.css`): neutral surfaces instead of cream, a 4 to 16 px corner scale,
  light shadows, a deeper terracotta (white text on buttons at 4.5:1), sage for "done / live".
  Working screens (dashboard, caisse, staff app, console, account pages) carry the `app-ui` class:
  titles in the UI font. The landing page and the guest menu keep the display font and their
  templates.
- **Primitives:** buttons 44 px on touch screens and 40 px with a mouse, white inputs with a
  visible focus ring, cards `rounded-xl border shadow-xs`, one page header with a divider, quiet
  empty states.
- **Dashboard shell:** sidebar with groups and an active marker, restaurant and pack at the top,
  account menu at the bottom (Abonnement, Déconnexion); a top bar on desktop with where you are
  ("La carte › Menu"), "Voir mon menu" and "Ouvrir la caisse".
- **Full-screen caisse** ("Plein écran", in the caisse header and in Réglages):
  - only the caisse on screen, with a dark bar: restaurant, who is signed in, counts (new, in
    preparation, ready, calls; tap to jump), live status, clock, sound, settings, "Changer" (staff
    hand the device over without leaving full screen), "Quitter le plein écran";
  - uses the browser's own full screen where it is allowed (Android, desktop, iPad); on an iPhone
    the layout still fills the window;
  - kept per device: after a reload the caisse opens full screen and the first tap hides the
    browser bars again (browsers require a tap).
- **Order cards:** coloured edge per stage (new, in preparation, ready), a timer that turns amber
  then red (new: 2 / 5 min, in preparation: 10 / 20 min, ready: 3 / 6 min), quantities in a
  column, item notes in amber, article count and total, "Servie" in green.
- **Call cards:** same layout, with the waiting time.
- **Settings** in underline tabs; login, sign-up, password and email pages, the PIN screen and
  the 404 restyled.
- **Error screen:** a page that fails to render shows "Cette page n'a pas pu s'afficher ·
  Recharger la page" instead of a raw error. Seen on 2026-10-03 when the frontend went live about
  three minutes before the API that matched it.

## Acceptance
- [x] Playwright: full screen on a staff phone, kept after a reload, "Changer d'utilisateur" in
      the bar, leaving it (10 tests in total)
- [x] Real browser, tablet, desktop and phone: entering, reload, switch user, leaving
- [x] Full flow against the local API, 23 checks (order, tickets, payment with a stamp, reward,
      counter sale, closing, promo, packs)
- [ ] On the real caisse device after the deploy: "Plein écran", then lock and unlock it

## Notes
- The router splits each file under `src/routes/` into its own chunk: a React context declared
  there exists twice. Shared state lives in `src/lib/` (`staff-context.ts`).
- Merge order matters: the API first, then the frontend, once the API deploy has finished
  (about 6 minutes).
