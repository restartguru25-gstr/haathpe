-- Fix: "new row violates row-level security policy for table customer_orders"
-- Guests (anon) must be able to create customer orders from QR/menu without login.
-- We allow INSERT only for pending orders; paying/marking paid is done server-side by Edge Function.

ALTER TABLE public.customer_orders ENABLE ROW LEVEL SECURITY;

-- Ensure PostgREST roles have table privileges (policies alone are not enough).
GRANT INSERT, SELECT ON TABLE public.customer_orders TO anon;
GRANT INSERT, SELECT ON TABLE public.customer_orders TO authenticated;

DROP POLICY IF EXISTS "Anyone can insert customer_orders" ON public.customer_orders;
DROP POLICY IF EXISTS "Public can insert pending customer_orders" ON public.customer_orders;

CREATE POLICY "Public can insert pending customer_orders"
  ON public.customer_orders
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    vendor_id IS NOT NULL
    AND status = 'pending'
    AND total IS NOT NULL
    AND total > 0
  );

