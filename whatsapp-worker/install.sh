#!/usr/bin/env bash
# Installs the CRM WhatsApp worker as a service on Ubuntu/Debian.
# Run from this folder:  sudo bash install.sh
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
[ "$(id -u)" = 0 ] || { echo "Please run with sudo: sudo bash install.sh"; exit 1; }

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  echo "Installing Node.js 20..."
  apt-get update -y && apt-get install -y ca-certificates curl gnupg git
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
command -v git >/dev/null || apt-get install -y git

if [ ! -f "$DIR/.env" ]; then
  cp "$DIR/.env.example" "$DIR/.env"
  read -rp "Paste the Supabase secret (service role) key: " KEY
  sed -i "s|^SUPABASE_SERVICE_ROLE_KEY=.*|SUPABASE_SERVICE_ROLE_KEY=$KEY|" "$DIR/.env"
fi
chmod 600 "$DIR/.env"

cd "$DIR" && npm install --omit=dev --no-audit --no-fund

cat >/etc/systemd/system/crm-whatsapp.service <<UNIT
[Unit]
Description=CRM WhatsApp worker
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=$DIR
ExecStart=$(command -v node) $DIR/worker.mjs
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now crm-whatsapp
sleep 3
systemctl --no-pager status crm-whatsapp | head -5
echo
echo "Done. Open the CRM → Settings → WhatsApp and scan the QR code from the club phone."
echo "Logs:    journalctl -u crm-whatsapp -f"
echo "Restart: sudo systemctl restart crm-whatsapp"
