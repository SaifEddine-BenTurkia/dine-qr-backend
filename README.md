# dine-qr-backend

NestJS API for TableQR: restaurant owners build a menu, diners open it by
scanning a QR code. Frontend: `dine-qr-style` (Cloudflare Pages).

| | |
|---|---|
| Stack | NestJS 11, Prisma 6, PostgreSQL 17, Node 22 |
| Integrations | Cloudinary (images), Resend (email), OpenRouter (AI menu import) |
| Payments | Cash, Tunisia only: owners queue a payment request, an admin confirms it |
| Production | `https://menu-api.arishub.site` on the shared ArisHub VPS |

## Local development

```bash
cp .env.example .env
docker compose up -d          # Postgres on localhost:5434
npm ci
npx prisma migrate dev        # apply migrations, generate the client
npm run start:dev             # http://localhost:3001
```

Without a Resend key, verification and reset links are printed in the API logs.
Cloudinary and OpenRouter endpoints answer 503 until their keys are set.
Put your own email in `ADMIN_EMAILS` to see the payment queue at `/admin/payments`.

| Command | |
|---|---|
| `npm test` | unit tests |
| `npm run test:e2e` | end-to-end tests against the database in `DATABASE_URL` |
| `npm run lint` / `npm run typecheck` | static checks |
| `npx prisma migrate dev --name <change>` | create a migration after editing `prisma/schema.prisma` |

## API

Errors are always `{ "statusCode": number, "message": string }`.
🔒 = `Authorization: Bearer <token>` and a verified email. 👑 = the account's email is in `ADMIN_EMAILS`.

| Method | Path | |
|---|---|---|
| POST | `/auth/register` | `{ email, password, fullName, phone?, phoneCountryCode?, country?, address?, taxId? }` → `{ token, user }`, sends a verification email |
| POST | `/auth/login` | `{ email, password }` → `{ token, user }` |
| GET | `/auth/me` | token required, email may be unverified; includes `isAdmin` |
| GET | `/auth/verify-email?token=` | single use, 24 h |
| POST | `/auth/resend-verification` | `{ email }` |
| POST | `/auth/forgot-password` | `{ email }`, same answer whether or not the account exists |
| POST | `/auth/reset-password` | `{ token, password }`, signs out every session |
| GET/POST/PATCH | `/restaurant` 🔒 | GET returns `null` before setup |
| POST | `/restaurant/upload-logo`, `/restaurant/upload-image` 🔒 | multipart `file`, ≤ 5 MB → `{ url }` |
| GET/POST | `/categories` 🔒 | |
| PATCH/DELETE | `/categories/:id` 🔒 | delete removes the category's dishes too |
| POST | `/categories/reorder` 🔒 | `{ ids }` |
| GET | `/dishes?categoryId=` 🔒 | |
| POST/PATCH/DELETE | `/dishes`, `/dishes/:id` 🔒 | |
| POST | `/dishes/reorder` 🔒 | `{ ids }` |
| POST | `/dishes/:id/image` 🔒 | multipart `file` → `{ imageUrl }` |
| GET | `/library/folders`, `/library/images?folder=` 🔒 | shared stock photos from Cloudinary |
| POST | `/ai/menu-import` 🔒 | multipart `file` (menu photo) → `{ dishes }`, 10 per hour |
| GET | `/subscription` 🔒 | `{ status, trialEndsAt, currentPeriodEnd, pricePerMonth, currency, plans, pendingRequest, paymentContact }` |
| POST | `/subscription/start-trial` 🔒 | once per account |
| GET | `/subscription/payment-requests` 🔒 | the owner's payment history |
| POST | `/subscription/payment-requests` 🔒 | `{ months, contactMethod: WHATSAPP\|EMAIL\|PHONE, note? }`; one open request at a time; emails the admins |
| POST | `/subscription/payment-requests/:id/cancel` 🔒 | withdraw an open request |
| GET | `/admin/payment-requests?status=PENDING` 🔒👑 | the queue, with owner contact and restaurant |
| POST | `/admin/payment-requests/:id/mark-paid` 🔒👑 | `{ amountReceived?, adminNote? }`; extends the subscription |
| POST | `/admin/payment-requests/:id/reject` 🔒👑 | `{ adminNote? }` |
| GET | `/stats/scans?days=7` 🔒 | `[{ date, count }]`, days without scans included |
| GET | `/restaurants/feedback` 🔒 | |
| GET | `/public/menu/:slug` | 402 unless the subscription is trialing or active; unavailable dishes hidden |
| POST | `/public/menu/:slug/scan` | counted once per visitor per 30 min |
| POST | `/public/menu/:slug/feedback` | `{ rating: 1-5, comment? }` |
| GET | `/health/live`, `/health/ready` | |

### Payments (cash)

1. The owner picks a duration on the billing page (`PAYMENT_PLAN_MONTHS` ×
   `PRICE_TND`) and sends a request. It gets a reference like `TQ-7F3K2A`, and
   the admins receive an email.
2. The owner contacts you on WhatsApp, by email or by phone (`PAYMENT_*`
   variables; the WhatsApp button pre-fills the reference), and you collect the cash.
3. In `/admin/payments`, you click **Marquer payé**. The subscription is extended
   by the months paid, counted from the end of any remaining trial or paid
   period, and the owner gets a confirmation email.

When a paid period ends, the status becomes `past_due` and the public menu
answers 402 until the next payment. Nothing has to run on a schedule for this.

## Production

