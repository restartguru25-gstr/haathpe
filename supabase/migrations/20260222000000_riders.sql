-- Riders (2/3/4-wheeler partners): signup, QR scans, monthly rental, withdrawals

-- 1) riders table
CREATE TABLE IF NOT EXISTS public.riders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('2-wheelers', '3-wheelers', '4-wheelers')),
  qr_code_text TEXT NOT NULL UNIQUE,
  verified BOOLEAN NOT NULL DEFAULT false,
  balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  secure_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_riders_phone ON public.riders(phone);
CREATE INDEX IF NOT EXISTS idx_riders_auth_user ON public.riders(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_riders_qr ON public.riders(qr_code_text);

ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;

-- Riders can read/update own row (by auth_user_id)
DROP POLICY IF EXISTS "Riders read own" ON public.riders;
CREATE POLICY "Riders read own" ON public.riders FOR SELECT
  USING (auth.uid() = auth_user_id);
DROP POLICY IF EXISTS "Riders update own" ON public.riders;
CREATE POLICY "Riders update own" ON public.riders FOR UPDATE
  USING (auth.uid() = auth_user_id) WITH CHECK (auth.uid() = auth_user_id);

-- Service role / admin can do anything (via service key or admin RPCs)
DROP POLICY IF EXISTS "Allow anon insert for signup" ON public.riders;
CREATE POLICY "Allow anon insert for signup" ON public.riders FOR INSERT WITH CHECK (true);
-- Allow authenticated insert so after OTP we can insert with auth_user_id
DROP POLICY IF EXISTS "Authenticated insert rider" ON public.riders;
CREATE POLICY "Authenticated insert rider" ON public.riders FOR INSERT WITH CHECK (auth.uid() = auth_user_id);

-- 2) rider_settings (admin config: base_rental, bonus_percent, min_withdrawal per vehicle_type)
CREATE TABLE IF NOT EXISTS public.rider_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_type TEXT NOT NULL UNIQUE CHECK (vehicle_type IN ('2-wheelers', '3-wheelers', '4-wheelers')),
  base_rental DECIMAL(10,2) NOT NULL,
  bonus_percent DECIMAL(5,2) NOT NULL DEFAULT 20,
  min_withdrawal DECIMAL(10,2) NOT NULL DEFAULT 499,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.rider_settings (vehicle_type, base_rental, bonus_percent, min_withdrawal)
VALUES
  ('2-wheelers', 75, 20, 499),
  ('3-wheelers', 99, 20, 499),
  ('4-wheelers', 99, 20, 499)
ON CONFLICT (vehicle_type) DO NOTHING;

ALTER TABLE public.rider_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone read rider_settings" ON public.rider_settings;
CREATE POLICY "Anyone read rider_settings" ON public.rider_settings FOR SELECT USING (true);

-- 3) rider_transactions (credits, withdrawals)
CREATE TABLE IF NOT EXISTS public.rider_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES public.riders(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('rental_credit', 'withdrawal', 'adjustment')),
  amount DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2),
  description TEXT,
  month_key TEXT,
  scans_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rider_transactions_rider ON public.rider_transactions(rider_id);
CREATE INDEX IF NOT EXISTS idx_rider_transactions_created ON public.rider_transactions(rider_id, created_at DESC);

ALTER TABLE public.rider_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Riders read own transactions" ON public.rider_transactions;
CREATE POLICY "Riders read own transactions" ON public.rider_transactions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.riders r WHERE r.id = rider_id AND r.auth_user_id = auth.uid()));

-- 4) Add rider_id to customer_orders (track scans from rider QR)
ALTER TABLE public.customer_orders
  ADD COLUMN IF NOT EXISTS rider_id UUID REFERENCES public.riders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customer_orders_rider ON public.customer_orders(rider_id);

-- 5) RPC: get rider by auth user (for dashboard)
CREATE OR REPLACE FUNCTION public.get_rider_by_auth()
RETURNS SETOF public.riders
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT * FROM public.riders WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_rider_by_auth() TO authenticated;

