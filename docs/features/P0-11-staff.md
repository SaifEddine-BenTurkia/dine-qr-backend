# P0-11 Staff accounts and roles (lean version)

**Status:** done for the caisse (2026-10-03). The full Account/Membership restructure of PLAN.md
(several restaurants per account, subscription on the account, admins as a database role) is not
built: it comes with Business multi-outlet (ROADMAP) and is recorded as assumption A5.

## Built
- `StaffMember` (name, role MANAGER / CASHIER / WAITER / KITCHEN, PIN, active, tokenVersion).
- Owner: Dashboard → **Équipe**: add, edit (name, role, new PIN), deactivate, delete. Shows the
  staff address and the restaurant code to type on the device.
- Staff sign in at **/staff** with the restaurant code (its slug) and a 4–6 digit PIN on a keypad.
  Session of 14 days on that device, separate from the owner's session (own storage key).
- PINs are stored as HMAC-SHA256 with a server key and the restaurant id, unique per restaurant
  (the PIN identifies the person). Limits: 5 tries per minute per address, and 10 wrong PINs per
  restaurant in 15 minutes pause its staff login.
- Changing a PIN or role, or deactivating, ends that member's sessions at once (tokenVersion).
- Access: staff reach only routes marked `@ForRole(..., 'staff')`, narrowed by `@StaffRoles`:
  service board (all), orders list and ready/served (all), accept/refuse, counter sales, payment,
  receipts, closing (manager, cashier). Never the menu editor, settings, stats, team or billing.

## Acceptance
- [x] e2e: unique PIN per restaurant (same PIN allowed elsewhere), wrong PIN refused, roles limited,
      deactivation ends the session
- [x] Browser: cashier signs in with the keypad and runs the caisse
