-- RPC: get_order_receipt — public receipt data for customer invoice (shareable link).
-- Returns id, created_at, status, vendor_name, items, total for receipt generation.
CREATE OR REPLACE FUNCTION public.get_order_receipt(p_order_id UUID)
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ,
  status TEXT,
  vendor_name TEXT,
  items JSONB,
  total NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT o.id, o.created_at, o.status,
         p.name AS vendor_name,
         COALESCE(o.items, '[]'::jsonb) AS items,
         COALESCE(o.total, 0) AS total
  FROM customer_orders o
  LEFT JOIN profiles p ON p.id = o.vendor_id
  WHERE o.id = p_order_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_receipt(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_order_receipt(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_order_receipt IS 'Public order receipt data for customer invoice (by order ID).';
