# O-03 Ticket printing

**Status:** done, to be checked on a real thermal printer (owner to buy one, see QUESTIONS Q9).

## Built
- Three tickets, sized for **80 mm** or **58 mm** paper (per device setting on the caisse):
  - **Kitchen ticket**: big order number, table, time, quantities and dish names, notes; no prices.
  - **Customer receipt**: restaurant name, address, phone, matricule fiscal, ticket number, date,
    table, lines (grouped), subtotal, discount, total, payment method, cashier, footer message,
    "Ticket non fiscal".
  - **Daily closing (Z)**: totals by payment method, discounts, orders served/refused/cancelled,
    unpaid orders, best sellers.
- "Impression auto" (per device): the kitchen ticket prints when an order is accepted, the receipt
  when a table is paid. Manual reprint buttons everywhere.

## How to set up the printer (for the owner)
1. Plug a USB thermal printer (80 mm, ESC/POS, e.g. Xprinter XP-80) into the caisse PC or an
   Android/Windows tablet, install its driver and make it the **default printer**, paper 80 mm.
2. Open Chrome with kiosk printing so tickets print without a dialog:
   `chrome.exe --kiosk-printing https://menu.arishub.site/staff` (desktop shortcut).
3. In the caisse choose 80 mm or 58 mm, and keep "Impression auto" on.

Bluetooth printers on Android work through the printer vendor's print service app. A direct
ESC/POS bridge (no dialog on every device) is a later option.

## Acceptance
- [x] Tickets render at 58/80 mm (browser print preview)
- [ ] Checked on a real printer (Q9)
