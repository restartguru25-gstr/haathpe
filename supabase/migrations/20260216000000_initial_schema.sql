-- VendorHub initial schema
-- Run in Supabase SQL Editor or via supabase db push

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT,
  name TEXT,
  stall_type TEXT,
  stall_address TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'hi', 'te')),
  photo_url TEXT,
  credit_limit INTEGER NOT NULL DEFAULT 0,
  credit_used INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'Bronze' CHECK (tier IN ('Bronze', 'Silver', 'Gold')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies: users can read/update own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Orders
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in-transit', 'delivered')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Purchases daily (for streak tracking)
CREATE TABLE IF NOT EXISTS public.purchases_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purchase_date DATE NOT NULL,
  total_amount INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, purchase_date)
);

ALTER TABLE public.purchases_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own purchases"
  ON public.purchases_daily FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own purchases"
  ON public.purchases_daily FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Loyalty points
CREATE TABLE IF NOT EXISTS public.loyalty_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  points INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own loyalty points"
  ON public.loyalty_points FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own loyalty points"
  ON public.loyalty_points FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own loyalty points"
  ON public.loyalty_points FOR UPDATE
  USING (auth.uid() = user_id);

-- Draws entries (for daily draws)
CREATE TABLE IF NOT EXISTS public.draws_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  draw_date DATE NOT NULL,
  eligible BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(user_id, draw_date)
);

ALTER TABLE public.draws_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own draws entries"
  ON public.draws_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own draws entries"
  ON public.draws_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Trigger: update profiles.updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
