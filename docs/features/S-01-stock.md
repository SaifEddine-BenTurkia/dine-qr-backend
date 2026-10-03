# S-01, S-02, S-03, S-04 Stock, expiry, sales, anti-waste

**Status:** done (2026-10-03). Business pack.

## Built
- **Stock per dish** (`Dish.trackStock`, `stockQty`): adding stock starts the tracking. Every
  order (table or counter) takes from the stock when it is created; a refused or cancelled order
  gives it back; at 0 the dish shows "Épuisé" on the menu and cannot be ordered. "Plus que 3" shows
  on the menu under 6.
- **Batches with a sell-by time** (`StockBatch`): "Ce soir", "Demain soir", a date, or none. Sales
  take from the batch that expires first. A batch past its time leaves the stock by itself and
  counts as waste.
- **Movements** (`StockMovement`): add, sale, return, waste (with a reason), inventory count. The
  sum of movements always equals the stock (tested).
- **Sales:** per dish: sold today, in 7 days, per day, days of stock left; best and least sold.
- **Suggestions** (`src/stock/suggestions.ts`, plain rules, no AI):
  1. Promo: stock that expires by tomorrow night and will not sell at the usual pace (from 14 days
     of sales and the hours left) → −20 %, −30 % or −50 % until the sell-by time.
  2. Restock: stock that will not last until closing.
  3. Slow seller: no sale in 14 days once there is enough history.
- **Promo price** (`Dish.promoPriceMillimes`, `promoEndsAt`): rounded down to 100 millimes, shown
  on the menu with the old price struck, and charged on orders. One tap from a suggestion, or the
  "Promo" button on any stocked dish.
- Owner screen `/dashboard/stock`; managers can use the same endpoints.

## Acceptance
- [x] e2e: tracking, holding and returning stock, "Il ne reste que 3", count, waste, sold out at 0,
      expiry sweep with waste value, suggestion → promo → order at the promo price, Business only
- [x] Unit: the three suggestion rules, promo rounding
- [x] Browser: suggestion applied, promo visible on the guest's phone, stock added
