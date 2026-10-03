# O-02 Caisse screen

**Status:** done (2026-10-03).

## Built
- Screen **Caisse** for the owner (Dashboard → Caisse) and staff (/staff/caisse), built for a
  tablet in landscape and usable on a phone.
- **Commandes**: "À valider" (new table orders with a chime, vibration and a notice; red after
  3 minutes) with **Accepter** / **Refuser** (quick reasons the guest sees), and "En préparation et
  prêtes" with **Prête**, **Servie** and reprint. Live through the same event stream as the service
  board, with 5 s polling as fallback.
- Daily order numbers (N° 1, 2…) reset at 05:00 Tunis time (a service day runs 05:00 to 05:00).
- Roles: kitchen marks ready; waiters mark ready/served; cashier/manager/owner do everything.

## Acceptance
- [x] New order on the caisse within 2 seconds (browser test: 1.5 s including rendering)
- [x] Accept/refuse/ready/served follow the allowed order of states (e2e: 409 otherwise)