### How a deploy works

`.github/workflows/ci-cd.yml` runs on every push to `main`:

1. **verify**: Prettier, ESLint, TypeScript, unit tests, migrations applied to
   a fresh Postgres and checked against the schema, end-to-end tests.
2. **image**: builds the `production` (API) and `migration` targets and pushes
   them to GHCR, tagged with the commit SHA.
3. **deploy** (GitHub environment `production`): copies the deploy files to
   `/opt/tableqr` over SSH and runs `deploy.sh`. The script dumps the database,
   runs migrations, swaps the API container, and waits for `/health/ready`. If
   the new version never becomes ready, it restarts the previous image and the
   run fails. A final check calls the API through Cloudflare.

Pull requests run steps 1 and 2 only (the image is built, not pushed).

**Rolling back**: re-run the deploy job of an earlier successful run, or on the VPS:
```bash
cd /opt/tableqr && API_IMAGE=ghcr.io/<owner>/dine-qr-backend:<sha> \
  MIGRATION_IMAGE=ghcr.io/<owner>/dine-qr-backend-migrate:<sha> ./deploy.sh
```
Migrations are never undone automatically, so keep them backwards compatible:
add a column in one release and drop the old one in a later release.

### Layout on the VPS

```
/opt/tableqr/
  compose.production.yml   uploaded by CI
  deploy.sh, backup.sh     uploaded by CI
  .env.production          created once by bootstrap-env.sh (chmod 600)
  .deployed-images         image tags currently running
  .docker/                 registry login for this project only
  backups/                 pre-deploy and nightly pg_dump files (kept 14 days)
```

The stack runs as Compose project `tableqr` next to ArisHub, isolated from it.
The API listens on `127.0.0.1:3100` (ArisHub uses 3000), Postgres is not
published to the host, and each container has a 512 MB memory limit.

### One-time setup

Run these on the VPS as the deploy user ArisHub already uses (a member of the `docker` group).

**1. DNS.** In Cloudflare, add `menu-api` → the VPS IP as an **A record, proxied**.
The firewall already accepts 80/443 from Cloudflare only (ArisHub's
`restrict-origin-to-cloudflare.sh`), and that covers this host name too.

**2. Directory and secrets.**
```bash
sudo install -d -o "$USER" -g "$USER" -m 750 /opt/tableqr
# copy deployment/bootstrap-env.sh to the server, then:
bash bootstrap-env.sh /opt/tableqr/.env.production
nano /opt/tableqr/.env.production     # fill in the blank third-party keys
```

**3. nginx.** Copy the two files from `deployment/nginx/` to the server, then:
```bash
sudo cp tableqr-proxy.conf /etc/nginx/snippets/tableqr-proxy.conf
sudo cp menu-api.arishub.site.conf /etc/nginx/sites-available/menu-api.arishub.site
sudo ln -s /etc/nginx/sites-available/menu-api.arishub.site /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```
Then add HTTPS the same way `api.arishub.site` has it (Let's Encrypt, renewed
by the existing certbot timer). The `menu-api` DNS record must exist first:
`sudo certbot --nginx -d menu-api.arishub.site --redirect`.

**4. Deploy key.** On your own machine:
```bash
ssh-keygen -t ed25519 -f tableqr_deploy -C "github-actions dine-qr-backend" -N ""
ssh-copy-id -i tableqr_deploy.pub <user>@<vps-ip>
ssh-keyscan -t ed25519 <vps-ip> > known_hosts.txt
```
Before trusting `known_hosts.txt`, compare fingerprints:
`ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` on the VPS must print the
same value as `ssh-keygen -lf known_hosts.txt` locally.

**5. GitHub.** In Settings → Environments → `production`, add these secrets:

| Secret | Value |
|---|---|
| `VPS_HOST` | server IP (not the Cloudflare-proxied name) |
| `VPS_USER` | deploy user |
| `VPS_SSH_KEY` | contents of `tableqr_deploy` (the private key) |
| `VPS_KNOWN_HOSTS` | contents of `known_hosts.txt` |
| `VPS_PORT` | only if SSH is not on port 22 |

You can also add yourself as a required reviewer on the environment, so each
production deploy waits for your approval.

**6. Nightly backups.**
```bash
( crontab -l 2>/dev/null; echo '30 2 * * * /opt/tableqr/backup.sh >> /opt/tableqr/backups/cron.log 2>&1' ) | crontab -
```
Dumps stay on the VPS disk. Copy them somewhere else as well (provider
snapshots, or rclone to object storage).

**7. Third-party accounts.**
- **Payments:** set `ADMIN_EMAILS` to your account's email (register on the
  site first) and fill in `PAYMENT_WHATSAPP` (e.g. `21620123456`, no `+`),
  `PAYMENT_CONTACT_EMAIL` and `PAYMENT_PHONE`.
- **Cloudinary:** create `tableqr-library/<Category>` folders (for example
  `Pizzas`, `Boissons`) holding stock photos. They appear in the image library
  picker.
- **Resend:** `mail.arishub.site` is already verified for ArisHub, and the
  default sender uses it.

After that, a push to `main` runs the whole pipeline.

### Operating

```bash
cd /opt/tableqr
alias tq='docker compose --env-file .env.production -f compose.production.yml'
tq ps
tq logs -f api
tq exec postgres psql -U tableqr tableqr
# restore a dump:
tq exec -T postgres pg_restore -U tableqr -d tableqr --clean --if-exists < backups/<file>.dump
```
