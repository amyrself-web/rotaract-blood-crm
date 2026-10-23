# CRM WhatsApp worker

Sends the CRM's WhatsApp messages from the club's own number. The CRM puts messages in a queue; this small program, running on your server, sends them one by one.

## Run it on a laptop or an old Android phone (no server needed)

Any computer or phone that stays switched on works. Steps are in the CRM → WhatsApp and alerts → Connect → Club phone.

```bash
npm install
cp .env.example .env   # paste the service role key
npm start
```

## Windows Server or Windows 10/11

Copy this folder to the server (or `git clone` the repository), open **PowerShell as Administrator** in it and run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
.\install-windows.ps1                 # built-in engine, light
.\install-windows.ps1 -Engine openwa  # OpenWA with a hidden Chrome: lower ban risk, needs about 1 GB RAM
```

It installs Node.js and Git (with winget, or tells you where to download them), asks for the Supabase service
role key, and adds a scheduled task that starts with Windows and restarts the sender if it stops.
Remove it with `.\install-windows.ps1 -Uninstall`. Logs are in `worker.log`.

## With OpenWA (recommended if you have Docker)

[OpenWA](https://github.com/rmyndharis/OpenWA) is an open-source WhatsApp gateway with its own dashboard. Its
`whatsapp-web.js` engine runs a real headless Chrome, which WhatsApp is less likely to flag than the built-in
Baileys engine, and it has its own daily send pacing. The worker then only moves messages between the CRM and OpenWA.

```bash
cp .env.example .env        # paste the Supabase service role key
docker compose -f docker-compose.openwa.yml up -d
docker compose -f docker-compose.openwa.yml logs -f crm-worker
```

Scan the QR in the CRM (WhatsApp and alerts → Connect). OpenWA's dashboard is on http://localhost:2785; its admin
key is in `openwa-data/.api-key`. It needs about 1 GB of RAM. Both run on your own computer: nothing is opened to the internet.

## Install as a service (Ubuntu or Debian server)

```bash
git clone https://github.com/amyrself-web/rotaract-blood-crm.git
cd rotaract-blood-crm/whatsapp-worker
sudo bash install.sh
```

It asks for the Supabase **secret (service role) key** (Supabase → Project Settings → API keys). Then open the CRM → **Settings → WhatsApp**, and on the club phone go to **WhatsApp → Linked devices → Link a device** and scan the QR code.

## Good practice, so WhatsApp does not block the number

- Use a separate club number, not someone's personal number. Let it chat normally for a week before large broadcasts.
- Message only people who agreed to hear from the club. Anyone who replies **STOP** is never messaged again.
- Keep the speed low (the CRM default is 6 messages a minute and 250 a day). Raise it slowly.
- This uses WhatsApp Web, which WhatsApp does not officially support for bulk sending. For large volumes use the official WhatsApp Cloud API (CRM → Settings → WhatsApp → Official API).

## Update

```bash
cd rotaract-blood-crm && git pull && cd whatsapp-worker && npm install --omit=dev && sudo systemctl restart crm-whatsapp
```

## Unlink the phone

CRM → Settings → WhatsApp → **Log out**, or on the phone: Linked devices → tap the device → Log out.
