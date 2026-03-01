-- Platform fee: flat ₹5 collected from customer on ONLINE orders → Haathpe revenue.
-- Vendor receives subtotal - 1.2% only; delivery charges pass-through to riders; no ₹5 deduction from vendor.

-- 1) customer_orders: add columns for online order breakdown
ALTER TABLE public.customer_orders
  ADD COLUMN IF NOT EXISTS platform_fee_amount DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.customer_orders
  ADD COLUMN IF NOT EXISTS delivery_fee_amount DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.customer_orders
  ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.customer_orders.platform_fee_amount IS 'Flat ₹5 platform fee collected from customer on online orders; Haathpe revenue. Not applied on POS/in-store.';
COMMENT ON COLUMN public.customer_orders.delivery_fee_amount IS 'Actual delivery/rider charges; pass-through to riders.';
COMMENT ON COLUMN public.customer_orders.is_online IS 'True for QR menu / Pay Direct / cart online payment; false for POS or pay-at-dukaan.';

-- 2) platform_revenue: log ₹5 per paid online order (and any future platform revenue)
CREATE TABLE IF NOT EXISTS public.platform_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  source TEXT NOT NULL DEFAULT 'online_order',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_revenue_order ON public.platform_revenue(order_id);
CREATE INDEX IF NOT EXISTS idx_platform_revenue_created ON public.platform_revenue(created_at);

ALTER TABLE public.platform_revenue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role can manage platform_revenue" ON public.platform_revenue;
CREATE POLICY "Service role can manage platform_revenue" ON public.platform_revenue
  FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Admins can read platform_revenue" ON public.platform_revenue;
CREATE POLICY "Admins can read platform_revenue" ON public.platform_revenue
  FOR SELECT USING (public.is_admin());

COMMENT ON TABLE public.platform_revenue IS '₹5 platform fee per online order → Haathpe revenue; delivery to riders; vendor gets subtotal - 1.2%. On refund/cancel, reverse or debit this (not yet implemented).';

-- 3) credit_vendor_receipt_from_order: use SUBTOTAL - 1.2% (do NOT deduct ₹5 from vendor)
CREATE OR REPLACE FUNCTION public.credit_vendor_receipt_from_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor_id UUID;
  v_subtotal DECIMAL(12,2);
  v_fee_pct DECIMAL(5,4) := 0.012;
  v_fee DECIMAL(12,2);
  v_after_fee DECIMAL(12,2);
BEGIN
  IF p_order_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid order');
  END IF;

  -- Use subtotal only; 1.2% fee on subtotal. Platform fee ₹5 is NOT deducted from vendor.
  SELECT vendor_id, COALESCE(subtotal, 0)
  INTO v_vendor_id, v_subtotal
  FROM public.customer_orders
  WHERE id = p_order_id AND status = 'paid';

  IF v_vendor_id IS NULL OR v_subtotal IS NULL OR v_subtotal <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Order not found or not paid');
  END IF;

  IF (SELECT vendor_receipt_credited_at FROM public.customer_orders WHERE id = p_order_id) IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already_credited', true);
  END IF;

  v_fee := ROUND(v_subtotal * v_fee_pct, 2);
  v_after_fee := GREATEST(0, v_subtotal - v_fee);
  IF v_after_fee <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'amount', 0);
  END IF;

  PERFORM public.credit_vendor_receipt(v_vendor_id, v_after_fee, 'Customer payment (order ' || p_order_id::text || ')');

  UPDATE public.customer_orders
  SET vendor_receipt_credited_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'vendor_id', v_vendor_id, 'amount', v_after_fee);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_vendor_receipt_from_order(UUID) TO service_role;

-- 4) RPC: record platform revenue (₹5) when online order is paid — called from verify-cca-payment
CREATE OR REPLACE FUNCTION public.record_platform_revenue_from_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount DECIMAL(12,2);
  v_is_online BOOLEAN;
BEGIN
  IF p_order_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid order');
  END IF;

  SELECT platform_fee_amount, is_online
  INTO v_amount, v_is_online
  FROM public.customer_orders
  WHERE id = p_order_id AND status = 'paid';

  IF v_amount IS NULL OR v_amount <= 0 OR COALESCE(v_is_online, false) = false THEN
    RETURN jsonb_build_object('ok', true, 'recorded', 0);
  END IF;

  IF EXISTS (SELECT 1 FROM public.platform_revenue WHERE order_id = p_order_id AND source = 'online_order') THEN
    RETURN jsonb_build_object('ok', true, 'already_recorded', true);
  END IF;

  INSERT INTO public.platform_revenue (order_id, amount, source)
  VALUES (p_order_id, v_amount, 'online_order');

  RETURN jsonb_build_object('ok', true, 'recorded', v_amount);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_platform_revenue_from_order(UUID) TO service_role;

-- 5) get_order_receipt: return subtotal, delivery_fee_amount, platform_fee_amount for invoice breakdown
-- Must DROP first because return type (OUT params) changed.
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
         COALESCE(o.total, 0) AS total
  FROM customer_orders o
  LEFT JOIN profiles p ON p.id = o.vendor_id
  WHERE o.id = p_order_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_receipt(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_order_receipt(UUID) TO authenticated;

-- 6) orders (catalog/supply): add platform_fee_amount for Cart online orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS platform_fee_amount DECIMAL(12,2) NOT NULL DEFAULT 0;

-- 7) RPC: record platform revenue from paid catalog order (Cart flow)
CREATE OR REPLACE FUNCTION public.record_platform_revenue_from_catalog_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount DECIMAL(12,2);
BEGIN
  IF p_order_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid order');
  END IF;

  SELECT platform_fee_amount INTO v_amount
  FROM public.orders
  WHERE id = p_order_id AND status = 'paid';

  IF v_amount IS NULL OR v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'recorded', 0);
  END IF;

  IF EXISTS (SELECT 1 FROM public.platform_revenue WHERE order_id = p_order_id AND source = 'catalog_order') THEN
    RETURN jsonb_build_object('ok', true, 'already_recorded', true);
  END IF;

  INSERT INTO public.platform_revenue (order_id, amount, source)
  VALUES (p_order_id, v_amount, 'catalog_order');

  RETURN jsonb_build_object('ok', true, 'recorded', v_amount);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_platform_revenue_from_catalog_order(UUID) TO service_role;
