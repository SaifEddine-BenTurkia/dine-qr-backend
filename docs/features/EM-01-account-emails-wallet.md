# EM-01 Account emails for everyone, Google Wallet ready to switch on

**Status:** built (2026-10-03). Owner request: "I want email confirmation and password reset email;
the loyalty card needs to be saved in Google Wallet." Delivery to real inboxes depends on the
Resend sending domain (Q8); Google Wallet on the issuer account (Q10).

## Account emails
- **Confirmation and password reset go to every account**, before launch too: they are sent to the
  address the person typed, at their request. Every other email (payment notices, future messages)
  stays on the prelaunch allowlist (A1). `ACCOUNT_EMAILS=allowlist` puts account emails back on it.
- Access stays open (UX-03): the dashboard works at once and shows "Confirmez votre adresse ·
  Renvoyer le lien" until the link is clicked. `REQUIRE_EMAIL_VERIFICATION=true` makes the
  confirmation mandatory.
- The link brings a signed-in owner back to the dashboard; otherwise to the login page.
- New email layout in the app's style, with a plain text version (fewer spam scores).
- **Console → Système**: sender address, account email mode, and "Envoyer un email de test" to any
  address, showing what Resend answered (for example a sender domain that is not verified).

## Google Wallet (L-02)
- The service (signed "Add to Google Wallet" link, design registered through the API, pass updated
  at each stamp) was built and tested against fakes in L-02; checked again against Google's current
  documentation on 2026-10-03.
- The guest's card page now uses **Google's official button** in the guest's language (fr, ar,
  en, de, it, ru), unmodified, 50 px high with clear space, as the brand guidelines require
  (`public/wallet/`, from Google's add-to-wallet-svg.zip).
- **Console → Système → "Tester Google Wallet"**: signs in with the service account, registers a
  sample design and gives a test pass to save on your phone, or says exactly what Google refused.

## Acceptance
- [x] Unit: account emails pass the prelaunch allowlist, notices do not; `ACCOUNT_EMAILS=allowlist`;
      email layout (link in button and text, no tags in text); test send without a key
- [x] Unit: Wallet test pass (not configured, success, design refused with Google's message, key
      refused)
- [x] e2e: system shows email and Wallet state; the two checks are admin-only and answer plainly;
      tests never call Resend or Google (keys blanked in `test/e2e-env.ts`)
- [x] Playwright: official Wallet button on the card page (12 tests)
- [x] Real browser: console checks with no keys locally
- [ ] Real inbox: a confirmation email received at an address that is not yours (after Q8)
- [ ] A pass saved in Google Wallet (after Q10)
