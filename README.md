# Club CRM: blood donation camps and club work

An admin CRM, member and donor portal for a service club (Lions / Rotaract): blood donation and other camps, donors, members,
meetings, money, WhatsApp and email alerts. React + Vite + Tailwind, published on GitHub Pages; Supabase for logins, data,
scheduled jobs and email. English and Tamil (தமிழ்) on every screen.

Live site: https://amyrself-web.github.io/rotaract-blood-crm/

## What is inside

**Camps**
- Camp types: blood donation, eye checking, cancer awareness, food donation, tree plantation, and others. Each type has its own form, records and camp-day screen.
- Blood camps: QR registration, slots, check-in, screening, donation, deferral, certificates and blood stock.
- Eye, cancer and other people camps: tokens, findings, actions, referrals and follow-up.
- Food camps: places served, people fed and packets. Plantation camps: saplings, location, who waters them, and survival checks.
- Planning: checklist, desks, materials kit, expenses and sponsors.
- Token printing: one 80 mm slip the moment someone arrives (thermal printer), or many tokens on A4 sheets to cut.
- Camp photos: paste a Google Drive folder link (shared as "Anyone with the link: Viewer"). The photos show on the public camp page, the impact page and the registration page.
- Camp day: member attendance, volunteers, a summary, "Close the day", and a camp report PDF.

**People**
- Donors, with history and eligibility, plus a privacy section (consent, data requests, erasing a donor).
- Members: dues and subscriptions, ID cards, and logins for members and donors.
- Directory of hospitals and blood banks.

**Club**
- Meetings: types, board-only meetings, monthly series, prepone or postpone, attendance by code or QR, late minutes, and minutes.
- The Lionism year (July to June), with the board of each year.
- Service projects and volunteer hours, events with passes, the notice board and polls.
- Eye and body donation pledges, and club assets.
- Money: donation receipts (donor copy and office copy), club expenses and accounts.
- Club trips: who is going, each person's share and payment, every expense, the balance, and a statement PDF.

**Messages**
- A WhatsApp outbox, with automatic sending from the club phone or "tap to send".
- Broadcasts, automatic daily messages (birthdays, reminders, eligible again, follow-ups), quiet hours and a daily limit.
- An email queue, sent through Resend or SendGrid.

**Post maker**
- 24 kinds of social media post, in 11 designs.
- Sizes: square, portrait and story. Language: English, Tamil, or both.
- Add a photo, change the words, then download, share or copy a ready-made caption.

**Bulk import** (Excel or CSV) for every module:
- Downloadable templates and column mapping.
- A full preview before saving, with duplicate checks on 2 or 3 unique fields.
- An undo for a whole import.

**Reports**
- PDFs on the club letterhead, with the club logo on the left and the international logo on the right.
- Every PDF carries the club's logos as a faint watermark.
- Certificates, letters, CSV exports and a full backup.

**Public pages** (no sign-in needed): camp page (every camp type, upcoming and recent, with photos), camp and event registration, certificate and member card check, and impact numbers for every kind of camp.

## Database setup (Supabase SQL Editor)

Run each file **once, in this order**. Skip any you have already run. Every file is safe to run again.

1. `schema.sql`, `phase2.sql`, `phase3.sql`, `phase4.sql`, `phase5.sql`, `phase6.sql`, `phase8.sql`
2. `fix-01.sql` (signed-in donors can open registration links), `fix-02-grants.sql` (staff functions locked to signed-in users)
3. `v2-permissions.sql`: sub-roles, per-user permissions, settings, audit log and slot limits
4. `v3-ids-trash-branding.sql`: serial numbers, recycle bin, branding and live updates
5. `v4-numbers-checks-undo.sql`, then `v4e-undo-engine.sql`: record numbers, required-field checks and undo
6. `v5-club-members-meetings-afterlife.sql`: members, dues, meetings, eye and body donation
7. `v6-member-login.sql`: member logins, attendance by code or QR, and leave
8. `v7-certificates-funds.sql`: certificate register, receipts, expenses and accounts
9. `v8-cards-materials.sql`: member ID cards and camp materials
10. `v9-whatsapp.sql`: WhatsApp outbox (`v9b-cloud-cron.sql` only if you use the official WhatsApp Cloud API)
11. `v10-privacy-backup.sql`: donor privacy and backup reminders
12. `v11-club-projects.sql`: projects, hours, notices, polls, induction and the district report
13. `v12-directory-events-impact.sql`: directory, assets, events and impact numbers
14. `v13-donor-login.sql`: safer donor login
15. `v14-wa-send-choice.sql`: each send goes either from the club phone or through "Open WhatsApp"
16. `v15-public-showcase.sql`: "What's happening" on the sign-in page
17. `v16-emergency-any-hour.sql`: emergency alerts go out even in quiet hours
18. `v17-site-pulse.sql`: public pages update by themselves
19. `v18-club-year-meetings-camps-email.sql`: Lionism year, meeting series, email alerts, morning check, and the **`crm-daily-tick` scheduled job**
20. `v19-bulk-import.sql`: bulk import with preview and undo
21. `v20-camp-types.sql`: records and camp day for every camp type
22. `v21-intl-logo.sql`: the international logo on reports
23. `v22-post-social.sql`: website, Instagram and Facebook printed on posts
24. `v23-club-timezone.sql`: the database works in Indian time, so "today" is the club's today
25. `v24-wa-urgent-status.sql`: the outbox shows why each message is waiting, plus "send now, even in quiet hours"
26. `v25-camp-numbers-dashboard.sql`: the numbers for every camp type, and the dashboard's numbers for the whole club
27. `v26-trips-photos-public.sql`: club trips with collections and expenses, camp photos from Google Drive, and public pages for every camp type

