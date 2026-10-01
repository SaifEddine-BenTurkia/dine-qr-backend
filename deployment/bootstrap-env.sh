#!/usr/bin/env bash
#
# Creates /opt/tableqr/.env.production with fresh random secrets. Run once on
# the VPS, then fill in the third-party keys it leaves blank.
#
set -Eeuo pipefail

env_file="${1:-/opt/tableqr/.env.production}"

if [[ -e "${env_file}" ]]; then
  echo "Refusing to overwrite ${env_file}" >&2
  exit 1
fi

umask 077
postgres_password="$(openssl rand -hex 32)"

cat > "${env_file}" <<EOF
NODE_ENV=production
PORT=3000

POSTGRES_DB=tableqr
POSTGRES_USER=tableqr
POSTGRES_PASSWORD=${postgres_password}
DATABASE_URL=postgresql://tableqr:${postgres_password}@postgres:5432/tableqr

JWT_SECRET=$(openssl rand -hex 48)
JWT_EXPIRES_IN=7d
SCAN_HASH_SALT=$(openssl rand -hex 32)

FRONTEND_URL=https://menu.arishub.site
CORS_ORIGINS=https://menu.arishub.site

RESEND_API_KEY=
RESEND_FROM_EMAIL=TableQR <no-reply@mail.arishub.site>

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_FOLDER=tableqr
CLOUDINARY_LIBRARY_FOLDER=tableqr-library

# Comma-separated admin accounts (confirm cash payments, get request emails).
ADMIN_EMAILS=
# WhatsApp in international format without "+", e.g. 21620123456.
PAYMENT_WHATSAPP=
PAYMENT_CONTACT_EMAIL=
PAYMENT_PHONE=

TRIAL_DAYS=30
PRICE_TND=35
PAYMENT_PLAN_MONTHS=1,3,6,12

OPENROUTER_API_KEYS=
OPENROUTER_MODEL=qwen/qwen3.8-27b:free,nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free,google/gemma-4-31b-it:free
EOF

chmod 600 "${env_file}"
echo "Created ${env_file}. Fill in the blank values, then deploy."
