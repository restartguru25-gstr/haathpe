-- VendorHub: Premium tiers + ONDC export readiness
-- Run AFTER part17. Adds premium_tier for monetization, search boost.

-- 1) Premium tier on profiles (free | basic | premium)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS premium_tier TEXT NOT NULL DEFAULT 'free'
  CHECK (premium_tier IN ('free', 'basic', 'premium'));

COMMENT ON COLUMN public.profiles.premium_tier IS 'Vendor tier: free (default), basic, premium. Premium gets boosted search ranking.';

-- 2) RPC: Update get_vendor_search_results - add premium_tier, avg_rating, rating sort, premium boost
DROP FUNCTION IF EXISTS public.get_vendor_search_results(TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.get_vendor_search_results(
  p_keyword TEXT DEFAULT NULL,
  p_zone TEXT DEFAULT NULL,
  p_stall_type TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'popular'  -- 'popular' | 'name' | 'rating'
)
RETURNS TABLE (
  vendor_id UUID,
  name TEXT,
  stall_type TEXT,
  zone TEXT,
  address TEXT,
  menu_preview JSONB,
  order_count BIGINT,
  premium_tier TEXT,
  avg_rating NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH vendors_with_menu AS (
    SELECT p.id AS vid
    FROM profiles p
    WHERE EXISTS (
      SELECT 1 FROM vendor_menu_items vmi
      WHERE vmi.vendor_id = p.id AND vmi.is_active = true
    )
    AND (p_keyword IS NULL OR p_keyword = '' OR
         p.name ILIKE '%' || p_keyword || '%' OR
         p.stall_type ILIKE '%' || p_keyword || '%')
    AND (p_zone IS NULL OR p_zone = '' OR p.zone = p_zone)
    AND (p_stall_type IS NULL OR p_stall_type = '' OR p.stall_type ILIKE '%' || p_stall_type || '%')
  ),
  menu_previews AS (
    SELECT vendor_id, jsonb_agg(item ORDER BY ord) AS preview
    FROM (
      SELECT vendor_id,
             jsonb_build_object('item_name', item_name, 'price', custom_selling_price) AS item,
             sort_order AS ord,
             row_number() OVER (PARTITION BY vendor_id ORDER BY sort_order) AS rn
      FROM vendor_menu_items
      WHERE is_active = true
    ) sub
    WHERE rn <= 3
    GROUP BY vendor_id
  ),
  order_counts AS (
    SELECT vendor_id, COUNT(*)::BIGINT AS cnt
    FROM customer_orders
    GROUP BY vendor_id
  ),
  vendor_ratings AS (
    SELECT vendor_id, ROUND(AVG(rating)::NUMERIC, 1) AS ar
    FROM customer_orders
    WHERE rating IS NOT NULL
    GROUP BY vendor_id
  )
  SELECT
    p.id,
    p.name,
    p.stall_type,
    p.zone,
    p.stall_address,
    COALESCE(mp.preview, '[]'::jsonb),
    COALESCE(oc.cnt, 0),
    COALESCE(p.premium_tier, 'free'),
    vr.ar
  FROM profiles p
  INNER JOIN vendors_with_menu v ON v.vid = p.id
  LEFT JOIN menu_previews mp ON mp.vendor_id = p.id
  LEFT JOIN order_counts oc ON oc.vendor_id = p.id
  LEFT JOIN vendor_ratings vr ON vr.vendor_id = p.id
  ORDER BY
    -- Premium boost: premium > basic > free
    CASE COALESCE(p.premium_tier, 'free')
      WHEN 'premium' THEN 0
      WHEN 'basic' THEN 1
      ELSE 2
    END ASC,
    CASE WHEN p_sort = 'name' THEN p.name ELSE NULL END ASC,
    CASE WHEN p_sort = 'popular' THEN COALESCE(oc.cnt, 0) ELSE NULL END DESC NULLS LAST,
    CASE WHEN p_sort = 'rating' THEN COALESCE(vr.ar, 0) ELSE NULL END DESC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_vendor_search_results(TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_vendor_search_results(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- 3) RPC: Mock premium upgrade (stub — real payment via Razorpay later)
CREATE OR REPLACE FUNCTION public.upgrade_to_premium_mock()
RETURNS TABLE (ok BOOLEAN, error_msg TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN QUERY SELECT false, 'Not logged in'::TEXT;
    RETURN;
  END IF;
  UPDATE profiles
  SET premium_tier = 'premium'
  WHERE id = auth.uid();
  RETURN QUERY SELECT true, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upgrade_to_premium_mock() TO authenticated;
