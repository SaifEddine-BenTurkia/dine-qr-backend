# TableQR pitch demo (2026-10-04)

A 5-minute live demo with two devices: a phone as the guest, a laptop or tablet as the staff
screen. It also serves as the manual test of the pitch build.

## Before the pitch (about 15 minutes, once the PRs are merged)

1. Log in on https://menu.arishub.site with your account (the one in `ADMIN_EMAILS`).
2. **Restaurant**: name, logo, colour, template "Classique" or "Élégant". Under the new sections:
   - Langues du menu: tick العربية and English.
   - WiFi: a network name and password.
   - Place ID Google: your restaurant's Place ID (or any real one for the demo).
3. **Menu**: 6 to 10 dishes with photos. Click **Traduire** → English, then العربية. Open one dish
   to show the "IA · à vérifier" badge and tick "Vérifiée".
   (Needs a working OpenRouter key on the server. Without one, type two or three translations by
   hand in the dish window: the guest menu works the same.)
4. **Tables**: "Ajouter des tables" → 8 tables in "Salle", then 4 in "Terrasse".
5. Open the QR of table **T3** on the laptop (click it) and keep it ready to scan.
6. On the laptop/tablet open **Service** and tap **Activer le son**.
7. Do one full rehearsal (below), then reset: on the Service page tap "Fait" on everything.

## The demo (talk track in italics)

1. **Scan T3 with the phone.** *"No app. The guest scans the table's QR code: the menu opens in the
   language of their phone, here French, and it knows they're at table 3."*
2. **Switch to العربية.** *"Arabic, right to left, and English for tourists. Tunisian dishes keep
   their names with a short explanation."*
3. **Tap "Serveur" → "Appeler le serveur".** The laptop chimes and shows **T3** within a second.
   *"No more waving at the waiter."* Tap **J'arrive** on the laptop: the phone shows *"Un serveur
   arrive"*.
4. **WiFi.** *"The most asked question in a café, answered: tap, copy, or scan to join."*
5. **"+ Sélection" on two dishes → Sélection → Montrer au serveur.** *"Guests build their order
   and show it: big text, table number, total. Next step: send it straight to the kitchen."*
6. **Sold out.** On the laptop, Menu → a dish → "Épuisé jusqu'à demain". Within 5 seconds the
   phone greys it out. *"No more 'sorry, we're out of brik' after the guest has chosen."*
7. **Addition → Carte.** It appears on the board. *"The bill request, with how they want to pay."*
8. **Feedback: 2 stars, tag "Attente".** The laptop shows a red alert *"Table T3 — 2/5"*.
   *"The manager knows before the guest leaves, and can fix it."* Point at the Google button:
   *"Every guest sees the same Google review button, whatever their rating: that's Google's rule,
   and we follow it."*
9. **Accueil (home).** *"Ce mois-ci avec TableQR": visits, calls handled, average response time,
   reviews, Google clicks, busiest hours, languages of your guests, dishes viewed but rarely
   chosen.* *"Every number is something the owner can act on."*
10. **Tables → Imprimer toutes.** Print preview with one QR card per table, French and Arabic.

## If something goes wrong

- **Production not merged or down:** run it locally (Docker Desktop, `docker compose up -d
  postgres` and `npm run start:dev` in the backend, `npm run dev` in the frontend) and use
  `http://localhost:5173`. The phone must be on the same network; use the laptop's IP instead of
  localhost, or demo the guest side in the browser's phone view (F12 → device toolbar).
- **Live board not updating instantly:** it still refreshes every 5 seconds on its own.
- **AI translation fails:** the OpenRouter key on the server is the leaked one or out of credit
  (QUESTIONS Q1). Type the translations by hand.

## What to say about the roadmap

Built and demonstrable now: tables and QR, service calls, live staff board, sold out, three
languages with Arabic, selection, compliant feedback with alerts, value dashboard.
Next in the plan: plans and pricing tiers, multi-restaurant accounts and staff logins, Google
reviews with AI replies, WhatsApp, table ordering with kitchen display, online payments
(Flouci, Konnect), smart pricing, loyalty.
