-- VendorHub: incentive logic (run AFTER part 1 and part 2)
-- Call these RPCs from the app after placing an order.

-- 1) Add today's order total to purchases_daily (upsert by user + date)
CREATE OR REPLACE FUNCTION public.upsert_purchase_today(p_user_id UUID, p_amount INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.purchases_daily (user_id, purchase_date, total_amount)
  VALUES (p_user_id, CURRENT_DATE, p_amount)
  ON CONFLICT (user_id, purchase_date)
  DO UPDATE SET total_amount = public.purchases_daily.total_amount + EXCLUDED.total_amount;
END;
$$;

-- 2) Add loyalty points (1 point per ₹100); creates row if missing
CREATE OR REPLACE FUNCTION public.add_loyalty_points(p_user_id UUID, p_points INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.loyalty_points (user_id, points, updated_at)
  VALUES (p_user_id, GREATEST(0, p_points), NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET
    points = public.loyalty_points.points + GREATEST(0, p_points),
    updated_at = NOW();
END;
$$;

-- 3) Recompute streak (last 30 days), sync points/tier/credit_limit to profiles
CREATE OR REPLACE FUNCTION public.refresh_profile_incentives(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_streak INTEGER;
  v_points INTEGER;
  v_tier TEXT;
  v_credit_limit INTEGER;
BEGIN
  SELECT COUNT(DISTINCT purchase_date)::INTEGER
  INTO v_streak
  FROM public.purchases_daily
  WHERE user_id = p_user_id
    AND purchase_date >= (CURRENT_DATE - INTERVAL '30 days');

  SELECT COALESCE(points, 0)
  INTO v_points
  FROM public.loyalty_points
  WHERE user_id = p_user_id;

  v_tier := CASE
    WHEN COALESCE(v_points, 0) >= 2000 THEN 'Gold'
    WHEN COALESCE(v_points, 0) >= 500 THEN 'Silver'
    ELSE 'Bronze'
  END;

  v_credit_limit := CASE
    WHEN v_streak >= 30 THEN 5000
    WHEN v_streak >= 20 THEN 3000
    WHEN v_streak >= 10 THEN 1000
    ELSE 0
  END;

  UPDATE public.profiles
  SET
    streak = COALESCE(v_streak, 0),
    points = COALESCE(v_points, 0),
    tier = v_tier,
    credit_limit = v_credit_limit,
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

-- Allow authenticated users to call these (they pass their own user_id; functions only touch that user)
GRANT EXECUTE ON FUNCTION public.upsert_purchase_today(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_loyalty_points(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_profile_incentives(UUID) TO authenticated;
