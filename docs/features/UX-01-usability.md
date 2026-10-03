# UX-01 Usability pass (part of P7-00 / P7-02)

**Status:** done (2026-10-03). The full visual redesign (P7) remains.

## Audit (screenshots of every screen, phone and desktop)
1. Features hidden behind "Plus" on phones, with no explanation of what each does.
2. Settings: one long form; the ordering switch was at the bottom.
3. Opening Settings on a phone jumped to the middle of the page (the live preview scrolled the
   page to its active category).
4. "Épuisé" was inside a "⋮" menu on phones.
5. Two live screens (Service, Caisse) for the same person.
6. "QR du menu" and "Tables" were separate pages.
7. Guest: a large "+ Sélection" button on every dish, and the cart was only an icon in the bar.

## Changes
- One list of screens (`components/dashboard/sections.ts`) feeds the grouped sidebar (Vendre, La
  carte, Clients, Réglages), the phone tab bar and the full phone menu, where each screen has one
  line saying what it is for, and a lock with the pack name when it is outside the pack.
- Home: three daily shortcuts, then "Vos outils": every feature with its state (Actif, À
  configurer, pack needed) and a direct link to the place that turns it on.
- Settings in five tabs (Identité, Apparence, Langues, Commande et ticket, WiFi et avis Google),
  reachable by link (`/dashboard/settings#ordering`).
- The preview no longer moves the page.
- "Épuisé" is one tap on phones too; dish rows show promo and stock.
- Service calls live in the Caisse ("Appels" tab); `/dashboard/service` redirects there.
- Tables page links to the general QR code.
- Guest: compact "Ajouter" button, a "Voir la commande" bar with the count and the total, an order
  tracker pinned above the bar, promo and "Plus que n" badges, loyalty banner.
- Caisse: big touch targets, three columns, device settings in one sheet, the two things to turn on
  (sound, notifications) shown until done.