Make yourself admin (after you have signed up):

    update profiles set role='admin' where id=(select id from auth.users where email='YOUR-EMAIL');

Optional sample data:
- `sample-data.sql` and `sample-club-data.sql` add sample records. `sample-data-remove.sql` removes them.
- `demo-users.sql` adds test logins. `demo-users-remove.sql` removes them.

### Edge functions

| Function | What it does | JWT check |
|---|---|---|
| `admin-users` | Create users, reset passwords, delete users | on |
| `email-send` | Sends queued email through Resend or SendGrid | on |
| `ai-write` | "Write it for me" in messages (optional) | on |
| `wa-cloud` | Official WhatsApp Cloud API sender and webhook (optional) | off (Meta does not send a token) |

API keys are never put in the code or in chat. The email key is set in **Settings → Email** (stored privately) or as a Supabase secret.

### Scheduled jobs (automatic)

- **`crm-daily-tick`** runs every 10 minutes inside Supabase (pg_cron). `v18` sets it up.
  - 30 minutes before the send time (default 8:00 AM), it runs the morning check.
  - It queues the day's WhatsApp messages and emails: birthdays, camp and meeting reminders, eligible again, follow-ups.
  - It sends waiting email.
- **Quiet hours** (default 9 PM to 8 AM): WhatsApp messages wait until morning.
  - Emergency alerts still go out.
  - A message marked urgent still goes out ("Send now anyway" in the Outbox, or "It is urgent" when broadcasting).

Check that the job is there:

    select jobname, schedule, active from cron.job;

## WhatsApp sender (club phone linked by QR)

The CRM puts messages in a queue. A small program, the sender, sends them from the club's own WhatsApp number.
It runs on any computer that stays on; the club uses a Windows server. Full steps are in `whatsapp-worker/README.md`.

**Windows server, first time:**
Open PowerShell **as Administrator** in the `whatsapp-worker` folder and run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
.\install-windows.ps1
```

**Sender stopped, or the Outbox shows a red "The WhatsApp sender has stopped" box?**
Open PowerShell **as Administrator** in any folder and paste:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
cd $env:TEMP
iwr https://raw.githubusercontent.com/amyrself-web/rotaract-blood-crm/main/whatsapp-worker/check-sender.ps1 -OutFile check-sender.ps1 -UseBasicParsing
.\check-sender.ps1
```

You only do this once. After that it looks after itself:
- A Windows scheduled task runs the sender as SYSTEM. It keeps running after you log out of Remote Desktop.
- The task starts the sender with Windows, checks it every 5 minutes, and restarts it within a minute if it crashes.
- From version 1.4 the sender updates itself from this repository every 6 hours. Turn this off with `AUTO_UPDATE=0` in its `.env`.
- From 1.4.1 a stuck sender restarts itself. That happens after 6 minutes with no contact with the CRM, or 15 minutes without a connection.

In **WhatsApp and alerts**:
- **Connect** shows the QR code, the sender's version, and when it was last seen.
- **Outbox** shows each message and why it is waiting: sender stopped, quiet hours, scheduled, or daily limit reached.

## Run locally

    npm install
    npm run dev

Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

### Tamil words

`src/lib/i18n.js` swaps on-screen English for Tamil using `src/lib/ta-dict.js`. To add words for a new screen, see `tools/i18n/README.md`:
1. Add the English to `tools/i18n/todo-exact.json`.
2. Add the Tamil, by line number, in a new `ta-N.tsv`.
3. Run `node tools/i18n/build.cjs`.

## Deploy

Push to `main`. GitHub Actions builds the site and publishes it to GitHub Pages.

Repository secrets needed:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`: the publishable / anon key only. Never use the secret or service_role key here.

## Settings to fill in once

In **Settings**, add:
- The club name, address and phone.
- The club logo and the international logo (with a caption).
- The website, Instagram and Facebook. They are printed on posts, letters and reports.
- The name for the club year.

## Public links

- Camp page: `/#/home`
- Camp registration: `/#/register/<camp id>` (the QR code is on the Camps page)
- Event registration: `/#/event/<event id>`
- Certificate check: `/#/verify/<code>`, download: `/#/certificate/<code>`
- Member card check: `/#/member/<code>`
- Impact numbers: `/#/impact`
