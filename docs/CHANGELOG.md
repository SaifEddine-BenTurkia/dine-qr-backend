# Changelog

Newest first. One entry per feature, with what to test manually.

## UX-02 Professional look, full-screen caisse (2026-10-03)

- Calmer, more professional screens: neutral colours, sharper cards, a top bar with "Voir mon
  menu" and "Ouvrir la caisse", an account menu.
- **Caisse → Plein écran**: the device next to the till shows only the caisse, with the time, the
  counts and a dark bar. It stays full screen after a reload (one tap).
- Orders show how long they have waited, amber then red.
- A screen that fails to load offers "Recharger la page".

**Test manually:** on the caisse tablet, Caisse → "Plein écran". Order from a phone: the count in
the bar goes up and the order card shows "à l'instant". Reload the tablet, tap once: full screen
again. Staff: "Changer" goes back to the PIN screen. "Quitter le plein écran" brings the menus back.

## Complete build: packs, order screen, loyalty, stock, usability (2026-10-03)

- **Packs:** Standard, Premium, Business; the trial unlocks everything; locked features show what
  the bigger pack adds.
- **Caisse:** one live screen with a ring that repeats until an order is accepted, notifications on
  locked phones, three columns (new, in preparation, ready), table calls, installable app.
- **Fidélité:** stamp card from the menu, stamp at payment, reward, card designer, Google Wallet
  ready.
- **Stock:** quantities, sell-by times, automatic sold-out, waste, promo suggestions and promo
  prices on the menu.
- **Usability:** grouped navigation, "Vos outils" on the home page, settings in tabs, clearer
  ordering on the guest's phone.

**Test manually (15 minutes, two devices):**
1. Restaurant → "Commande et ticket": turn on ordering. Équipe: add a cashier (PIN 1234) and a
   waiter (PIN 5678).
2. Tablet: open /staff, sign in as the cashier, "Activer le son" and "Activer les notifications".
   A second phone: sign in as the waiter and activate notifications too, then lock it.
3. Your phone: scan a table QR, add two dishes, "Voir la commande" → "Envoyer". The tablet rings.
   Accept (the ticket prints), "Prête" (the waiter's phone gets a notification), "Servie".
4. Fidélité → "Activer la carte". On your phone: "Obtenir ma carte". On the tablet: À encaisser →
   the table → "Carte de fidélité du client" → your name → Espèces. Your card shows 1 stamp.
5. Stock → add 10 of a dish "Ce soir" → a promo is suggested → apply it → the menu shows the old
   price struck.
6. Abonnement: the three packs.

## Ordering and caisse: P0-11 (lean), O-01 to O-05 (2026-10-03)

- **Équipe**: staff with roles and PINs; staff sign in at /staff on the caisse device.
- **Commande à table**: guests send their order from the table QR and follow its status.
- **Caisse**: live orders with a chime, accept/refuse, ready/served, tables to pay, counter
  sales, daily closing.
- **Tickets**: kitchen ticket, receipt and Z report for 80 mm or 58 mm thermal printers.

**Test manually:** Restaurant → turn on "Commande depuis la table" and fill the receipt details.
Équipe → add a cashier with PIN 1234. On a tablet open /staff, type the restaurant code and 1234.
On a phone scan a table QR, add two dishes, Commande → Envoyer. Accept it on the tablet, mark it
ready, check the phone, then À encaisser → the table → Espèces. Finish with Clôture → Imprimer.

## P0-04 Money in millimes (2026-10-03)

- Prices and payment amounts are stored as whole millimes; nothing changes on screen.
- The dish price field accepts "4,5", "4.500", "4D500" and "4 DT".

**Test manually:** edit a dish price to "4D500": the menu shows 4,500 DT.

## ADM-02 Admin console security (2026-10-03)

- `/admin` is a 404 for everyone but a signed-in admin (browser and API).
- Admins confirm each session with a 6-digit code from an authenticator app; sessions last 8 hours.
- Production data reset on 2026-10-03 at the owner's request (backup
  `/opt/tableqr/backups/pre-reset-20261003T082225Z.dump`); only the admin login was kept.

**Test manually:** open https://menu.arishub.site/admin signed out: "Page introuvable". Log in with
the admin email, scan the QR with Google Authenticator, enter the code: console. Log in as a
restaurant account and open /admin: "Page introuvable".

## ADM-01 Platform admin console (2026-10-03)

- The platform owner's tools moved out of the restaurant dashboard into their own console at
  `/admin`: overview, activity across all restaurants, restaurants, payments, system status.
- Two account roles: admin (console only) and restaurant (dashboard only), enforced on every
  endpoint. Console → Restaurants → "Nouveau compte restaurant" creates an owner account and can
  move a restaurant off an admin account.
- Prisma pinned back to 6 (Dependabot moved it to 7, which blocked the deploy).

**Test manually:** log in with an `ADMIN_EMAILS` account → you land on `/admin`. Open Activité
(switch 24 h / 7 j / 30 j), Restaurants, Paiements, Système. Log in as a normal owner and open
`/admin`: you are sent back to `/dashboard`. As admin, open `/dashboard`: you are sent to
`/admin`. Create a restaurant account and log in with it.

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
