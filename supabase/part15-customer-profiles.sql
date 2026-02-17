-- VendorHub: Optional customer login (guest-first, OTP)
-- Run AFTER part6 (sales/pos). Adds customer_profiles, customer_phone on orders, RLS.

-- 1) customer_profiles (id = auth.uid() after phone OTP signup)
CREATE TABLE IF NOT EXISTS public.customer_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL UNIQUE,
  name TEXT,
  favorites JSONB NOT NULL DEFAULT '[]'::jsonb,
  order_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_profiles_phone ON public.customer_profiles(phone);

ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customer can read own profile" ON public.customer_profiles;
CREATE POLICY "Customer can read own profile" ON public.customer_profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Customer can insert own profile" ON public.customer_profiles;
CREATE POLICY "Customer can insert own profile" ON public.customer_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Customer can update own profile" ON public.customer_profiles;
CREATE POLICY "Customer can update own profile" ON public.customer_profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 2) Add customer_phone to customer_orders (link order to customer for history)
ALTER TABLE public.customer_orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;

CREATE INDEX IF NOT EXISTS idx_customer_orders_customer_phone ON public.customer_orders(customer_phone);

-- 3) Allow anyone to insert customer_orders (guest + logged-in customer checkout)
DROP POLICY IF EXISTS "Anyone can insert customer_orders" ON public.customer_orders;
CREATE POLICY "Anyone can insert customer_orders" ON public.customer_orders
  FOR INSERT WITH CHECK (true);

-- 4) Customer can read own orders (by phone)
DROP POLICY IF EXISTS "Customer can read own orders by phone" ON public.customer_orders;
CREATE POLICY "Customer can read own orders by phone" ON public.customer_orders
  FOR SELECT USING (
    customer_phone IS NOT NULL
    AND customer_phone = (SELECT phone FROM public.customer_profiles WHERE id = auth.uid())
  );
