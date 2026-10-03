# L-01, L-02, L-03 Loyalty card, Google Wallet, card designer

**Status:** done; Google Wallet waits for the owner's issuer account (QUESTIONS Q10). Until then the
web card does the same job.

## Built
- **Program** per restaurant (`LoyaltyProgram`): on/off, stamps needed (3–20), reward text,
  minimum ticket for a stamp, card title, colour, stamp icon, terms.
- **Guest:** "Obtenir ma carte" on the menu → first name, phone, consent tick → card page
  `/c/<code>` with the stamps, a QR code for the cashier, "Voir le menu", "Supprimer ma carte".
  The card refreshes by itself; the phone remembers it ("Ma carte 4 / 9" on the menu).
  One card per phone number; an existing card is never handed over from a number alone (the
  cashier finds it and shows its QR code).
- **Caisse:** in "À encaisser", "Carte de fidélité du client" → scan the QR (camera, Chrome on
  Android) or type the name or phone → paying adds one stamp, once per ticket, printed on the
  receipt. "Fidélité" tab: find a card, + 1 tampon (once every 5 minutes for staff), give the
  reward, open a card for a guest at the counter, show a card's QR again. Cashiers see only the end
  of the phone number.
- **Owner:** Fidélité page: stats (members, returning, stamps, rewards over 30 days), program, card
  designer with a live preview, members list (stamp, reward, delete).
- **Google Wallet** (`src/loyalty/wallet.service.ts`): signed "Add to Google Wallet" link (RS256
  JWT, typ `savetowallet`), the card design registered through the REST API so the link stays under
  Google's safe length, pass updated on every stamp. Official documentation is cited at the top of
  the file. Off until `GOOGLE_WALLET_ISSUER_ID` and `GOOGLE_WALLET_SERVICE_ACCOUNT` are set.

## Acceptance
- [x] e2e: program, join with consent, one card per phone, no phone number in public answers,
      search by name / phone / code / scanned address, stamp at payment once per ticket, minimum
      spend, reward once, counter-created card, guest deletes their card, Premium only
- [x] Unit: Wallet link signature and claims, design registration, pass update, token reuse, phone
      normalisation
- [x] Browser: join from the menu, card page, payment with a stamp, reward, designer saved
- [ ] Pass saved in a real Google Wallet (Q10)

## Not built
- Apple Wallet (needs an Apple developer account and signing certificates).
- The official "Add to Google Wallet" button artwork: add it when the issuer account exists
  (Google's brand rules); the button is a plain black one until then.
