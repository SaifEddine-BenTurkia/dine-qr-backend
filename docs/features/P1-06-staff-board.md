# P1-06 Staff live board

**Status:** done (pitch build), web push not built.

## Built
- `/dashboard/service`: open requests oldest first (table, zone, type, waiting time), amber after 2 minutes, red after 5. "J'arrive" then "Fait".
- Live updates by Server-Sent Events (`GET /service-requests/stream`, token in the query because EventSource cannot send headers, heartbeat every 25 s, `X-Accel-Buffering: no` so nginx does not buffer), plus 5-second polling as fallback.
- Sound (Web Audio chime, enabled with one tap as browsers require) and vibration on new requests; low-rating feedback alerts (3/5 or less) appear on the board.
- Daily stats: `GET /service-requests/stats?days=7` (requests and average response time).

## Acceptance
- [x] New request appears within 2 seconds (measured 6 ms locally)
- [ ] Works in French and Arabic (RTL): the staff board is French only until P0-05 is completed for the dashboard
- [ ] Optional web push: not built
- [x] Average response time per day; per staff member needs staff accounts (P0-11)

Production note: the stream goes through Cloudflare and nginx; verify after deploy that events arrive live (the polling fallback keeps it working either way).
