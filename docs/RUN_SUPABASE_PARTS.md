# Run all Supabase SQL parts (part1–part12)

Run these in your **production** Supabase project in this exact order.

**Where:** [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL Editor** → New query.

---

## Option 1: Run everything at once (easiest)

1. Open **`supabase/run-all-parts-in-order.sql`** (it contains part1–part12 in order).
2. Copy the entire file.
3. In Supabase → SQL Editor → New query → paste → **Run**.
4. If you see an error, use Option 2 and run the files one by one from the step that failed.

---

## Option 2: Run one file at a time

Paste each file’s contents in order, run, then do the next.

| Order | File | What it does |
|-------|------|--------------|
| 1 | `supabase/run-this-in-supabase.sql` | Base: profiles, orders, order_items, purchases_daily, RLS |
| 2 | `supabase/run-this-in-supabase-part2.sql` | order_items table / references |
| 3 | `supabase/run-this-in-supabase-part3.sql` | purchases_daily RPC, streak/points sync |
| 4 | `supabase/run-this-in-supabase-part4.sql` | Admin role, admin policies |
| 5 | `supabase/run-this-in-supabase-part5-catalog.sql` | Catalog: sectors, categories, products, variants |
| 6 | `supabase/run-this-in-supabase-part6-sales-pos.sql` | Sales/POS: default_menu_items, vendor_menu_items, customer_orders |
| 7 | `supabase/run-this-in-supabase-part7-community-eco-svanidhi.sql` | Swaps, eco, green_score, eco_redemptions |
| 8 | `supabase/run-this-in-supabase-part8-rewards.sql` | reward_redemptions, redeem_reward RPC |
| 9 | `supabase/run-this-in-supabase-part9-admin-full-crud.sql` | Admin full CRUD policies on all tables |
| 10 | `supabase/run-this-in-supabase-part10-svanidhi-support.sql` | svanidhi_support_requests table |
| 11 | `supabase/run-this-in-supabase-part11-business-details.sql` | Profile business fields + vendor-shop-photos bucket |
| 12 | `supabase/run-this-in-supabase-part12-incentives-ads.sql` | Cash incentives (slabs, vendor_incentives) + ads, ad_impressions |
| 13 | `supabase/part13-referral-bonus.sql` | Referral bonus: referred_by, referral_bonus_paid, ₹100 per referred vendor who hits 100 entries |

**After part12 or part13 (optional):**

- **Local sponsor ads:** run `supabase/seed-local-sponsor-ads.sql` to add free Hyderabad chai brand ads for click-through testing.
- **First admin:** run `supabase/set-first-admin.sql` or `supabase/set-admin-by-email.sql` and set your user’s email/phone in the script so one profile gets `role = 'admin'`.
- **Verify:** run `supabase/verify-tables.sql` to check tables exist.

**If something fails:** run the parts one by one; the error message usually says which part or object is missing. Fix (or re-run an earlier part) then continue.
