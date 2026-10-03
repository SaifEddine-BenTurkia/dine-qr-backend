# P0-04 Money in millimes

**Status:** done (2026-10-03).

## Built
- `Dish.priceMillimes`, `PaymentRequest.amountMillimes` and `amountReceivedMillimes` are integers
  (1 DT = 1000 millimes). Migration `money_millimes` converts the old `Decimal(10,3)` columns
  exactly (`ROUND(x * 1000)`; a 3-decimal value has no remainder) and drops them.
- `src/common/money.ts` (API) and `src/lib/money.ts` (frontend): parse "12", "12,500", "12.5",
  "12D500", "12 DT", "1 200,750 DT"; refuse negatives and more than 3 decimals; sum, percent
  (half up), format "4,500 DT". The API still exchanges dinars as numbers (`price`), plus
  `priceMillimes` on dishes; conversion happens only in these helpers.
- The dish form accepts every Tunisian way of writing a price ("4D500", "4,5", "4 DT").

## Before/after report
- Local demo data (39 dishes): Café direct 2.5 → 2500, Capucin 2.8 → 2800, Eau 1.8 → 1800,
  Dorade 42 → 42000; total 620 100 millimes; the guest menu shows the same prices.
- Production: 0 dishes and 0 payment requests at the time (data reset on 2026-10-03).

## Acceptance
- [x] Migration converts the test dishes exactly (report above)
- [x] No floating-point number is used for stored money (unit tests: 0.1 + 0.2 = 300 millimes, 1000 × 2,800)
- [x] Guest menu shows the same prices as before
