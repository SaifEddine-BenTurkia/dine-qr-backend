# P1-09 Owner analytics and ROI dashboard (+ P0-06 events, minimal)

**Status:** done for counts (pitch build). Daily aggregate tables (P0-06) not built yet.

## Built
- `Event` table (type, restaurant, table, session, item, props, time) and a browser tracker that batches events every 3 seconds and on page hide (keepalive), without personal data.
- Guest events: menu_opened (with locale), language_changed, category_viewed, item_viewed, selection_item_added, selection_shown, wifi_viewed, google_review_clicked; server events: service_requested/acknowledged/resolved/cancelled, feedback_submitted.
- `GET /stats/overview?days=7|30`: visits, item views, calls handled, average response time, feedback count and average, Google clicks, menu updates, language mix, day×hour heatmap (Tunis time), most viewed items, "souvent vus, rarement choisis".
- Home: "Ce mois-ci avec TableQR" (counts only, each tile with its definition), heatmap, languages, item lists; 7/30-day switch.

## Acceptance
- [ ] Under 2 seconds on 4G using daily aggregates: queries run on raw events for now (fine at pilot scale; aggregates in P0-06)
- [x] Works on a phone first; desktop is the wider version
- [x] Every number has its definition (info icon)
