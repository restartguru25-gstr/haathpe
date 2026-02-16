# VendorHub – Deployment Guide

Deploy the app to Vercel, Netlify, or any static host. The app is a Vite + React SPA that talks to Supabase.

## Before you deploy

1. **Supabase** – Create a project and run all SQL parts (part1–part11) in the SQL Editor. See [SUPABASE_SETUP.md](../SUPABASE_SETUP.md).
2. **Environment variables** – You will need these in your hosting dashboard (see below).

## Required environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL (Project Settings → API) |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key (never use service_role in the client) |
| `VITE_VAPID_PUBLIC_KEY` | No | Browser push: run `npx web-push generate-vapid-keys`, copy Public Key to `.env` |

Copy from `.env.example` and set values in your host’s **Environment variables** / **Build & deploy** settings.

---

## Option 1: Vercel (recommended)

1. Push the repo to GitHub/GitLab/Bitbucket.
2. Go to [vercel.com](https://vercel.com) → **Add New** → **Project** → import the repo.
3. **Framework preset:** Vite (auto-detected). **Build command:** `npm run build`. **Output directory:** `dist`.
4. **Environment variables:** Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. **Deploy.** SPA routing is handled by `vercel.json` rewrites.

**CLI:** `npm i -g vercel` then `vercel` in the project root and follow prompts; add env vars in the dashboard or with `vercel env add`.

---

## Option 2: Netlify

1. Push the repo to GitHub/GitLab/Bitbucket.
2. Go to [netlify.com](https://netlify.com) → **Add new site** → **Import an existing project** → connect the repo.
3. **Build command:** `npm run build`. **Publish directory:** `dist`.
4. **Environment variables:** Site settings → Environment variables → add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. **Deploy.** SPA redirects are in `netlify.toml`.

---

## Option 3: Other static hosts (e.g. Cloudflare Pages, GitHub Pages, Firebase Hosting)

- **Build:** `npm run build` (output: `dist/`).
- **SPA:** Configure the host so all routes serve `index.html` (e.g. Cloudflare Pages “Single Page Application” or a catch-all redirect to `/index.html`).
- **Env:** Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the build environment so Vite can embed them at build time.

---

## Post-deploy checklist

- [ ] Auth works (sign in / sign up).
- [ ] Supabase URL is correct and RLS policies are applied (run part1–part11 SQL).
- [ ] If using storage (shop photos): bucket `vendor-shop-photos` exists and RLS is set (part11).
- [ ] Optional: set first admin (run `set-first-admin.sql` and set your user’s email/phone in the script).

---

## Build locally (test before deploy)

```bash
cp .env.example .env
# Edit .env with your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run build
npm run preview   # serves dist/ at http://localhost:4173
```
