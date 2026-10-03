# TableQR demo (updated 2026-10-03, complete build)

A 6-minute live demo with three devices: a phone as the guest, a tablet or laptop as the caisse,
a second phone as the waiter. It also serves as the manual test of the build.

## Before the demo (about 15 minutes, once the two PRs are merged and deployed)

1. **Accounts.** The admin account only opens the console (`/admin`). Do the demo with a
   restaurant account (Console → Restaurants → "Nouveau compte restaurant" creates one, and
   "Valider l'email" opens it without waiting for the email).
2. **Réglages** (five tabs):
   - Identité: name, logo. Apparence: colour, style.
   - Langues: tick العربية and English.
   - Commande et ticket: turn on "Commande depuis la table".
   - WiFi et avis Google: network name and password.
3. **Carte**: 6 to 10 dishes with photos. "Traduire" → English, then العربية (needs a working
   OpenRouter key on the server; otherwise type two or three translations by hand).
4. **Tables et QR codes**: "Ajouter des tables" → 8 in "Salle". Open the QR of **T3** and keep it
   ready to scan.
5. **Équipe**: add a cashier (PIN 1234) and a waiter (PIN 5678).
6. **Fidélité**: "Activer la carte", 9 stamps, "1 café offert", pick a colour and an icon.
7. **Stock**: on one dish, add 10 "Ce soir".
8. **Tablet**: open `/staff`, restaurant code + PIN 1234, then "Activer le son" and "Activer les
   notifications". Install it ("Installer l'application"), then tap **"Plein écran"**: only the
   caisse stays on screen, with the clock and the counts.
   **Waiter phone**: `/staff`, PIN 5678, activate notifications, then lock the phone.
   (iPhone: add to the home screen first, then activate notifications from the installed app.)
9. Do one full rehearsal (below).

## The demo (talk track in italics)

1. **Scan T3 with the guest phone.** *"No app. The menu opens in the language of the phone, and it
   knows the guest is at table 3."* Switch to العربية and back.
2. **"Ajouter" on two dishes → "Voir la commande" → "Envoyer la commande".** The tablet rings and
   shows the order under **Nouvelles**. *"The order lands on the caisse, and it keeps ringing until
   someone takes it."*
3. **Tablet: "Accepter".** The kitchen ticket prints (or the print preview opens). The guest phone
   shows "En préparation". *"The guest follows the order without asking."*
4. **"Prête".** The waiter's locked phone gets "Commande N° 7 prête · À servir table T3". **"Servie · table T3".**
5. **Guest phone: "Serveur" → "Demander l'addition".** It appears under **Appels** on the tablet.
6. **Guest phone: "Obtenir ma carte"**, first name and phone. The card opens with its QR code.
7. **Tablet: À encaisser → T3 → "Carte de fidélité du client"** → type the name → **Espèces**.
   The receipt prints with "Fidélité · <name> 1 / 9 tampons"; the guest's card shows the stamp.
8. **Stock** (owner dashboard). *"Ten portions for tonight, two sold: TableQR proposes −30 % until
   closing."* Apply it: the guest menu shows the old price struck and the promo price.
9. **Accueil.** "Vos outils" lists every feature and its state; "Ce mois-ci avec TableQR" shows
   visits, calls, response time, best sellers.
10. **Clôture** on the tablet: the day's total by payment method, printable.
11. **Abonnement.** The three packs: Standard 49 DT, Premium 99 DT, Business 179 DT.

## If something goes wrong

- **Production not merged or down:** run it locally (Docker Desktop, `docker compose up -d
  postgres`, `npm run seed` and `npm run start:dev` in the backend, `npm run dev` in the frontend)
  and use `http://localhost:5173`. The seed creates "Café Tunis Centre"
  (`cafe-tunis@seed.tableqr.test` / `Demo-pass-123`, PINs 1234, 5678, 4321) with two weeks of sales.
  Notifications need HTTPS, so they only work on the deployed site; the ring works everywhere.
- **No ring:** tap "Activer le son" once (browsers require a tap before playing sound).
- **No notification on the locked phone:** the caisse still rings and refreshes; see QUESTIONS Q11.
- **No printer:** the print preview shows the ticket; a real thermal printer is QUESTIONS Q9.
- **AI translation fails:** the OpenRouter key is out of credit or revoked (QUESTIONS Q1). Type
  the translations by hand.

## What to say about the roadmap

Built: tables and QR, three languages with Arabic, table ordering, live caisse with ring and
notifications, kitchen tickets and receipts, counter sales and daily closing, staff logins by PIN,
loyalty stamp card (Google Wallet ready), stock with expiry and anti-waste promos, three packs,
feedback with alerts, value dashboard, admin console.
Next: print studio for table cards, weekly email report, several outlets under one account, the
visual redesign. Dropped by decision: online payments, Google reviews hub, AI advisor.
