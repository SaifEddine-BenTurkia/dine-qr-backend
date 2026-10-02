# P1-01 Tables and per-table QR codes

**Status:** done (pitch build, 2026-10-03). Branch `feat/P1-guest-service` in both repos.

## Built
- Model `DiningTable` (label, zone, random 16-byte token, position, active). Labels unique per restaurant.
- API `GET/POST /tables`, `POST /tables/bulk` (labels continue after the highest number with the same prefix), `PATCH /tables/:id`, `POST /tables/:id/rotate-token`, `DELETE /tables/:id`.
- Guest URL `https://<menu>/m/<slug>?t=<token>`; `GET /public/menu/:slug?t=` returns `table` (label, zone) and the list of labels (never tokens) for the picker.
- Screen `/dashboard/tables`: bulk add (5/10/20/30 or any number, zone, prefix), tables grouped by zone, per-table QR (PNG 1200 px and SVG download), rename, deactivate, new QR (confirm), delete, "Imprimer toutes" (print sheet with French and Arabic call to action, via the browser's print to PDF).

## Acceptance
- [x] Bulk create with automatic labels (T1 to T20) and editable zones (e2e)
- [x] QR download per table (PNG, SVG) and for all tables (print sheet → PDF)
- [x] Rotating a token invalidates the old QR for that table only (e2e)
- [x] Existing printed QR codes still open the menu (no `?t`: table picker)

## Not done / follow-ups
- Entitlement `tables.per_table_qr` not enforced: plans and entitlements (P0-03) are not built yet.
- PDF is produced by the browser's print dialog, not generated server-side (P1-10 print studio).
