-- B2B catalog orders: flat ₹30 Delivery + Hamali + Other, ₹5 Platform Fee. Buyer pays subtotal + 30 + 5.
-- Delivery T+1 (next business day); T+2 in some cases.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_hamali_fee_amount DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS expected_delivery_type TEXT DEFAULT 'T+1';
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_b2b BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.orders.delivery_hamali_fee_amount IS 'B2B catalog: flat ₹30 delivery, loading/unloading (hamali), handling. Platform pays logistics.';
COMMENT ON COLUMN public.orders.expected_delivery_type IS 'T+1 (next day) or T+2 for some areas.';
COMMENT ON COLUMN public.orders.is_b2b IS 'True for catalog/supply orders (vendor buying supplies).';
