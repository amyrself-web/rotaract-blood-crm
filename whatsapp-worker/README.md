# CRM WhatsApp worker

Sends the CRM's WhatsApp messages from the club's own number. The CRM puts messages in a queue; this small program, running on your server, sends them one by one.

## Run it on a laptop or an old Android phone (no server needed)

Any computer or phone that stays switched on works. Steps are in the CRM → WhatsApp and alerts → Connect → Club phone.

```bash
npm install
cp .env.example .env   # paste the service role key
npm start
```

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
