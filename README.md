# Rotaract Blood CRM (Phase 1: Foundation)

Login, 5 roles, dark blue layout, GitHub Pages deploy. Runs in preview mode without a database.

## Run locally
    npm install
    npm run dev

## Connect the database (Supabase, free)
1. Create a project at supabase.com. In SQL Editor, run `supabase/schema.sql`.
2. Copy `.env.example` to `.env` and fill in Project URL and anon key (Project Settings > API).
3. Sign up in the app, then run the last (commented) line of `schema.sql` with your email to become admin.

## Deploy to GitHub Pages
1. Push this folder to a GitHub repo, branch `main`.
2. Repo Settings > Pages > Source: **GitHub Actions**.
3. Repo Settings > Secrets and variables > Actions: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Push to `main`; the site goes live at `https://<user>.github.io/<repo>/`.

Free GitHub Pages needs a public repo. Never commit `.env` or the Supabase service_role key.
