-- VendorHub: Comprehensive schema verification
-- Run this in Supabase SQL Editor to check if all parts (1-18) have been applied.
-- Look for any missing tables/functions in the output.

-- ========== 1) TABLES ==========
-- Expected tables (from parts 1-18)
WITH expected_tables AS (
  SELECT unnest(ARRAY[
    'profiles', 'orders', 'order_items', 'purchases_daily', 'loyalty_points', 'draws_entries',
    'notifications', 'forum_topics', 'forum_replies', 'course_progress', 'push_subscriptions',
    'sectors', 'categories', 'catalog_products', 'product_variants',
    'default_menu_items', 'vendor_menu_items', 'customer_orders',
    'vendor_swaps', 'swap_ratings', 'eco_redemptions', 'reward_redemptions',
    'svanidhi_support_requests', 'incentive_slabs', 'vendor_incentives',
    'ads', 'ad_impressions', 'referral_bonus_paid', 'payouts',
    'customer_profiles',
    'ondc_orders', 'vendor_payouts', 'platform_fee_config'
  ]) AS table_name
),
actual_tables AS (
  SELECT tablename AS table_name
  FROM pg_tables
  WHERE schemaname = 'public'
)
SELECT
  et.table_name,
  CASE WHEN at.table_name IS NOT NULL THEN '✓ EXISTS' ELSE '✗ MISSING' END AS status
FROM expected_tables et
LEFT JOIN actual_tables at ON at.table_name = et.table_name
ORDER BY et.table_name;

-- ========== 2) KEY FUNCTIONS/RPCs ==========
WITH expected_funcs AS (
  SELECT unnest(ARRAY[
    'get_vendor_search_results', 'upgrade_to_premium_mock',
    'submit_order_review', 'get_order_for_tracking', 'get_vendor_reviews',
    'credit_incentive_balance', 'run_daily_incentive_calc', 'request_payout',
    'set_my_referrer', 'run_referral_bonus_calc',
    'is_admin', 'increment_ad_counts',
    'handle_updated_at', 'upsert_purchase_today', 'add_loyalty_points',
    'refresh_profile_incentives', 'run_daily_draw'
  ]) AS func_name
),
actual_funcs AS (
  SELECT p.proname AS func_name
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
)
SELECT
  ef.func_name,
  CASE WHEN af.func_name IS NOT NULL THEN '✓ EXISTS' ELSE '✗ MISSING' END AS status
FROM expected_funcs ef
LEFT JOIN actual_funcs af ON af.func_name = ef.func_name
ORDER BY ef.func_name;

-- ========== 3) KEY COLUMNS (Phases 2-4) ==========
-- Part 15: customer_profiles
SELECT 'customer_profiles' AS tbl, column_name, '✓' AS ok
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'customer_profiles'
  AND column_name IN ('id', 'phone', 'favorites', 'favorite_vendor_ids')
UNION ALL
SELECT 'customer_orders', column_name, '✓'
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'customer_orders'
  AND column_name IN ('customer_phone', 'rating', 'review_text', 'reviewed_at', 'delivery_option', 'delivery_address')
UNION ALL
SELECT 'profiles', column_name, '✓'
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
  AND column_name IN ('zone', 'premium_tier', 'available_balance')
ORDER BY tbl, column_name;

-- ========== 4) SUMMARY ==========
SELECT
  (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') AS actual_table_count,
  33 AS expected_table_count,
  CASE WHEN (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') >= 28
    THEN '✓ Tables look complete' ELSE '✗ Some tables may be missing' END AS table_check;
