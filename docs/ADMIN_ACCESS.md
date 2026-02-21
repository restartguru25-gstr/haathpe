# Super Admin Dashboard – How to Access

The Admin dashboard is at **`/admin`** and is only visible to users with `role = 'admin'` in the `profiles` table.

---

## How to become Admin

### 1. Run the SQL in Supabase

1. Open **Supabase Dashboard** → your project → **SQL Editor**
2. Open **`supabase/set-admin-by-email.sql`** in your project
3. Replace `YOUR_EMAIL@example.com` with your sign-up email (e.g. `dukaan@hyder.com`) in **both places**
4. Click **Run**

```sql
-- Replace YOUR_EMAIL@example.com with your email
UPDATE public.profiles
SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'dukaan@hyder.com');

INSERT INTO public.profiles (...)
SELECT ... FROM auth.users
WHERE email = 'dukaan@hyder.com'
  AND id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO UPDATE SET role = 'admin';
```

### 2. Log out and log back in

The app loads your profile on sign-in. Log out, then sign in again so it picks up the new role.

### 3. Where to find Admin

Once your role is `admin`:

| Screen | Location |
|--------|----------|
| **Desktop** | Top nav bar – **Admin** (Shield icon) |
| **Mobile** | Bottom nav – **Admin** tab |
| **Profile** | Scroll down – **Admin dashboard** button |
| **Direct URL** | `https://yoursite.com/admin` |

---

## Admin Dashboard Tabs

- **Vendors** – Edit vendors, set role (vendor/admin), credit limits
- **Orders** – View platform orders
- **Swaps** – Approve/reject Dukaan Swap listings
- **Redemptions** – Approve/reject wallet coin redemptions
- **Incentives** – Slabs, daily calc, referral bonus, monthly draw
- **Ads** – Manage ad banners
- **ONDC** – ONDC orders
