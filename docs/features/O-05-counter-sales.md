# O-05 Counter sales

**Status:** done (2026-10-03).

## Built
- **Comptoir** tab: product grid by category (sold-out greyed), tap to add, quantities, optional
  table. "Envoyer en préparation" creates an accepted order (kitchen ticket prints); "Payé espèces"
  / "Payé carte" records and pays a takeaway sale at once and prints the receipt.
- Every sale is recorded with who typed it, which the stock and anti-waste features (S-01…S-04)
  will use.

## Acceptance
- [x] Counter order accepted at once with the cashier's name (e2e)
- [x] Takeaway sale paid in one step (browser test)
