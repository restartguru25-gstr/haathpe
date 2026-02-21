-- Fix: "new row violates row-level security policy for table customer_orders"
-- PayDirect and PublicMenu create customer_orders as guests (no auth). Ensure INSERT is allowed.
-- Part15 adds this; if migrations ran in different order or part15 wasn't applied, insert fails.

DROP POLICY IF EXISTS "Anyone can insert customer_orders" ON public.customer_orders;
CREATE POLICY "Anyone can insert customer_orders" ON public.customer_orders
  FOR INSERT
  WITH CHECK (true);
