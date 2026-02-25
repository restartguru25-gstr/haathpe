-- Rental Income: vendor_rental_payouts table for monthly incentive payouts (DOCILE ONLINE MART PRIVATE LIMITED / haathpe).
-- Run in Supabase SQL Editor. Volume is computed from customer_orders (status=paid); admin marks payout as paid.

CREATE TABLE IF NOT EXISTS public.vendor_rental_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month TEXT NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  transaction_volume DECIMAL(12,2) NOT NULL DEFAULT 0,
  incentive_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(vendor_id, month)
);

CREATE INDEX IF NOT EXISTS idx_vendor_rental_payouts_vendor_month ON public.vendor_rental_payouts(vendor_id, month);

ALTER TABLE public.vendor_rental_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendors can view own rental payouts" ON public.vendor_rental_payouts;
CREATE POLICY "Vendors can view own rental payouts" ON public.vendor_rental_payouts
  FOR SELECT USING (auth.uid() = vendor_id);

DROP POLICY IF EXISTS "Admins can manage rental payouts" ON public.vendor_rental_payouts;
CREATE POLICY "Admins can manage rental payouts" ON public.vendor_rental_payouts
  FOR ALL USING (public.is_admin());

COMMENT ON TABLE public.vendor_rental_payouts IS 'Rental Income monthly payouts; admin marks paid after UPI transfer.';
