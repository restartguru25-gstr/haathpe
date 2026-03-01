-- Add delivery_option to get_order_receipt for invoice line "Delivery: ₹0 (Self)".
-- Return type change requires DROP first.
DROP FUNCTION IF EXISTS public.get_order_receipt(UUID);
CREATE OR REPLACE FUNCTION public.get_order_receipt(p_order_id UUID)
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ,
  status TEXT,
  vendor_name TEXT,
  items JSONB,
  subtotal NUMERIC,
  delivery_fee_amount NUMERIC,
  platform_fee_amount NUMERIC,
  delivery_option TEXT,
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
         COALESCE(o.subtotal, 0) AS subtotal,
         COALESCE(o.delivery_fee_amount, 0) AS delivery_fee_amount,
         COALESCE(o.platform_fee_amount, 0) AS platform_fee_amount,
         COALESCE(o.delivery_option::TEXT, 'pickup') AS delivery_option,
         COALESCE(o.total, 0) AS total
  FROM customer_orders o
  LEFT JOIN profiles p ON p.id = o.vendor_id
  WHERE o.id = p_order_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_receipt(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_order_receipt(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_order_receipt IS 'Receipt for invoice: subtotal, delivery_fee, platform_fee, delivery_option (pickup|self_delivery|platform).';
-- Future: For Platform Delivery, add Rapido (or partner) API integration to fetch real fee based on address/distance.
