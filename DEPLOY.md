# Deploying to Vercel (haathpe.com)

## If you see **307** on `GET /`

Vercel is redirecting the root URL. Fix it:

1. **Vercel Dashboard** → Your project → **Settings** → **Redirects**
2. Remove or edit any rule that has **Source** = `/` or `/*` and **Destination** = something else (e.g. `https://www.haathpe.com` or another URL).
3. Keep only:
   - **HTTP → HTTPS** (optional; Vercel usually does this)
   - **www → non‑www** (or vice versa) if you use both; make sure the destination domain is the one you use for the app.

The app must be served at the **same** domain you open (e.g. `https://haathpe.com`). If a redirect sends `/` to another host or path, you can get a blank screen or redirect loop.

## If you see **401** on assets (e.g. `/icons/icon.svg`)

- **401** on a URL like `…-elderprojects.vercel.app` means that **preview deployment** has **Vercel Password Protection** (or similar) enabled. The browser is requesting the asset from that host and gets blocked.
- **Fix:** Use the **production** URL (e.g. `https://haathpe.com`) when opening the site. Or in Vercel: **Settings** → **Deployment Protection** → turn off protection for Production (or allowlist the production domain).

## Required environment variables

In **Settings** → **Environment Variables**, add for **Production** (and optionally Preview/Development):

- `VITE_SUPABASE_URL` = your Supabase project URL  
- `VITE_SUPABASE_ANON_KEY` = your Supabase anon (public) key  

Redeploy after adding or changing variables.
