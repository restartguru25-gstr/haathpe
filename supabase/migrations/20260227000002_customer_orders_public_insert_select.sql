-- Comprehensive public access (as requested):
-- 1) Allow anon INSERT into customer_orders with WITH CHECK (true)
-- 2) Allow anon SELECT from customer_orders (public tracking)
--
-- WARNING: This is permissive. Use only if you accept public read/write exposure.

ALTER TABLE public.customer_orders ENABLE ROW LEVEL SECURITY;

GRANT INSERT, SELECT ON TABLE public.customer_orders TO anon;
GRANT INSERT, SELECT ON TABLE public.customer_orders TO authenticated;

DROP POLICY IF EXISTS "Anyone can insert customer_orders" ON public.customer_orders;
DROP POLICY IF EXISTS "Public can insert pending customer_orders" ON public.customer_orders;
DROP POLICY IF EXISTS "Public can insert customer_orders (permissive)" ON public.customer_orders;
DROP POLICY IF EXISTS "Public can read customer_orders" ON public.customer_orders;

CREATE POLICY "Public can insert customer_orders (permissive)"
  ON public.customer_orders
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Public can read customer_orders"
  ON public.customer_orders
  FOR SELECT
  TO anon, authenticated
  USING (true);

