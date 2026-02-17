-- VendorHub: Per-vendor platform fee management (ONDC + public menu)
-- Run AFTER part19 (ondc_orders). Adds platform_fees table, order columns, RPC.

-- 1) Per-vendor platform fees (overrides platform_fee_config when set)
CREATE TABLE IF NOT EXISTS public.platform_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fee_type TEXT NOT NULL CHECK (fee_type IN ('percentage', 'fixed', 'slab')),
  fee_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  min_order_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  slabs JSONB DEFAULT NULL,
  is_exempt BOOLEAN NOT NULL DEFAULT false,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(vendor_id)
);

COMMENT ON TABLE public.platform_fees IS 'Per-vendor platform fee config. Overrides platform_fee_config. slabs: [{min_order_value, fee_value}] for fee_type=slab.';
COMMENT ON COLUMN public.platform_fees.slabs IS 'For slab type: array of {min_order_value, fee_value}. Find max min_order_value <= order_total.';

CREATE INDEX IF NOT EXISTS idx_platform_fees_vendor ON public.platform_fees(vendor_id);

ALTER TABLE public.platform_fees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read platform_fees" ON public.platform_fees;
CREATE POLICY "Anyone can read platform_fees" ON public.platform_fees FOR SELECT USING (true);
DROP POLICY IF EXISTS "Vendor can read own platform_fee" ON public.platform_fees;
CREATE POLICY "Vendor can read own platform_fee" ON public.platform_fees FOR SELECT USING (auth.uid() = vendor_id);
DROP POLICY IF EXISTS "Admins manage platform_fees" ON public.platform_fees;
CREATE POLICY "Admins manage platform_fees" ON public.platform_fees FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 2) Add platform_fee and vendor_amount to customer_orders
ALTER TABLE public.customer_orders ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.customer_orders ADD COLUMN IF NOT EXISTS vendor_amount DECIMAL(12,2) NOT NULL DEFAULT 0;

-- 3) ondc_orders already has platform_fee, vendor_amount (from part19)

-- 4) RPC: calculate platform fee for a vendor + order total
CREATE OR REPLACE FUNCTION public.calculate_platform_fee(
  p_vendor_id UUID,
  p_order_total DECIMAL(12,2)
)
RETURNS TABLE (platform_fee DECIMAL(12,2), vendor_amount DECIMAL(12,2))
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fee DECIMAL(12,2) := 0;
  v_pf RECORD;
  v_default_pct DECIMAL(5,2);
  v_slab RECORD;
  v_best_fee DECIMAL(12,2) := 0;
BEGIN
  IF p_order_total IS NULL OR p_order_total <= 0 THEN
    platform_fee := 0;
    vendor_amount := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Check per-vendor override
  SELECT pf.fee_type, pf.fee_value, pf.min_order_value, pf.slabs, pf.is_exempt
  INTO v_pf
  FROM platform_fees pf
  WHERE pf.vendor_id = p_vendor_id
    AND pf.effective_from <= NOW()
  ORDER BY pf.effective_from DESC
  LIMIT 1;

  IF FOUND AND v_pf.is_exempt THEN
    platform_fee := 0;
    vendor_amount := p_order_total;
    RETURN NEXT;
    RETURN;
  END IF;

  IF FOUND THEN
    CASE v_pf.fee_type
      WHEN 'percentage' THEN
        v_fee := ROUND((p_order_total * v_pf.fee_value / 100)::numeric, 2);
      WHEN 'fixed' THEN
        v_fee := v_pf.fee_value;
      WHEN 'slab' THEN
        IF v_pf.slabs IS NOT NULL AND jsonb_array_length(v_pf.slabs) > 0 THEN
          FOR v_slab IN
            SELECT (elem->>'min_order_value')::DECIMAL AS min_val, (elem->>'fee_value')::DECIMAL AS fee_val
            FROM jsonb_array_elements(v_pf.slabs) AS elem
            WHERE (elem->>'min_order_value')::DECIMAL <= p_order_total
          LOOP
            IF v_slab.fee_val > v_best_fee THEN
              v_best_fee := v_slab.fee_val;
            END IF;
          END LOOP;
          v_fee := v_best_fee;
        ELSIF v_pf.min_order_value <= p_order_total THEN
          v_fee := v_pf.fee_value;
        ELSE
          v_fee := 0;
        END IF;
      ELSE
        v_fee := 0;
    END CASE;
  ELSE
    -- Fallback to global default from platform_fee_config
    SELECT COALESCE(fee_percent, 3) INTO v_default_pct
    FROM platform_fee_config
    LIMIT 1;
    v_fee := ROUND((p_order_total * v_default_pct / 100)::numeric, 2);
  END IF;

  v_fee := LEAST(v_fee, p_order_total);
  platform_fee := v_fee;
  vendor_amount := ROUND((p_order_total - v_fee)::numeric, 2);
  RETURN NEXT;
END;
$$;

-- 5) RPC: admin get total platform fee collected this month
CREATE OR REPLACE FUNCTION public.get_platform_fee_summary_this_month()
RETURNS TABLE (total_fee DECIMAL(12,2), order_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT
    COALESCE(SUM(o.platform_fee), 0)::DECIMAL(12,2) AS total_fee,
    COUNT(*)::BIGINT AS order_count
  FROM (
    SELECT platform_fee FROM customer_orders
    WHERE created_at >= date_trunc('month', CURRENT_DATE)
    UNION ALL
    SELECT platform_fee FROM ondc_orders
    WHERE created_at >= date_trunc('month', CURRENT_DATE)
  ) o;
END;
$$;

-- 6) Realtime for platform_fees (vendor notification when admin changes fee)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'platform_fees'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_fees;
  END IF;
END $$;

-- 7) Seed default 3% fee for vendors without a custom fee (one-time; uses platform_fee_config)
-- Vendors without platform_fees row use platform_fee_config default. No need to insert rows;
-- RPC calculate_platform_fee falls back to platform_fee_config. Optional: run bulk "Set default % for all" in Admin.
