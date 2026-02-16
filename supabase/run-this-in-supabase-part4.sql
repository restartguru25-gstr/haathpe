-- VendorHub: admin role, push subscriptions, admin RLS (run AFTER part 1–3)

-- 1) Add role to profiles (vendor | admin)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'vendor' CHECK (role IN ('vendor', 'admin'));

-- 2) Push subscriptions for browser push notifications
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can insert own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can view own push subscriptions"
  ON public.push_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own push subscriptions"
  ON public.push_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own push subscriptions"
  ON public.push_subscriptions FOR DELETE USING (auth.uid() = user_id);

-- 3) Admin: can read all profiles and all orders
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
CREATE POLICY "Admins can view all orders"
  ON public.orders FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can view all order_items" ON public.order_items;
CREATE POLICY "Admins can view all order_items"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- 4) Admin: can update credit_limit and role on any profile (for overrides)
DROP POLICY IF EXISTS "Admins can update any profile credit and role" ON public.profiles;
CREATE POLICY "Admins can update any profile credit and role"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- 5) Admin-only: run daily draw (pick random winner for today, create notification)
CREATE OR REPLACE FUNCTION public.run_daily_draw()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_winner_id UUID;
  v_winner_name TEXT;
  v_draw_date DATE := CURRENT_DATE;
BEGIN
  SELECT id INTO v_admin_id FROM public.profiles WHERE id = auth.uid() AND role = 'admin';
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not admin');
  END IF;

  SELECT user_id INTO v_winner_id
  FROM public.draws_entries
  WHERE draw_date = v_draw_date AND eligible = true
  ORDER BY random()
  LIMIT 1;

  IF v_winner_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No eligible entries for today');
  END IF;

  SELECT name INTO v_winner_name FROM public.profiles WHERE id = v_winner_id;

  INSERT INTO public.notifications (user_id, type, title, body, read)
  VALUES (
    v_winner_id,
    'draw_result',
    'You won today''s draw! 🎉',
    'Congratulations! You have been selected as today''s daily draw winner.',
    false
  );

  RETURN jsonb_build_object(
    'ok', true,
    'winner_id', v_winner_id,
    'winner_name', COALESCE(v_winner_name, 'Vendor')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_daily_draw() TO authenticated;
