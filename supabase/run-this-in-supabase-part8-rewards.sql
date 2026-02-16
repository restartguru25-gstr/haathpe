-- VendorHub: Rewards / point redemptions (run AFTER part7)
-- Adds reward_redemptions table and RPC for all loyalty redemptions (trip, repair_kit, credit_boost, supplies_kit).

-- 1) Reward redemptions (all point redemptions except tree-planting which uses eco_redemptions)
CREATE TABLE IF NOT EXISTS public.reward_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('family_trip', 'repair_kit', 'credit_boost', 'supplies_kit')),
  points_spent INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reward_redemptions_user ON public.reward_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_created ON public.reward_redemptions(created_at DESC);
ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own reward_redemptions" ON public.reward_redemptions;
DROP POLICY IF EXISTS "Users can insert own reward_redemptions" ON public.reward_redemptions;
DROP POLICY IF EXISTS "Admins can view all reward_redemptions" ON public.reward_redemptions;

CREATE POLICY "Users can view own reward_redemptions" ON public.reward_redemptions FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reward_redemptions" ON public.reward_redemptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all reward_redemptions" ON public.reward_redemptions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- 2) RPC: redeem points for a reward (deducts from profiles.points, inserts into reward_redemptions)
CREATE OR REPLACE FUNCTION public.redeem_reward(p_user_id UUID, p_reward_type TEXT, p_points_cost INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points INTEGER;
  v_new_points INTEGER;
BEGIN
  IF p_reward_type NOT IN ('family_trip', 'repair_kit', 'credit_boost', 'supplies_kit') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid reward type');
  END IF;
  IF p_points_cost IS NULL OR p_points_cost <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid points cost');
  END IF;

  SELECT points INTO v_points FROM public.profiles WHERE id = p_user_id;
  IF v_points IS NULL OR v_points < p_points_cost THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not enough points');
  END IF;

  v_new_points := v_points - p_points_cost;
  UPDATE public.profiles SET points = v_new_points WHERE id = p_user_id;
  INSERT INTO public.reward_redemptions (user_id, reward_type, points_spent, status)
  VALUES (p_user_id, p_reward_type, p_points_cost, 'pending');

  RETURN jsonb_build_object('ok', true, 'points_left', v_new_points);
END;
$$;
