# O-06 Order screen: notifications, ring, installable app

**Status:** done; delivery on a real phone to be checked after deploy (QUESTIONS Q11).

## The flow
Guest orders from the table → the **Caisse** screen (tablet at the counter, or a phone) rings and
keeps ringing every 6 seconds until someone accepts → "Accepter" prints the kitchen ticket and moves
the order to **En préparation** → "Prête" moves it to **Prêtes à servir** and notifies the waiters
→ "Servie · table T3" closes it. The guest follows each step on their phone.

## Built
- One live screen for everything (`components/caisse/caisse.tsx`), for the owner
  (`/dashboard/caisse`) and staff (`/staff`): tabs Commandes (three columns; on a phone each role
  first sees what it acts on), Appels (waiter and bill calls), À encaisser, Comptoir, Fidélité,
  Clôture. Tabs outside the pack show a lock for the owner and are hidden for staff.
- **Ring:** chime on every new order, ready order and call; repeats while an order waits. The
  choice is remembered per device (browsers need one tap per session before sound).
- **Notifications (Web Push, RFC 8030/8291/8292, library `web-push`):** `public/sw.js` shows them
  when the app is closed or the phone locked. New order → owner, managers, cashiers. Ready order and
  table call → also waiters. Low rating → owner, managers. The device subscribes from the caisse
  ("Activer les notifications"); "Réglages" has a test button.
- Server keys (VAPID) are generated once and stored in `PlatformSetting`, the private key sealed
  with a key derived from `JWT_SECRET`: nothing to configure. Subscriptions are accepted only for
  the browsers' push services (FCM, Mozilla, Windows, Apple): the API cannot be pointed elsewhere.
- Screen stays on (Wake Lock), "(3) Caisse" in the tab title and on the app icon, installable app
  ("TableQR Caisse", `staff.webmanifest`; the owner's dashboard has its own manifest).
- "Réglages de cet appareil": ring, notifications, auto-print, paper width, install.

## Acceptance
- [x] e2e: who receives a new order, a ready order; dropped subscriptions are removed; unknown
      push hosts refused; another restaurant cannot test or remove a device
- [x] Browser: order on the caisse in under 3 s, title badge, tickets printed, tracker on the phone
- [x] Service worker registers with the CSP enforced
- [ ] Notification received on a locked Android phone and on an iPhone with the app installed (Q11)

## Notes
- iPhone: notifications need the app added to the home screen first (iOS 16.4+).
- Rotating `JWT_SECRET` makes the stored keys unreadable: new keys are generated and devices must
  tap "Activer les notifications" again.
