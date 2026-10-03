# ADM-01 Platform admin console

**Status:** done (2026-10-03). Owner request, outside the plan's numbering: the platform owner's
tools were a section of the restaurant dashboard; they now live in their own console at `/admin`.

## Built
- Frontend: `/admin` is its own layout (dark sidebar, "Admin" badge), outside the restaurant
  dashboard. Pages: Vue d'ensemble, Activité, Restaurants (was "Comptes"), Paiements, Système.
  Non-admins are sent to `/dashboard`; admins land on `/admin` after login. The restaurant
  dashboard keeps one "Console admin" link for admins, and the console has "Mon restaurant".
- `GET /admin/activity?days=1|7|30|90`: across all restaurants, visits (guest sessions that opened
  the menu), service calls and average response time, feedback and average rating, low ratings,
  Google clicks, calls open right now, day-by-day series (Tunis time), feature adoption (tables,
  languages, WiFi, Google link) and a per-restaurant table with last activity. Last 20 feedback
  entries without guest contact details.
- `GET /admin/system`: mode (development / prelaunch / production), uptime, memory, database
  latency, live staff screens connected, whether AI, email and image services are configured
  (yes/no, never a value), record counts, last guest event.

## Acceptance
- [x] Only accounts in `ADMIN_EMAILS` can call the endpoints (e2e: 403 for an owner)
- [x] Guest contact details never reach the admin view (e2e)
- [x] No secret value in the system response (e2e)
- [x] Works on a phone and a desktop, no horizontal scroll (browser test)
