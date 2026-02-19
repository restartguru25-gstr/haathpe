# Profile Update Fix – Diagnostic & RLS Policy

If profile edits (name, phone, etc.) fail when clicking **Save** on https://www.haathpe.com/profile, follow these steps.

---

## Step 1: Quick Diagnostic (≈2 minutes)

1. Go to https://www.haathpe.com/profile (logged in as a test vendor).
2. Edit something simple (name or phone) → click **Save**.
3. Open **DevTools** → **Console** tab → check for errors after Save.

**Typical errors:**
- `new row violates row-level security policy`
- `JWT expired` or `Invalid JWT`
- `Failed to fetch` or `401` / `403`
- `Cannot read property 'update' of undefined`

4. Go to **Network** tab → click Save again → find the Supabase request  
   (URL like `https://*.supabase.co/rest/v1/profiles`).
5. Inspect **Status** (200? 401? 403?) and **Response** tab for the error message.

**Report back:**
- Console error (if any)
- Network request status and response body

---

## Step 2: RLS Policy on `profiles`

Supabase RLS on `profiles` can block updates if the policy is missing or wrong.

### Option A: Run the migration (recommended)

If you use Supabase migrations:

```bash
supabase db push
```

or run the migration file:

`supabase/migrations/20260216130000_profiles_update_policy_with_check.sql`

### Option B: Apply manually in Supabase

1. Supabase Dashboard → **Database** → **Tables** → `profiles`.
2. Open **Row Level Security** → ensure RLS is **enabled**.
3. Open **Policies** → locate the UPDATE policy.
4. If missing or wrong, run this in **SQL Editor**:

```sql
-- Drop existing policy (if any)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Create correct UPDATE policy
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
```

5. Run the query → test Save again on the Profile page.

---

## Step 3: App-specific notes (Vite + React)

This app is **Vite + React** (not Next.js). There are no Server Actions. Profile updates use the client Supabase client with the user’s session.

Changes made:

- Switched profile save from `upsert` to `update` for clearer RLS behavior.
- Improved error logging in the console for failed saves.

---

## Step 4: Other checks

| Item | Check |
|------|--------|
| Auth | User is logged in; `supabase.auth.getUser()` returns a user |
| Env vars | `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in Vercel production |
| Supabase URL | Correct Supabase project URL (e.g. `https://your-project.supabase.co`) |

---

## Summary

Most profile save failures are caused by RLS blocking updates. Apply the `profiles` UPDATE policy (Step 2) and rerun the Save flow.
