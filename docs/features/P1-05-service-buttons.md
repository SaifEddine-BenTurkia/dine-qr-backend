# P1-05 Service buttons (guest side)

**Status:** done (pitch build).

## Built
- Bottom bar on the guest menu: Serveur, Addition (Espèces / Carte), WiFi, Sélection, Avis. Waiter and bill appear only when the restaurant has tables.
- `POST /public/menu/:slug/service { sessionId, type, tableToken | tableLabel }`; status `GET .../service/:id?sessionId=` and `POST .../service/:id/cancel`.
- Guest sees "Serveur prévenu", then "Un serveur arrive" once staff tap "J'arrive", with the elapsed time and a cancel button.
- Without a table token the guest picks the table number once (kept for the visit).
- WiFi sheet: network, password with copy button, and a WiFi QR (`WIFI:T:WPA;S:…;P:…;;`). Owner sets WiFi in Restaurant settings.

## Acceptance
- [x] Requests need a valid table token or a picked table number (e2e: 400 without)
- [x] Rate limits enforced on the server: 10 per minute per address, one active request per table and type every 2 minutes (e2e)
- [x] Events `service_requested` and `wifi_viewed` recorded
