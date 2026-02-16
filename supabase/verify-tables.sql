-- VendorHub: run this in Supabase SQL Editor to verify tables
-- Expected: 11 tables in public (after part4), each with RLS enabled and policies

-- 1) List tables and row counts
SELECT
  schemaname,
  relname AS table_name,
  n_live_tup AS row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY relname;

-- 2) Columns per table (expected structure)
SELECT
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN (
    'profiles', 'orders', 'order_items', 'purchases_daily',
    'loyalty_points', 'draws_entries', 'notifications',
    'forum_topics', 'forum_replies', 'course_progress', 'push_subscriptions'
  )
ORDER BY c.table_name, c.ordinal_position;

-- 3) RLS enabled?
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.schemaname
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles', 'orders', 'order_items', 'purchases_daily',
    'loyalty_points', 'draws_entries', 'notifications',
    'forum_topics', 'forum_replies', 'course_progress', 'push_subscriptions'
  )
ORDER BY tablename;

-- 4) Policies per table
SELECT
  schemaname,
  tablename,
  policyname,
  cmd AS command
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
