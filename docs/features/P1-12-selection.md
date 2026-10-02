# P1-12 "Ma sélection" (guest list)

**Status:** done (pitch build).

## Built
- "+ Sélection" on every available dish, quantity stepper once added, notes per line, running total.
- "Montrer au serveur": full-screen view with large text, the table number, French dish names (guest language underneath) and the total.
- Kept in sessionStorage per restaurant: survives a reload during the visit.

## Acceptance
- [x] Selection survives a page reload on the same phone during the visit
- [x] Event `selection_item_added` recorded per item
