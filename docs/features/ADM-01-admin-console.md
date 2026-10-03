# ADM-01 Platform admin console

**Status:** done (2026-10-03). Owner request, outside the plan's numbering: the platform owner's
tools were a section of the restaurant dashboard; they now live in their own console at `/admin`.

## Built
- Frontend: `/admin` is its own layout (dark sidebar, "Admin" badge), outside the restaurant
  dashboard. Pages: Vue d'ensemble, Activité, Restaurants (was "Comptes"), Paiements, Système.
  Non-admins are sent to `/dashboard`; admins land on `/admin` after login.
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

## Account roles (owner request, same day)

Two roles that never share screens or endpoints:
- **admin** (emails in `ADMIN_EMAILS`): only the console and `/auth/me`. Every restaurant endpoint
  answers 403 "Compte administrateur : utilisez la console /admin"; `/dashboard` redirects to `/admin`.
- **restaurant**: only the restaurant dashboard. `/admin` redirects to `/dashboard`; admin endpoints 403.

Enforced in `JwtAuthGuard`: routes are for restaurant accounts unless marked `@ForRole('admin')`
(admin controllers) or `@ForRole('any')` (`/auth/me`). `/auth/me` returns `role`.
The role still comes from `ADMIN_EMAILS`, not a database column: there is no way to become admin
from the app. Staff roles inside a restaurant (manager, waiter) come with P0-11.

**Console → Restaurants → "Nouveau compte restaurant"** (`POST /admin/accounts`): creates a verified
restaurant account with a temporary password, for owners you equip yourself. Option "Lui confier
un restaurant existant" moves a restaurant that was set up under an admin account (menu, tables,
subscription) to the new account; restaurants of other owners cannot be taken.

- [x] e2e: admin gets 403 on tables, service board and restaurant creation; owner gets 403 on the console
- [x] e2e: account creation, takeover with subscription, refusal for another owner's restaurant and for an admin email
- [x] Browser: admin lands on /admin and is sent back from /dashboard; owner lands on /dashboard and is sent back from /admin, no admin entry in the navigation (desktop and phone)
