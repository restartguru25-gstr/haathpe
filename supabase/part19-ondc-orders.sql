-- VendorHub: ONDC order receiving + 3% platform fee + instant settlement
-- Run AFTER part18. Adds ondc_orders, platform_fee_config, vendor_payouts.

-- 1) Platform fee config (admin-editable, default 3%)
CREATE TABLE IF NOT EXISTS public.platform_fee_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_percent DECIMAL(5,2) NOT NULL DEFAULT 3.00 CHECK (fee_percent >= 0 AND fee_percent <= 100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.platform_fee_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read platform_fee_config" ON public.platform_fee_config;
CREATE POLICY "Anyone can read platform_fee_config" ON public.platform_fee_config FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage platform_fee_config" ON public.platform_fee_config;
CREATE POLICY "Admins manage platform_fee_config" ON public.platform_fee_config FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 2) ONDC orders (from PhonePe, Paytm, etc.)
CREATE TABLE IF NOT EXISTS public.ondc_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ondc_transaction_id TEXT UNIQUE,
  vendor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  items JSONB NOT NULL DEFAULT '[]',
  total DECIMAL(12,2) NOT NULL,
  platform_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
  vendor_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  razorpay_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
  buyer_app TEXT,
  buyer_name TEXT,
  buyer_phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'prepared', 'ready', 'delivered', 'cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  payout_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ondc_orders_vendor ON public.ondc_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_ondc_orders_razorpay ON public.ondc_orders(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_ondc_orders_transaction ON public.ondc_orders(ondc_transaction_id);

ALTER TABLE public.ondc_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Vendor can view own ondc_orders" ON public.ondc_orders;
CREATE POLICY "Vendor can view own ondc_orders" ON public.ondc_orders FOR SELECT USING (auth.uid() = vendor_id);
-- Edge functions use service_role key (bypasses RLS) for insert/update
DROP POLICY IF EXISTS "Admins can view all ondc_orders" ON public.ondc_orders;
CREATE POLICY "Admins can view all ondc_orders" ON public.ondc_orders FOR SELECT USING (public.is_admin());

-- 3) Vendor payouts (instant settlement audit - extends payouts concept)
CREATE TABLE IF NOT EXISTS public.vendor_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  ondc_order_id UUID REFERENCES public.ondc_orders(id) ON DELETE SET NULL,
  razorpay_payout_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_payouts_vendor ON public.vendor_payouts(vendor_id);

ALTER TABLE public.vendor_payouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Vendor can view own vendor_payouts" ON public.vendor_payouts;
CREATE POLICY "Vendor can view own vendor_payouts" ON public.vendor_payouts FOR SELECT USING (auth.uid() = vendor_id);
-- Edge functions use service_role for insert/update
DROP POLICY IF EXISTS "Admins can manage vendor_payouts" ON public.vendor_payouts;
CREATE POLICY "Admins can manage vendor_payouts" ON public.vendor_payouts FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 4) Seed platform_fee_config (single row)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.platform_fee_config LIMIT 1) THEN
    INSERT INTO public.platform_fee_config (fee_percent) VALUES (3.00);
  END IF;
END $$;

-- 5) Vendor UPI for instant payout
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS upi_id TEXT;
COMMENT ON COLUMN public.profiles.upi_id IS 'Vendor UPI ID (e.g. merchant@upi) for RazorpayX instant payout';

COMMENT ON TABLE public.ondc_orders IS 'Orders received from ONDC buyer apps (PhonePe, Paytm). 3% platform fee deducted.';
COMMENT ON TABLE public.vendor_payouts IS 'Instant settlement to vendors after ONDC order payment.';
