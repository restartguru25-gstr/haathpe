-- Add premium_expires_at for subscription tracking (₹99/month)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.premium_expires_at IS 'Premium subscription expiry. If set and past, vendor is treated as free tier.';

-- Update get_vendor_search_results to consider premium_expires_at for ranking and returned tier
DROP FUNCTION IF EXISTS public.get_vendor_search_results(TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.get_vendor_search_results(
  p_keyword TEXT DEFAULT NULL,
  p_zone TEXT DEFAULT NULL,
  p_stall_type TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'popular'
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
    SELECT p.id AS vid, p.name, p.stall_type, p.zone, p.stall_address,
           p.premium_tier AS raw_tier,
           p.premium_expires_at,
           CASE
             WHEN COALESCE(p.premium_tier, 'free') = 'premium'
                  AND (p.premium_expires_at IS NULL OR p.premium_expires_at > NOW())
             THEN 'premium'
             WHEN COALESCE(p.premium_tier, 'free') = 'basic' THEN 'basic'
             ELSE 'free'
           END AS effective_tier
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
    SELECT sub.vendor_id, jsonb_agg(sub.item ORDER BY sub.ord) AS preview
    FROM (
      SELECT vmi.vendor_id,
             jsonb_build_object('item_name', vmi.item_name, 'price', vmi.custom_selling_price) AS item,
             vmi.sort_order AS ord,
             row_number() OVER (PARTITION BY vmi.vendor_id ORDER BY vmi.sort_order) AS rn
      FROM vendor_menu_items vmi
      WHERE vmi.is_active = true
    ) sub
    WHERE sub.rn <= 3
    GROUP BY sub.vendor_id
  ),
  order_counts AS (
    SELECT co.vendor_id, COUNT(*)::BIGINT AS cnt
    FROM customer_orders co
    GROUP BY co.vendor_id
  ),
  vendor_ratings AS (
    SELECT ord.vendor_id, ROUND(AVG(ord.rating)::NUMERIC, 1) AS ar
    FROM customer_orders ord
    WHERE ord.rating IS NOT NULL
    GROUP BY ord.vendor_id
  )
  SELECT
    v.vid,
    v.name,
    v.stall_type,
    v.zone,
    v.stall_address,
    COALESCE(mp.preview, '[]'::jsonb),
    COALESCE(oc.cnt, 0),
    v.effective_tier,
    vr.ar
  FROM vendors_with_menu v
  LEFT JOIN menu_previews mp ON mp.vendor_id = v.vid
  LEFT JOIN order_counts oc ON oc.vendor_id = v.vid
  LEFT JOIN vendor_ratings vr ON vr.vendor_id = v.vid
  ORDER BY
    CASE v.effective_tier
      WHEN 'premium' THEN 0
      WHEN 'basic' THEN 1
      ELSE 2
    END ASC,
    CASE WHEN p_sort = 'name' THEN v.name ELSE NULL END ASC,
    CASE WHEN p_sort = 'popular' THEN COALESCE(oc.cnt, 0) ELSE NULL END DESC NULLS LAST,
    CASE WHEN p_sort = 'rating' THEN COALESCE(vr.ar, 0) ELSE NULL END DESC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_vendor_search_results(TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_vendor_search_results(TEXT, TEXT, TEXT, TEXT) TO authenticated;
