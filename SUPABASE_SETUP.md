# Supabase Auth Setup for VendorHub

This guide covers Supabase Auth (phone OTP primary, magic link secondary) and database setup.

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a project.
2. In **Project Settings > API**, copy:
   - Project URL → `VITE_SUPABASE_URL`
   - anon/public key → `VITE_SUPABASE_ANON_KEY`

## 2. Environment Variables

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Edit `.env`:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

For Vercel: add these in **Project Settings > Environment Variables**.

## 3. Create tables in Supabase (do this next)

**You need to run the migration once so the tables exist.**

1. Open **[Supabase Dashboard](https://supabase.com/dashboard)** → your project.
2. Go to **SQL Editor** (left sidebar).
3. Click **New query**.
4. Open the file **`supabase/run-this-in-supabase.sql`** in this repo, copy its full contents, and paste into the SQL Editor.
5. Click **Run** (or Ctrl/Cmd + Enter).

You should see “Success. No rows returned.” Tables created:

- **profiles** – user profile (id, phone, name, stall_type, etc.)
- **orders** – orders
- **purchases_daily** – for streak tracking
- **loyalty_points** – points balance
- **draws_entries** – daily draw eligibility

All tables have RLS (Row Level Security) so users only see their own data.

### Run second migration (order items, notifications, forum, courses)

1. In SQL Editor, **New query** again.
2. Open **`supabase/run-this-in-supabase-part2.sql`**, copy all, paste, and **Run**.

This adds:

- **order_items** – line items per order (for Place order and Orders list)
- **notifications** – in-app notifications (order updates, etc.)
- **forum_topics** and **forum_replies** – vendor forum with replies
- **course_progress** – completed course sections per user

Optional: for live forum updates, in SQL Editor run:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.forum_topics;
ALTER PUBLICATION supabase_realtime ADD TABLE public.forum_replies;
```

### Verify tables

Run **`supabase/verify-tables.sql`** in the SQL Editor. You should see:

| Table            | Purpose                          | RLS |
|------------------|----------------------------------|-----|
| `profiles`       | User profile                     | ✓   |
| `orders`         | Order headers                    | ✓   |
| `order_items`    | Order line items                 | ✓   |
| `purchases_daily`| Streak tracking                  | ✓   |
| `loyalty_points` | Points balance                   | ✓   |
| `draws_entries`  | Daily draw eligibility           | ✓   |
| `notifications`  | In-app notifications             | ✓   |
| `forum_topics`   | Forum topics                     | ✓   |
| `forum_replies`  | Forum replies                    | ✓   |
| `course_progress`| Completed course sections        | ✓   |
| `push_subscriptions` | Browser push (after part4)   | ✓   |

All listed tables should have `rls_enabled = true` and at least one policy each.

### Run third migration (incentive logic: streak, points, credit)

1. In SQL Editor, **New query** again.
2. Open **`supabase/run-this-in-supabase-part3.sql`**, copy all, paste, and **Run**.

This adds three RPCs used after "Place order":

- **`upsert_purchase_today(user_id, amount)`** – adds order total to today’s row in `purchases_daily` (for streak).
- **`add_loyalty_points(user_id, points)`** – adds points (e.g. 1 per ₹100).
- **`refresh_profile_incentives(user_id)`** – recomputes streak (last 30 days), syncs points/tier/credit_limit to `profiles` (tier: Bronze < 500 pts, Silver 500–1999, Gold 2000+; credit_limit from streak 10/20/30 days).

After placing an order, the app calls these and refreshes the profile so dashboard/loyalty show up-to-date streak, points, tier, and credit.

### Run fourth migration (admin, push subscriptions)

1. In SQL Editor, **New query**.
2. Open **`supabase/run-this-in-supabase-part4.sql`**, copy all, paste, and **Run**.

This adds:

- **profiles.role** – `vendor` (default) or `admin`; RLS so admins can view all profiles/orders and update any profile (credit/role).
- **push_subscriptions** – store browser push subscription (endpoint, keys) per user for push notifications.
- **run_daily_draw()** RPC – admin-only; picks a random winner from today’s `draws_entries` and creates a `draw_result` notification.

To make a user admin:  
`UPDATE public.profiles SET role = 'admin' WHERE id = '<auth-user-uuid>';`

Optional: **browser push** – set `VITE_VAPID_PUBLIC_KEY` in `.env` (generate with `npx web-push generate-vapid-keys`). Deploy Edge Function `send-notification-channels` to send push/SMS/WhatsApp when notifications are created.

### Later parts (part5–part8)

Run in order in SQL Editor (each as a new query):

- **part5** – Catalog: `sectors`, `categories`, `catalog_products`, `product_variants`; extends `order_items` for GST/variant.
- **part6** – Sales/POS: `default_menu_items`, `vendor_menu_items`, `customer_orders`; seeds default menu per sector.
- **part7** – Community/Eco/SVANidhi: `vendor_swaps`, `swap_ratings`, `orders.eco_flag`, `profiles.green_score`, `eco_redemptions`, RPCs `increment_green_score`, `redeem_tree_planting`.
- **part8** – Rewards: `reward_redemptions` table and RPC `redeem_reward` so Loyalty redemptions (Family Trip, Repair Kit, Credit Boost, Supplies Kit) persist and deduct points.
- **part9** – Admin full CRUD: policies so admins can Create/Read/Update/Delete on all tables (profiles, orders, order_items, notifications, forum, swaps, redemptions, catalog, etc.).
- **part10** – SVANidhi support requests: `svanidhi_support_requests` table so vendors can request application support (Profile → “Support for application”) and admins see and update status in Admin → SVANidhi tab.
- **part11** – Business details: profile columns (business_address, shop_photo_urls, gst_number, pan_number, udyam_number, fssai_license, other_business_details) and storage bucket `vendor-shop-photos` for 2–3 shop images (Profile → Edit profile).

See **`docs/FLOW_GAPS.md`** for flow gaps and what each part fixes.

## 4. Enable Phone OTP (Optional)

Phone OTP requires Twilio. In Supabase:

1. **Project Settings > Auth > Providers > Phone**
2. Enable Phone provider
3. Add Twilio credentials (Account SID, Auth Token, Phone Number)
4. See [Supabase Phone Auth Docs](https://supabase.com/docs/guides/auth/phone-login)

Without Twilio, users can use **Magic Link (email)** to sign in.

## 5. Auth URLs

In **Project Settings > Auth > URL Configuration**:

- Site URL: `https://your-domain.vercel.app` (or localhost for dev)
- Redirect URLs: add `http://localhost:8080/**` and your production URL

## 6. Tables & RLS

- **profiles**: user profiles (id from auth.users)
- **orders**: orders
- **purchases_daily**: streak tracking
- **loyalty_points**: points balance
- **draws_entries**: daily draw eligibility

All tables have RLS enabled with policies: `auth.uid() = user_id` (or `id` for profiles).

## 7. Roadmap (MVP → Production)

**Done for pilot:** RLS on all tables, place order → Supabase (orders + order_items), notifications, forum, courses, streak/points/draw/credit on place order (part3 RPCs).

**High priority next:**

- **Phone OTP in India** – Twilio is costly (₹1–2/SMS). Use Supabase Auth Hook + Indian provider (e.g. MSG91, DLT compliant): Dashboard → Auth → Hooks → “Send SMS” → Edge Function that calls MSG91 API.
- **Daily draw winner** – EOD job to pick random winner from `draws_entries` for today, credit wallet/notify. Use Supabase Edge Function + cron or external cron calling the function.

**Medium (before 100+ vendors):**

- Payments (Razorpay webhook for order + wallet top-up); credit deduction at checkout.
- Real push/SMS/WhatsApp for order status and draw wins (Realtime + provider API).
- Weather tip: OpenWeatherMap (or similar) for Hyderabad.
- Full i18n for product names/descriptions (hi/te).
- Simple admin dashboard (protected route): view vendors/orders, manual draw, credit overrides.

**Low (post-MVP):** PWA/offline, analytics (PostHog/Mixpanel), OTP rate limiting, backups, SEO.