-- 6) RPC: rider signup (upsert after OTP: link auth_user_id, set phone, vehicle_type, qr_code_text)
CREATE OR REPLACE FUNCTION public.upsert_rider_after_signup(
  p_phone TEXT,
  p_vehicle_type TEXT,
  p_qr_code_text TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_rider_id UUID;
  v_qr TEXT;
  v_exists BOOLEAN;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  SELECT id INTO v_rider_id FROM public.riders WHERE auth_user_id = v_uid LIMIT 1;
  IF v_rider_id IS NOT NULL THEN
    UPDATE public.riders SET phone = p_phone, vehicle_type = p_vehicle_type, updated_at = NOW() WHERE id = v_rider_id;
    RETURN jsonb_build_object('ok', true, 'rider_id', v_rider_id, 'is_new', false);
  END IF;
  v_qr := COALESCE(NULLIF(TRIM(p_qr_code_text), ''), gen_random_uuid()::TEXT);
  INSERT INTO public.riders (auth_user_id, phone, vehicle_type, qr_code_text, verified, updated_at)
  VALUES (v_uid, p_phone, p_vehicle_type, v_qr, false, NOW())
  RETURNING id INTO v_rider_id;
  RETURN jsonb_build_object('ok', true, 'rider_id', v_rider_id, 'is_new', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_rider_after_signup(TEXT, TEXT, TEXT) TO authenticated;

-- 7) RPC: count rider scans in a month (for monthly payout)
CREATE OR REPLACE FUNCTION public.get_rider_scans_count(p_rider_id UUID, p_month_key TEXT)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COUNT(*)::INTEGER FROM public.customer_orders
  WHERE rider_id = p_rider_id
    AND to_char(created_at, 'YYYY-MM') = p_month_key;
$$;

-- 8) RPC: run monthly rental for one rider (base + bonus, cap 150, credit balance, insert transaction)
CREATE OR REPLACE FUNCTION public.run_rider_monthly_rental(
  p_rider_id UUID,
  p_month_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rider RECORD;
  v_settings RECORD;
  v_scans INTEGER;
  v_base DECIMAL(12,2);
  v_bonus_pct DECIMAL(5,2);
  v_amount DECIMAL(12,2);
  v_cap DECIMAL(12,2) := 150;
  v_new_balance DECIMAL(12,2);
  v_already BOOLEAN;
BEGIN
  SELECT * INTO v_rider FROM public.riders WHERE id = p_rider_id;
  IF v_rider IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Rider not found');
  END IF;
  SELECT * INTO v_settings FROM public.rider_settings WHERE vehicle_type = v_rider.vehicle_type LIMIT 1;
  IF v_settings IS NULL THEN
    v_base := 75;
    v_bonus_pct := 20;
  ELSE
    v_base := v_settings.base_rental;
    v_bonus_pct := v_settings.bonus_percent;
  END IF;
  SELECT get_rider_scans_count(p_rider_id, p_month_key) INTO v_scans;
  v_amount := v_base;
  IF v_scans >= 50 THEN
    v_amount := v_base * (1 + v_bonus_pct / 100);
  END IF;
  IF v_amount > v_cap THEN
    v_amount := v_cap;
  END IF;
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'credited', 0, 'message', 'No credit');
  END IF;
  SELECT EXISTS (SELECT 1 FROM public.rider_transactions WHERE rider_id = p_rider_id AND type = 'rental_credit' AND month_key = p_month_key) INTO v_already;
  IF v_already THEN
    RETURN jsonb_build_object('ok', true, 'credited', 0, 'message', 'Already credited for this month');
  END IF;
  UPDATE public.riders SET balance = balance + v_amount, updated_at = NOW() WHERE id = p_rider_id RETURNING balance INTO v_new_balance;
  INSERT INTO public.rider_transactions (rider_id, type, amount, balance_after, description, month_key, scans_count)
  VALUES (p_rider_id, 'rental_credit', v_amount, v_new_balance, 'Monthly rental ' || p_month_key, p_month_key, v_scans);
  RETURN jsonb_build_object('ok', true, 'credited', v_amount, 'scans', v_scans, 'balance_after', v_new_balance);
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_rider_monthly_rental(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_rider_monthly_rental(UUID, TEXT) TO service_role;

-- 9) RPC: admin list riders
CREATE OR REPLACE FUNCTION public.get_admin_riders(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
  id UUID,
  phone TEXT,
  vehicle_type TEXT,
  qr_code_text TEXT,
  verified BOOLEAN,
  balance DECIMAL,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT r.id, r.phone, r.vehicle_type, r.qr_code_text, r.verified, r.balance, r.created_at
  FROM public.riders r
  ORDER BY r.created_at DESC
  LIMIT p_limit;
$$;

-- 10) RPC: admin approve rider (set verified = true)
CREATE OR REPLACE FUNCTION public.admin_set_rider_verified(p_rider_id UUID, p_verified BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.riders SET verified = p_verified, updated_at = NOW() WHERE id = p_rider_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Rider not found');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_riders(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_rider_verified(UUID, BOOLEAN) TO authenticated;

-- 11) RPC: admin run monthly payout for all riders (current month)
CREATE OR REPLACE FUNCTION public.admin_run_rider_monthly_payout(p_month_key TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month TEXT;
  v_r RECORD;
  v_result JSONB;
  v_total INTEGER := 0;
  v_credited INTEGER := 0;
BEGIN
  v_month := COALESCE(NULLIF(TRIM(p_month_key), ''), to_char(NOW(), 'YYYY-MM'));
  FOR v_r IN SELECT id FROM public.riders
  LOOP
    v_total := v_total + 1;
    v_result := run_rider_monthly_rental(v_r.id, v_month);
    IF (v_result->>'credited')::DECIMAL > 0 THEN
      v_credited := v_credited + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'month', v_month, 'riders_processed', v_total, 'riders_credited', v_credited);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_run_rider_monthly_payout(TEXT) TO authenticated;

