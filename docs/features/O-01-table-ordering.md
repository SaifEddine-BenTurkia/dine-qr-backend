# O-01 Cart and table ordering (guest)

**Status:** done (2026-10-03).

## Built
- Owner switch: Restaurant settings → **Commande depuis la table** (`orderingEnabled`).
- When it is on and the guest scanned a **table** QR code, the "Sélection" button becomes
  **Commande**: the guest's list (quantities, notes per dish) gets **Envoyer la commande**, and
  "Montrer au serveur" stays available.
- `POST /public/menu/:slug/orders` needs the table token: nobody orders from outside the
  restaurant. Prices, names and availability come from the server (sold-out dishes refused); at
  most 3 orders waiting per phone; 6 orders per minute per address.
- **Vos commandes**: the guest sees each order's status live (5 s refresh): En attente de
  validation → Acceptée · en préparation → Prête, elle arrive → Servie (or Refusée with the reason),
  and can cancel while it waits. French, Arabic, English.

## Acceptance
- [x] Refused while ordering is off, or without a valid table token (e2e)
- [x] Server prices; dishes of another restaurant and sold-out dishes refused (e2e)
- [x] Live status on the guest's phone (browser test: accepted and ready seen within seconds)
