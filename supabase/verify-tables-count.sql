-- haathpe: Check how many of the 38 expected tables exist in your Supabase project.
-- Run this in Supabase Dashboard → SQL Editor. You'll see which tables exist and which are missing.

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
    'platform_fee_config', 'ondc_orders', 'vendor_payouts', 'platform_fees',
    'coins_config', 'customer_wallets', 'wallet_transactions', 'redemptions'
  ]) AS table_name
),
actual_tables AS (
  SELECT tablename AS table_name
  FROM pg_tables
  WHERE schemaname = 'public'
),
checked AS (
  SELECT
    et.table_name,
    CASE WHEN at.table_name IS NOT NULL THEN '✓ EXISTS' ELSE '✗ MISSING' END AS status
  FROM expected_tables et
  LEFT JOIN actual_tables at ON at.table_name = et.table_name
)
SELECT * FROM checked
ORDER BY status DESC, table_name;

-- Summary (run as second query if needed, or run whole file)
SELECT
  (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') AS tables_in_supabase,
  38 AS tables_expected_in_codebase,
  (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY(ARRAY[
    'profiles', 'orders', 'order_items', 'purchases_daily', 'loyalty_points', 'draws_entries',
    'notifications', 'forum_topics', 'forum_replies', 'course_progress', 'push_subscriptions',
    'sectors', 'categories', 'catalog_products', 'product_variants',
    'default_menu_items', 'vendor_menu_items', 'customer_orders',
    'vendor_swaps', 'swap_ratings', 'eco_redemptions', 'reward_redemptions',
    'svanidhi_support_requests', 'incentive_slabs', 'vendor_incentives',
    'ads', 'ad_impressions', 'referral_bonus_paid', 'payouts',
    'customer_profiles',
    'platform_fee_config', 'ondc_orders', 'vendor_payouts', 'platform_fees',
    'coins_config', 'customer_wallets', 'wallet_transactions', 'redemptions'
  ])) AS expected_tables_that_exist;
