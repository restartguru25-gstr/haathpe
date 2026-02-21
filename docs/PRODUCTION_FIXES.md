# Production Fixes — haathpe (Vite + React)

This app uses **Vite + React**, not Next.js. Server Actions and Next.js-specific fixes do not apply.

---

## Supabase API Error Reference

| Error | Endpoint | Cause | Fix |
|-------|----------|-------|-----|
| **400** | `/auth/v1/token?grant_type=password` | Weak password, invalid email/password | Use strong password (8+ chars); validate before submit |
| **406** | `/rest/v1/profiles`, `customer_profiles` | `.single()` when 0 rows (RLS block or missing row) | Use `.maybeSingle()` — done in AuthContext, customer.ts |
| **400** | `/auth/v1/user` (PUT) | Invalid body, weak password, stale token | Refresh session before update; validate password |
| **401** | `/functions/v1/set-mpin` | Supabase JWT gate blocks request before our code; or invalid/stale token | Use `supabase.functions.invoke()` (attaches session). If still 401: disable JWT verify on function (see section 6) |
| **401** | `/rest/v1/customer_orders` | RLS blocks anon insert | Apply "Anyone can insert" policy — see section 1 below |

**set-mpin:** Frontend uses `supabase.functions.invoke('set-mpin', { body: { mpin } })` so the session is sent automatically. The function validates the token via `getUser(token)`.

---

## Auth Token Handling (Implemented)

- **Supabase client:** `autoRefreshToken: true`, `detectSessionInUrl: true`, `persistSession: true`
- **AuthProvider:** Periodic session refresh every 10 minutes when logged in (keeps JWT fresh for REST calls)
- **Session recovery:** Visibility change + recovery on mount

The Supabase client automatically attaches the session token to all REST requests. If you still get 401 for **authenticated** requests (profile save, etc.), check Vercel env vars and Supabase Auth URLs.

---

## 1. HTTP 401 on customer_orders (Critical — Fix First)

**Error:** `POST /rest/v1/customer_orders` returns 401  
**Message:** "new row violates row-level security policy"

### Root cause

- Place order is used by **guests** (no sign-in) and customers.
- **Guests have no session** — requests use only the anon key. Session refresh does NOT fix this.
- Requests use the **anon key** as JWT.
- RLS on `customer_orders` blocks inserts when no policy allows anon.

### Fix (5 minutes)

Run in **Supabase Dashboard → SQL Editor** (project `tobpayhdvdoduspxdrjz`):

```sql
DROP POLICY IF EXISTS "Anyone can insert customer_orders" ON public.customer_orders;
CREATE POLICY "Anyone can insert customer_orders" ON public.customer_orders
  FOR INSERT
  WITH CHECK (true);
```

Or apply migrations:

```bash
supabase link --project-ref tobpayhdvdoduspxdrjz
supabase db push
```

This unblocks Place order for guests and customers.

---

## 2. Cookie "__cf_bm" rejected

**What it is:** Cloudflare Bot Management cookie, not from your app.

**Impact:** Typically low. Can sometimes cause intermittent WebSocket issues.

**Options (if needed):**

- In Cloudflare: review cookie / security settings for `haathpe.com`.
- Ensure custom domain is correctly set in Vercel.

---

## 3. Profile save / other 401s

**If profile save fails with 401:**

1. Supabase client is configured with:
   - `persistSession: true`
   - `autoRefreshToken: true`
   - `detectSessionInUrl: true`
   - `storage: localStorage`

2. Check:
   - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set in Vercel.
   - Same values as in Supabase project.
   - Site URL and Redirect URLs in Supabase Auth match your production domain.

---

## 4. Phone input

Already handled in `src/lib/phoneUtils.ts`:

- `normalizePhoneDigits()` strips `91` and leading `0`.
- `toE164Indian()` formats as `+91` + 10 digits.

`Auth.tsx` and `CustomerLogin.tsx` use these helpers; no changes needed.

---

## 5. Cart (Zustand)

Already in place: `src/store/cartStore.ts` for Catalog (supply) cart.

PublicMenu uses its own cart state for dukaan menu items; this is intentional and separate from the Catalog cart.

---

## 6. MPIN set returns 401 (set-mpin Edge Function)

**Error:** `POST /functions/v1/set-mpin` returns 401  
**Cause:** Supabase’s built-in JWT verification may block the request before our code runs, or the token is invalid/stale.

### Fix A — Use invoke (implemented)

The frontend now uses `supabase.functions.invoke('set-mpin', { body: { mpin } })`, which attaches the session automatically. Redeploy the app and test.

### Fix B — Disable JWT verification (required if 401 persists)

Supabase validates the JWT before the request reaches our handler. If that fails, you get 401 before our code runs.

**Option 1 — config.toml:** `supabase/config.toml` has `verify_jwt = false` for set-mpin. Redeploy:
```bash
supabase functions deploy set-mpin
```

**Option 2 — CLI flag (use if config not applied):**
```bash
supabase functions deploy set-mpin --no-verify-jwt
```
Or run: `./scripts/deploy-set-mpin.sh`

**Option 3 — Dashboard:** Edge Functions → set-mpin → Config → Verify JWT OFF → Redeploy.

The function still validates the token via `getUser(token)`. Disabling the built-in JWT check lets the request reach our handler.

---

## Checklist for production

| Task | Action |
|------|--------|
| customer_orders 401 | Run RLS policy SQL above in Supabase |
| Env vars | Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` in Vercel |
| Supabase Auth | Add `https://www.haathpe.com` to Site URL and Redirect URLs |
| set-mpin 401 | Use `supabase.functions.invoke`; if needed, deploy with `--no-verify-jwt` |
| Redeploy | Deploy to Vercel and Edge Functions |
| Verify | Test Place order (guest and customer), MPIN set, profile save |
