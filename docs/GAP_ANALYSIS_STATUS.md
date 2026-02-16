# Gap Analysis Status — MVP → Production

This checklist maps the **prioritized gap analysis** to what is **implemented** vs **missing** in VendorHub. (Note: app is **Vite + React + Supabase**, not Next.js.)

---

## High Priority (Before First Real Users / Hyderabad Pilot)

| # | Item | Status | Where / Notes |
|---|------|--------|----------------|
| 1 | **Proper RLS policies** | ✅ **Done** | All 10 tables have RLS enabled. Owner policies: `profiles` → `auth.uid() = id` (SELECT/INSERT/UPDATE); `orders` → `auth.uid() = user_id` (SELECT/INSERT); `purchases_daily`, `loyalty_points`, `draws_entries` → `auth.uid() = user_id` (SELECT/INSERT; loyalty_points also UPDATE). `order_items` via order ownership. See `supabase/run-this-in-supabase.sql` + `run-this-in-supabase-part2.sql`. |
| 2 | **Real streak / points / credit / draw logic** | ✅ **Done** (except EOD draw winner) | **On place order:** Insert into `purchases_daily` (via RPC `upsert_purchase_today`), add points via `add_loyalty_points` (1 per ₹100), sync streak/tier/credit to `profiles` via `refresh_profile_incentives`. Draw entry: if order ≥ ₹1000 → insert into `draws_entries`. Streak = distinct days in last 30; tier from points (Bronze &lt; 500, Silver 500–1999, Gold 2000+); credit_limit from streak (10/20/30 days). **Missing:** EOD cron/Edge Function to pick daily draw winner and notify/credit. See `supabase/run-this-in-supabase-part3.sql` and `src/pages/Cart.tsx`. |
| 3 | **Order placement flow completion** | ✅ **Done** | Cart “Place order”: INSERT into `orders` (user_id, total, status `pending`), INSERT into `order_items`, create in-app notification, then `upsert_purchase_today`, draw entry if ≥1000, `add_loyalty_points`, `refresh_profile_incentives`, `refreshProfile()`, clear cart, toast, navigate to `/orders`. Total uses slab discount (5%/10%). See `src/pages/Cart.tsx`. |
| 4 | **Phone OTP in India (MSG91 / cost)** | ⬜ **Not done** | No MSG91 or custom SMS hook. Twilio can be configured in Supabase (Auth → Phone); doc suggests Supabase Auth Hook + MSG91 Edge Function when scaling. See `SUPABASE_SETUP.md` §7 Roadmap. |

---

## Medium Priority (Before 100+ Vendors)

| # | Item | Status | Where / Notes |
|---|------|--------|----------------|
| 5 | **Payments / credit wallet** | ⬜ **Not done** | No Razorpay, no webhook for order confirmation or wallet top-up. Credit limit is computed and stored in `profiles`; no deduction at checkout yet. |
| 6 | **Notifications (push / SMS / WhatsApp)** | 🟡 **Partial** | In-app notifications done. **Browser push:** `push_subscriptions` table, “Enable” in Profile → Notification settings, `sw.js` + VAPID (optional). After each in-app notification, app calls Edge Function `send-notification-channels` (stub in `supabase/functions/send-notification-channels`); wire web-push/SMS/WhatsApp there. |
| 7 | **Weather tip (real data)** | ⬜ **Not done** | No OpenWeatherMap or other API; weather tip on dashboard is static/placeholder. |
| 8 | **Multilingual depth** | ✅ **Done** | Full i18n: expanded `translations` (en/hi/te) for settings, profile, catalog, orders, notifications; product `descriptionHi`/`descriptionTe`; `getProductDescription()`; categories/sort/copy use `t()`. |
| 9 | **Admin / moderation** | ✅ **Done** | `profiles.role` (vendor/admin), RLS for admin (view all profiles/orders, update credit/role). `/admin`: Vendors table, Orders table, Run daily draw (RPC `run_daily_draw`), Credit limit override. Link in TopNav and Profile when `role === 'admin'`. Set admin via SQL: `UPDATE profiles SET role = 'admin' WHERE id = '<uuid>';` |

---

## Low Priority (Post-MVP)

| # | Item | Status |
|---|------|--------|
| 10 | Offline support (PWA + local cart sync) | ⬜ Not done |
| 11 | Analytics (PostHog / Mixpanel) | ⬜ Not done |
| 12 | Rate limiting on OTP requests | ⬜ Not done |
| 13 | Backup/restore automation | ⬜ Not done |
| 14 | SEO (meta tags, sitemap) for public landing | ⬜ Not done |

---

## Summary

- **High:** RLS ✅, Streak/points/credit/draw (backend + place-order) ✅, Order flow ✅. **Missing:** MSG91/SMS hook (doc only), **daily draw winner** (EOD job).
- **Medium:** All either not started or partial (in-app notifications only; no payments, weather, full i18n, admin).
- **Low:** None implemented.

**Next steps (suggested):**  
1) Run `supabase/run-this-in-supabase-part3.sql` if not already.  
2) Add Supabase Edge Function + cron for daily draw winner.  
3) When scaling SMS: Auth Hook + MSG91 (see `SUPABASE_SETUP.md` §7).
