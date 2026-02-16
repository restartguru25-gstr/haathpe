-- VendorHub: Community Marketplace (Vendor Swap), Eco-Perks, SVANidhi stub
-- Run AFTER part1–part6. Adds vendor_swaps, swap_ratings, eco tracking, green_score.

-- 1) Vendor Swap (excess stock peer-to-peer)
CREATE TABLE IF NOT EXISTS public.vendor_swaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price_notes TEXT NOT NULL,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_swaps_vendor ON public.vendor_swaps(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_swaps_status ON public.vendor_swaps(status);
ALTER TABLE public.vendor_swaps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendor can manage own swaps" ON public.vendor_swaps;
CREATE POLICY "Vendor can manage own swaps" ON public.vendor_swaps FOR ALL
  USING (auth.uid() = vendor_id) WITH CHECK (auth.uid() = vendor_id);
DROP POLICY IF EXISTS "Anyone can read approved swaps" ON public.vendor_swaps;
CREATE POLICY "Anyone can read approved swaps" ON public.vendor_swaps FOR SELECT
  USING (status = 'approved');
DROP POLICY IF EXISTS "Admins can view and moderate swaps" ON public.vendor_swaps;
CREATE POLICY "Admins can view and moderate swaps" ON public.vendor_swaps FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- 2) Swap ratings/reviews
CREATE TABLE IF NOT EXISTS public.swap_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  swap_id UUID NOT NULL REFERENCES public.vendor_swaps(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(swap_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_swap_ratings_swap ON public.swap_ratings(swap_id);
ALTER TABLE public.swap_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can add rating" ON public.swap_ratings;
CREATE POLICY "Anyone authenticated can add rating" ON public.swap_ratings FOR INSERT
  WITH CHECK (auth.uid() = reviewer_id);
DROP POLICY IF EXISTS "Anyone can read ratings for approved swaps" ON public.swap_ratings;
CREATE POLICY "Anyone can read ratings for approved swaps" ON public.swap_ratings FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.vendor_swaps s WHERE s.id = swap_id AND s.status = 'approved')
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
DROP POLICY IF EXISTS "Reviewer can update own rating" ON public.swap_ratings;
CREATE POLICY "Reviewer can update own rating" ON public.swap_ratings FOR UPDATE
  USING (auth.uid() = reviewer_id) WITH CHECK (auth.uid() = reviewer_id);

-- 3) Eco tracking: add eco_flag to orders (eco-disposables / low-waste order)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS eco_flag BOOLEAN NOT NULL DEFAULT false;

-- 4) Green Score on profiles (eco purchases + low-waste sales boost score)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS green_score INTEGER NOT NULL DEFAULT 0;

-- 5) Eco redemptions (e.g. tree-planting via NGO tie-up)
CREATE TABLE IF NOT EXISTS public.eco_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redemption_type TEXT NOT NULL DEFAULT 'tree_planting',
  points_spent INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eco_redemptions_user ON public.eco_redemptions(user_id);
ALTER TABLE public.eco_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own eco_redemptions" ON public.eco_redemptions;
CREATE POLICY "Users can view own eco_redemptions" ON public.eco_redemptions FOR SELECT
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own eco_redemptions" ON public.eco_redemptions;
CREATE POLICY "Users can insert own eco_redemptions" ON public.eco_redemptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can view all eco_redemptions" ON public.eco_redemptions;
CREATE POLICY "Admins can view all eco_redemptions" ON public.eco_redemptions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- 6) RPC: increment green_score (e.g. when order has eco_flag)
CREATE OR REPLACE FUNCTION public.increment_green_score(p_user_id UUID, p_delta INTEGER DEFAULT 10)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET green_score = COALESCE(green_score, 0) + p_delta
  WHERE id = p_user_id;
END;
$$;

-- 7) RPC: redeem points for tree-planting (e.g. 100 points = 1 tree via Grow-Trees tie-up)
CREATE OR REPLACE FUNCTION public.redeem_tree_planting(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points INTEGER;
  v_cost INTEGER := 100;
  v_new_points INTEGER;
BEGIN
  SELECT points INTO v_points FROM public.profiles WHERE id = p_user_id;
  IF v_points IS NULL OR v_points < v_cost THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not enough points');
  END IF;
  v_new_points := v_points - v_cost;
  UPDATE public.profiles SET points = v_new_points WHERE id = p_user_id;
  INSERT INTO public.eco_redemptions (user_id, redemption_type, points_spent)
  VALUES (p_user_id, 'tree_planting', v_cost);
  RETURN jsonb_build_object('ok', true, 'points_left', v_new_points);
END;
$$;
