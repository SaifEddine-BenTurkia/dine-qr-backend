# TableQR roadmap (owner decision, 2026-10-03)

This replaces the order of PLAN.md from Phase 2 on. PLAN.md stays the reference for engineering
rules (sandbox, tests, i18n, security); feature specs below follow its format.

## What changed and why

- **Kept and moved first:** table ordering, a cashier screen ("caisse") that accepts orders and
  prints tickets, like the Glovo/Uber Eats restaurant tablet.
- **Then:** loyalty card in Google Wallet, designed in the dashboard.
- **Then:** stock and anti-waste: quantities, expiry dates, what sells and what is left, price and
  promo suggestions.
- **Then:** three plans (Standard, Premium, Business).
- **Dropped:** online payments (Flouci, Konnect, split bill online), Google reviews hub and AI
  replies, AI advisor (old P2-01…P2-06, P4-04, P4-05). Payment stays at the counter, in cash or by
  card on the restaurant's own terminal.
- **Parked:** WhatsApp (Phase 3), hotels, reservations, cash-register integration.

## The real use case (a Tunisian café or restaurant)

1. The guest sits at table 7 and scans the table's QR code. The menu opens in their language.
2. They add dishes to the cart, with notes ("sans harissa"), and tap **Envoyer la commande**.
   Ordering needs the table's QR (a token), so nobody can order from outside.
3. At the counter, a tablet or PC shows the **caisse** screen. It chimes, and the order card shows
   table 7, items, notes and total. The cashier taps **Accepter** (or **Refuser**, with a reason
   such as "plat épuisé").
4. Accepting prints a **kitchen ticket** on the thermal printer (80 mm or 58 mm). The guest's phone
   shows "Commande acceptée", then "Prête" and "Servie".
5. The guest can order again (dessert, coffee). The table's orders add up to one bill.
6. **Addition:** the guest taps "Addition", or the cashier opens the table. The cashier prints the
   **customer receipt** and marks it paid (cash or card). If the guest has a loyalty card, the
   cashier scans it and the stamp lands in their Google Wallet.
7. Counter sales (takeaway coffee) are typed on the same caisse screen. Every sale is recorded,
   which is what makes the stock and anti-waste features possible.

## Build order

| ID | Feature | Notes |
|---|---|---|
| P0-04 | Money in millimes | Prerequisite: order totals must be exact integers |
| P0-11 | Staff accounts and roles | Cashier and waiter logins with a PIN on a shared device; the caisse never uses the owner's password |
| O-01 | Cart and table ordering (guest) | Cart from "Ma sélection", notes, send; live order status |
| O-02 | Caisse screen | Live new orders with a chime, accept/refuse, statuses, open tables |
| O-03 | Ticket printing | Kitchen ticket and customer receipt, 80/58 mm, browser print; auto-print with Chrome kiosk printing; ESC/POS bridge later |
| O-04 | Bill and payment at the counter | Bill per table, cash/card, discount, close table, daily Z report (totals by payment method) |
| O-05 | Counter sales | Quick product grid on the caisse for takeaway and counter orders |
| P0-03 | Plans and entitlements | The three plans below, a 14-day trial with everything unlocked |
| L-01 | Loyalty program | Stamps (e.g. 9 coffees = 1 free), enrolment by QR (name + phone), stamp at payment |
| L-02 | Google Wallet card | Loyalty pass that updates when stamps change; sandbox (demo issuer) until Google approves |
| L-03 | Card designer | Logo, colours, banner, reward text, live preview in the dashboard |
| S-01 | Stock per dish | Quantity available today or per batch, auto sold-out at 0 |
| S-02 | Batches and expiry | DLC/expiry dates, "expires today" list |
| S-03 | Sales vs stock | Best sellers, slow sellers, what is left, by hour |
| S-04 | Anti-waste suggestions | "12 bricks left, expiring tonight, sells 3/h after 20h: -20% from 21h"; one tap applies a promo price on the menu |
| P1-10, P1-11 | Print studio, weekly report | After the above |
| P7 | UI/UX overhaul | Last, as planned |

## Plans (prices are a proposal for the owner to confirm)

| | Standard | Premium | Business |
|---|---|---|---|
| Price / month | 49 DT | 99 DT | 179 DT |
| Price / year | 490 DT | 990 DT | 1 790 DT |
| Digital menu, 5 styles, own colours | ✓ | ✓ | ✓ |
| AI menu import (photo or PDF) | ✓ | ✓ | ✓ |
| QR codes per table, sold-out in one tap | ✓ | ✓ | ✓ |
| Languages | French + Arabic | + English, Italian, German (AI translation) | same |
| Guest feedback, basic statistics | ✓ | ✓ | ✓ |
| Call the waiter, bill request, live staff board | | ✓ | ✓ |
| Table ordering + caisse screen + ticket printing | | ✓ | ✓ |
| Loyalty card in Google Wallet | | ✓ | ✓ |
| Full "what TableQR brings you" dashboard | | ✓ | ✓ |
| Staff accounts | 1 owner | up to 5 | unlimited |
| Counter sales (POS-lite), daily Z report | | | ✓ |
| Stock, expiry, anti-waste suggestions, promo pricing | | | ✓ |
| Several outlets (café + terrace bar, hotel outlets) | | | up to 3 |
| Weekly report, priority onboarding | | | ✓ |

Why this split: Standard replaces the paper menu (the entry price). Premium is the "service" plan,
which saves staff time at every table. Business is the "management" plan, which saves money on
waste and stock. Most cafés start with Standard, and restaurants with terraces or tourists choose
Premium.

## Needs from the owner

- **Ticket printer:** one 80 mm USB or Bluetooth thermal printer for testing (about 150–250 DT).
- **Google Wallet:** a Google Pay & Wallet Console issuer account (free) and a Google Cloud service
  account. Claude builds against a fake until then, and the demo mode works for test users.
- **Prices:** confirm the three prices.
