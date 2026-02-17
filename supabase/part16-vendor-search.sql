-- VendorHub: Public vendor search & discovery (zero-fee aggregator)
-- Run AFTER part6 (sales/pos). Adds RPC for search without exposing full profiles to anon.

-- 1) RPC: get_vendor_search_results (SECURITY DEFINER so anon can call)
-- Returns vendors that have at least one active vendor_menu_item.
CREATE OR REPLACE FUNCTION public.get_vendor_search_results(
  p_keyword TEXT DEFAULT NULL,
  p_zone TEXT DEFAULT NULL,
  p_stall_type TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'popular'  -- 'popular' | 'name'
)
RETURNS TABLE (
  vendor_id UUID,
  name TEXT,
  stall_type TEXT,
  zone TEXT,
  address TEXT,
  menu_preview JSONB,
  order_count BIGINT
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
  )
  SELECT
    p.id,
    p.name,
    p.stall_type,
    p.zone,
    p.stall_address,
    COALESCE(mp.preview, '[]'::jsonb),
    COALESCE(oc.cnt, 0)
  FROM profiles p
  INNER JOIN vendors_with_menu v ON v.vid = p.id
  LEFT JOIN menu_previews mp ON mp.vendor_id = p.id
  LEFT JOIN order_counts oc ON oc.vendor_id = p.id
  ORDER BY
    CASE WHEN p_sort = 'name' THEN p.name ELSE NULL END ASC,
    CASE WHEN p_sort = 'popular' THEN COALESCE(oc.cnt, 0) ELSE NULL END DESC NULLS LAST;
END;
$$;

-- Allow anon and authenticated to call (public discovery)
GRANT EXECUTE ON FUNCTION public.get_vendor_search_results(TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_vendor_search_results(TEXT, TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.get_vendor_search_results IS 'Public vendor search for /search page. Returns vendors with active menu, optional keyword/zone/stall_type filter.';

-- 2) Optional: customer_profiles.favorite_vendor_ids for "Favorite" heart on search cards
ALTER TABLE public.customer_profiles ADD COLUMN IF NOT EXISTS favorite_vendor_ids UUID[] NOT NULL DEFAULT '{}';
