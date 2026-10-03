# ADM-02 Admin console security

**Status:** done (2026-10-03). Owner request: the console must not be reachable by anyone else.

## Built
- **Hidden:** every `/admin/*` API route and `/auth/admin-mfa/*` answers **404** to anyone who is
  not an admin, signed in or not (no 401/403 that would confirm the console exists). In the browser,
  `/admin` shows the normal "Page introuvable" page to everyone except a signed-in admin.
- **Second factor (TOTP):** after the password, an admin must enter a 6-digit code from an
  authenticator app (RFC 6238, works with Google/Microsoft Authenticator, 1Password). The first
  time, the console shows a QR code to scan. Without the code, admin routes answer 403
  `MFA_REQUIRED`. A code works once (`lastTotpStep`), ±30 s drift accepted.
- **Short sessions:** an admin's password-only session lasts 15 minutes (enough to type the code);
  the session after the code lasts 8 hours, then the code is asked again. Restaurant sessions are
  unchanged.
- The TOTP secret is stored encrypted (AES-256-GCM, key derived from `JWT_SECRET`). Rotating
  `JWT_SECRET` therefore resets admin 2FA: the admin sets it up again.
- Rate limit 5/minute on setup and verify; refused codes are logged (user id only).
- Admin role still comes only from `ADMIN_EMAILS` on the server.

## Lost phone / reset
On the server (owner, SSH):
```
sudo docker exec -i tableqr-postgres-1 sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  -c "UPDATE \"User\" SET \"totpSecret\"=NULL,\"totpEnabledAt\"=NULL,\"lastTotpStep\"=NULL WHERE email='<admin email>';"
```
Next login shows the QR code again.

## Acceptance
- [x] e2e: owner and anonymous get 404 on admin routes; admin without code gets 403 MFA_REQUIRED;
      wrong code refused; right code opens an 8 h session; same code refused twice; setup refused once on
- [x] Unit: RFC 6238 vectors, drift window, encrypted secret
- [x] Browser (mocked and real local API): 404 when signed out or as a restaurant, QR setup, code gate

## Possible next steps (not built)
- Cloudflare Access (Zero Trust, free up to 50 users) in front of `/admin` and `/admin/*` API paths
  for an extra email-PIN wall at the edge; needs the owner's Cloudflare account.
- Audit log of admin actions (P0-09).
