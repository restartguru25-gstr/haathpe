# VendorHub SQL Run Order

Run these in Supabase SQL Editor **in this order**:

## Option A: All-in-one (if starting fresh)
1. **run-all-parts-in-order.sql** — Base schema (parts 1–12)
2. **fix-profiles-rls-recursion.sql** — Fix RLS recursion
3. **part13-referral-bonus.sql**
4. **part14-schema-extensions.sql**
5. **part15-customer-profiles.sql**
6. **part16-vendor-search.sql**
7. **part17-reviews-delivery.sql**
8. **part18-premium-ondc.sql**

## Option B: Individual parts (typical setup)
If you already ran `run-this-in-supabase.sql` + part2–12:

| Order | File | Purpose |
|-------|------|---------|
| 1 | run-this-in-supabase.sql | Core: profiles, orders, loyalty, draws |
| 2 | run-this-in-supabase-part2.sql | order_items, notifications, forum, courses |
| 3 | run-this-in-supabase-part3.sql | purchase/loyalty functions |
| 4 | run-this-in-supabase-part4.sql | push_subscriptions, run_daily_draw |
| 5 | run-this-in-supabase-part5.sql | Catalog: sectors, categories, products |
| 6 | run-this-in-supabase-part6-sales-pos.sql | Sales: default_menu, vendor_menu, customer_orders |
| 7 | run-this-in-supabase-part7-community-eco-svanidhi.sql | Swaps, eco, rewards |
| 8 | run-this-in-supabase-part8-rewards.sql | reward_redemptions |
| 9 | run-this-in-supabase-part9-admin-full-crud.sql | Admin policies |
| 10 | run-this-in-supabase-part10-svanidhi-support.sql | svanidhi_support_requests |
| 11 | run-this-in-supabase-part11-business-details.sql | profiles business columns |
| 12 | run-this-in-supabase-part12-incentives-ads.sql | incentive_slabs, vendor_incentives, ads |
| - | fix-profiles-rls-recursion.sql | Fix profiles RLS |
| 13 | part13-referral-bonus.sql | Referral bonus |
| 14 | part14-schema-extensions.sql | Extensions, payouts, ad counts |
| 15 | part15-customer-profiles.sql | Customer login, customer_phone |
| 16 | part16-vendor-search.sql | get_vendor_search_results, favorite_vendor_ids |
| 17 | part17-reviews-delivery.sql | Reviews, delivery_option, tracking RPCs |
| 18 | part18-premium-ondc.sql | premium_tier, search upgrade, upgrade_to_premium_mock |

## Verify
Run **verify-all-schema.sql** to check tables and functions. Any `✗ MISSING` means that part wasn’t applied.
