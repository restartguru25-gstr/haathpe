# haathpe – Tables created by the project

## Total: **38 tables** (in `public` schema)

The project’s SQL files define **38 tables**. Your Supabase project may have fewer if you haven’t run all parts.

---

## List of all 38 tables (by SQL part)

| # | Table name | Created in (run this in Supabase) |
|---|------------|-----------------------------------|
| 1 | `profiles` | run-this-in-supabase.sql |
| 2 | `orders` | run-this-in-supabase.sql |
| 3 | `purchases_daily` | run-this-in-supabase.sql |
| 4 | `loyalty_points` | run-this-in-supabase.sql |
| 5 | `draws_entries` | run-this-in-supabase.sql |
| 6 | `order_items` | run-this-in-supabase-part2.sql |
| 7 | `notifications` | run-this-in-supabase-part2.sql |
| 8 | `forum_topics` | run-this-in-supabase-part2.sql |
| 9 | `forum_replies` | run-this-in-supabase-part2.sql |
| 10 | `course_progress` | run-this-in-supabase-part2.sql |
| 11 | `push_subscriptions` | run-this-in-supabase-part4.sql |
| 12 | `sectors` | run-this-in-supabase-part5-catalog.sql |
| 13 | `categories` | run-this-in-supabase-part5-catalog.sql |
| 14 | `catalog_products` | run-this-in-supabase-part5-catalog.sql |
| 15 | `product_variants` | run-this-in-supabase-part5-catalog.sql |
| 16 | `default_menu_items` | run-this-in-supabase-part6-sales-pos.sql |
| 17 | `vendor_menu_items` | run-this-in-supabase-part6-sales-pos.sql |
| 18 | `customer_orders` | run-this-in-supabase-part6-sales-pos.sql |
| 19 | `vendor_swaps` | run-this-in-supabase-part7-community-eco-svanidhi.sql |
| 20 | `swap_ratings` | run-this-in-supabase-part7-community-eco-svanidhi.sql |
| 21 | `eco_redemptions` | run-this-in-supabase-part7-community-eco-svanidhi.sql |
| 22 | `reward_redemptions` | run-this-in-supabase-part8-rewards.sql |
| 23 | `svanidhi_support_requests` | run-this-in-supabase-part10-svanidhi-support.sql |
| 24 | `incentive_slabs` | run-this-in-supabase-part12-incentives-ads.sql |
| 25 | `vendor_incentives` | run-this-in-supabase-part12-incentives-ads.sql |
| 26 | `ads` | run-this-in-supabase-part12-incentives-ads.sql |
| 27 | `ad_impressions` | run-this-in-supabase-part12-incentives-ads.sql |
| 28 | `referral_bonus_paid` | part13 (in run-all-parts or referral SQL) |
| 29 | `payouts` | part14-schema-extensions.sql |
| 30 | `customer_profiles` | part15-customer-profiles.sql |
| 31 | `platform_fee_config` | part19-ondc-orders.sql |
| 32 | `ondc_orders` | part19-ondc-orders.sql |
| 33 | `vendor_payouts` | part19-ondc-orders.sql |
| 34 | `platform_fees` | part21-platform-fees.sql |
| 35 | `coins_config` | part22-customer-wallet.sql |
| 36 | `customer_wallets` | part22-customer-wallet.sql |
| 37 | `wallet_transactions` | part22-customer-wallet.sql |
| 38 | `redemptions` | part22-customer-wallet.sql |

---

## How to check how many you have in Supabase

1. Open **Supabase Dashboard** → your project → **SQL Editor**.
2. Open the file **`supabase/verify-tables-count.sql`** (in this repo).
3. Copy its contents, paste into the SQL Editor, and run it.

The script lists every expected table and shows **✓ EXISTS** or **✗ MISSING**, and prints total expected (38) vs how many exist in your database.

---

## Minimum for Forum + Vendor Swap

- **Forum:** `forum_topics`, `forum_replies` → from **run-this-in-supabase-part2.sql**
- **Vendor Swap:** `vendor_swaps`, `swap_ratings` → from **run-this-in-supabase-part7-community-eco-svanidhi.sql**

If Forum or Swap “does nothing” after submit, run the corresponding SQL file in Supabase so these tables (and RLS policies) exist.