-- 12) RPC: rider withdrawal request (creates transaction, deducts balance; admin processes externally)
CREATE OR REPLACE FUNCTION public.rider_request_withdrawal(p_rider_id UUID, p_amount DECIMAL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rider RECORD;
  v_settings RECORD;
  v_min DECIMAL(12,2);
  v_new_balance DECIMAL(12,2);
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  SELECT * INTO v_rider FROM public.riders WHERE id = p_rider_id AND auth_user_id = auth.uid();
  IF v_rider IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Rider not found');
  END IF;
  SELECT min_withdrawal INTO v_min FROM public.rider_settings WHERE vehicle_type = v_rider.vehicle_type LIMIT 1;
  v_min := COALESCE(v_min, 499);
  IF v_rider.balance < v_min OR p_amount < v_min OR p_amount > v_rider.balance THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Balance too low or invalid amount. Min withdrawal ₹' || v_min);
  END IF;
  v_new_balance := v_rider.balance - p_amount;
  UPDATE public.riders SET balance = v_new_balance, updated_at = NOW() WHERE id = p_rider_id;
  INSERT INTO public.rider_transactions (rider_id, type, amount, balance_after, description)
  VALUES (p_rider_id, 'withdrawal', -p_amount, v_new_balance, 'Withdrawal request ₹' || p_amount);
  RETURN jsonb_build_object('ok', true, 'balance_after', v_new_balance);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rider_request_withdrawal(UUID, DECIMAL) TO authenticated;

-- 13) Admin policy for rider_settings (update by admin only via RPC or service)
-- RLS: only service_role can update rider_settings; app will use service key or an admin RPC
DROP POLICY IF EXISTS "Admin update rider_settings" ON public.rider_settings;
CREATE POLICY "Admin update rider_settings" ON public.rider_settings FOR ALL USING (false) WITH CHECK (false);
-- Allow service_role to manage (by default service_role bypasses RLS in Supabase)
-- For app: create an RPC that updates rider_settings, callable only by admin users (check in app or via custom claim)
CREATE OR REPLACE FUNCTION public.admin_update_rider_settings(
  p_vehicle_type TEXT,
  p_base_rental DECIMAL DEFAULT NULL,
  p_bonus_percent DECIMAL DEFAULT NULL,
  p_min_withdrawal DECIMAL DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.rider_settings
  SET base_rental = COALESCE(p_base_rental, base_rental),
      bonus_percent = COALESCE(p_bonus_percent, bonus_percent),
      min_withdrawal = COALESCE(p_min_withdrawal, min_withdrawal),
      updated_at = NOW()
  WHERE vehicle_type = p_vehicle_type;
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_rider_settings(TEXT, DECIMAL, DECIMAL, DECIMAL) TO authenticated;

COMMENT ON TABLE public.riders IS 'Delivery/ride partners (2/3/4-wheelers) with monthly rental and QR scan tracking';
COMMENT ON TABLE public.rider_settings IS 'Admin config: base_rental, bonus_percent, min_withdrawal per vehicle_type';
