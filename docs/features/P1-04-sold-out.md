# P1-04 Sold-out toggle ("Épuisé")

**Status:** done (pitch build).

## Built
- `Dish.soldOut`, `Dish.soldOutUntil`. `PATCH /dishes/:id { soldOut, soldOutMode }`: `until_tomorrow` (default) sets the reset to the next 05:00 Africa/Tunis; `manual` keeps it until reset.
- Menu editor: "Épuisé ?" one-tap button on each dish (desktop), and menu items "Épuisé jusqu'à demain", "Épuisé jusqu'à nouvel ordre", "De nouveau disponible" (phone and desktop).
- Guest menu: greyed dish with an "Épuisé" badge; the "+" button is hidden. Open menus refresh every 5 seconds while visible.

## Acceptance
- [x] Toggle reflects on the guest menu within 5 seconds (measured 4.9 s in the browser test)
- [x] Guest sees the item greyed with "Épuisé" — the "hide instead" setting is not built (UI_DEBT)
- [x] A sold-out item cannot be added to "ma sélection" (ordering comes in Phase 4)

Staff access: staff accounts arrive with P0-11; today the owner account toggles.
