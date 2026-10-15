# Rotaract Blood CRM (Sankari Rotaract Club)

Admin CRM + donor portal for blood donation camps. React + Vite + Tailwind on GitHub Pages, Supabase for login and data.

## What is inside
Login and 5 roles, donors, camps with QR registration, Excel import, camp-day check-in / screening / donation, WhatsApp message queues,
donor portal with certificates, public landing page, blood stock, emergency requests, camp planning, reports and CSV export.

## Database setup (Supabase SQL Editor)
Run each file ONCE, in this order. Skip any you have already run.
1. supabase/schema.sql
2. supabase/phase2.sql
3. supabase/phase3.sql
4. supabase/phase4.sql
5. supabase/phase5.sql
6. supabase/phase6.sql
7. supabase/phase8.sql

Make yourself admin (after you have signed up):
    update profiles set role='admin' where id=(select id from auth.users where email='YOUR-EMAIL');

## Run locally
    npm install
    npm run dev
Copy `.env.example` to `.env` and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.

## Deploy
Push to `main`. GitHub Actions builds and publishes to GitHub Pages.
Repo secrets needed: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (use the publishable / anon key, never the secret or service_role key).

## Public links
- Camp page: /#/home
- Camp registration: /#/register/<camp id> (QR on the Camps page)
- Certificate check: /#/verify/<code>
