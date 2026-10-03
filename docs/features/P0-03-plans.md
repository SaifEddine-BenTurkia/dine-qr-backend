# P0-03 Plans, entitlements

**Status:** done (2026-10-03).

## Built
- Three packs in `src/billing/plan-catalog.ts`: **Standard** 49 DT, **Premium** 99 DT, **Business**
  179 DT per month; a year costs 10 months. Prices come from `PRICE_TND`, `PRICE_PREMIUM_TND`,
  `PRICE_BUSINESS_TND` (defaults above); durations on sale from `PAYMENT_PLANS`.
- Entitlements per pack, always checked on the server (`EntitlementsService`):

  | | Standard | Premium | Business |
  |---|---|---|---|
  | Menu languages | French, Arabic | all | all |
  | Waiter and bill calls | | yes | yes |
  | Table ordering, caisse, tickets | | yes | yes |
  | Loyalty card | | yes | yes |
  | Staff members | 0 | 5 | unlimited |
  | Counter sales, daily closing | | | yes |
  | Stock, expiry, anti-waste, promo prices | | | yes |

- **Trial = everything unlocked** (reverse trial). After a payment the paid pack applies at once
  and the time is added after what the owner still has.
- A refused feature answers `403 { code: "PLAN_REQUIRED", requiredPlan }`; the apps show an upgrade
  panel. The guest menu only offers what the pack includes (`features` in the public menu).
- `Subscription.plan`, `PaymentRequest.plan`. Owners request a payment per pack and duration;
  admins record a payment per pack, or set the pack without a payment
  (`POST /admin/accounts/:id/plan`).
- Frontend: plan cards on Abonnement and on the landing page (one source: `src/lib/plans.tsx`),
  `PlanGate` / `UpgradePanel`, locks in the navigation, pack shown in the admin console.

## Acceptance
- [x] e2e: trial unlocks all; Premium opens ordering and 5 staff but not counter sales or closing;
      Standard closes calls, ordering, languages beyond fr/ar, staff login; admin sets a pack
- [x] Browser: Standard owner sees the upgrade panel and the three packs

## Not built
- Several outlets per account (announced for Business in ROADMAP): needs the Account/Membership
  model; it is not sold in the pack cards.
