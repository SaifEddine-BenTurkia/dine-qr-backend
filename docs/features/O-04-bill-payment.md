# O-04 Bill and payment at the counter

**Status:** done (2026-10-03).

## Built
- **À encaisser**: one card per table with its accepted, unpaid orders and total.
- Payment sheet: grouped lines, optional discount (typed in dinars: "0,500", "1D500"), **Espèces**
  or **Carte** (card on the restaurant's own terminal; TableQR only records the method). Paying
  creates a `Bill` (number of the day, subtotal, discount, total, method, cashier), marks the orders
  served and prints the receipt.
- A paid order cannot be paid again (e2e: 409).
- **Clôture**: today's totals (cash, card, discounts, tickets), unpaid orders, best sellers; prints
  the Z ticket.

## Acceptance
- [x] Bill a table with a discount, receipt data correct (e2e)
- [x] Z report totals by payment method (e2e and browser)
