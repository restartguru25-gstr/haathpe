-- Vendor cash wallet system: signup bonus, rewards, withdrawals
-- Admin-configurable signup_bonus_amount and min_withdrawal_amount

-- 1) vendor_cash_wallets
CREATE TABLE IF NOT EXISTS public.vendor_cash_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_cash_wallets_vendor_id ON public.vendor_cash_wallets(vendor_id);

ALTER TABLE public.vendor_cash_wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendor can read own wallet" ON public.vendor_cash_wallets;
CREATE POLICY "Vendor can read own wallet" ON public.vendor_cash_wallets
  FOR SELECT USING (auth.uid() = vendor_id);

-- Admin needs to read for withdrawal approval (via service role or separate policy)
DROP POLICY IF EXISTS "Service role can manage vendor_cash_wallets" ON public.vendor_cash_wallets;
-- Writes done via SECURITY DEFINER RPCs; no direct insert/update policy for vendor

-- 2) vendor_cash_transactions
CREATE TABLE IF NOT EXISTS public.vendor_cash_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('credit','debit','withdrawal_request')),
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success','pending','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_cash_transactions_vendor_id ON public.vendor_cash_transactions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_cash_transactions_created_at ON public.vendor_cash_transactions(created_at DESC);

ALTER TABLE public.vendor_cash_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendor can read own transactions" ON public.vendor_cash_transactions;
CREATE POLICY "Vendor can read own transactions" ON public.vendor_cash_transactions
  FOR SELECT USING (auth.uid() = vendor_id);

-- 3) vendor_settings (single row, admin-configurable)
CREATE TABLE IF NOT EXISTS public.vendor_settings (
  id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  signup_bonus_amount DECIMAL(12,2) NOT NULL DEFAULT 99,
  min_withdrawal_amount DECIMAL(12,2) NOT NULL DEFAULT 499,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.vendor_settings (id, signup_bonus_amount, min_withdrawal_amount)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 99, 499)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.vendor_settings ENABLE ROW LEVEL SECURITY;

-- Admin can read/write vendor_settings (authenticated with admin role - use service role in admin operations)
DROP POLICY IF EXISTS "Allow read vendor_settings for authenticated" ON public.vendor_settings;
CREATE POLICY "Allow read vendor_settings for authenticated" ON public.vendor_settings
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow update vendor_settings for authenticated" ON public.vendor_settings;
CREATE POLICY "Allow update vendor_settings for authenticated" ON public.vendor_settings
  FOR UPDATE USING (auth.role() = 'authenticated');

-- 4) RPC: ensure vendor wallet with signup bonus (idempotent, called on first profile activation)
CREATE OR REPLACE FUNCTION public.ensure_vendor_cash_wallet_with_signup_bonus(p_vendor_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bonus DECIMAL(12,2);
  v_exists BOOLEAN;
BEGIN
  IF p_vendor_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid vendor_id');
  END IF;
  SELECT signup_bonus_amount INTO v_bonus FROM public.vendor_settings ORDER BY id LIMIT 1;
  v_bonus := COALESCE(v_bonus, 99);
  SELECT EXISTS(SELECT 1 FROM public.vendor_cash_wallets WHERE vendor_id = p_vendor_id) INTO v_exists;
  IF v_exists THEN
    RETURN jsonb_build_object('ok', true, 'already_exists', true);
  END IF;
  INSERT INTO public.vendor_cash_wallets (vendor_id, balance, updated_at)
  VALUES (p_vendor_id, v_bonus, NOW());
  INSERT INTO public.vendor_cash_transactions (vendor_id, type, amount, description, status)
  VALUES (p_vendor_id, 'credit', v_bonus, 'Signup Bonus', 'success');
  RETURN jsonb_build_object('ok', true, 'bonus_awarded', v_bonus);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', true, 'already_exists', true);
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_vendor_cash_wallet_with_signup_bonus(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_vendor_cash_wallet_with_signup_bonus(UUID) TO service_role;

-- 5) RPC: credit reward to vendor wallet
CREATE OR REPLACE FUNCTION public.credit_vendor_cash_wallet(
  p_vendor_id UUID,
  p_amount DECIMAL,
  p_description TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance DECIMAL(12,2);
BEGIN
  IF p_vendor_id IS NULL OR p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid params');
  END IF;
  INSERT INTO public.vendor_cash_wallets (vendor_id, balance)
  VALUES (p_vendor_id, 0)
  ON CONFLICT (vendor_id) DO NOTHING;
  UPDATE public.vendor_cash_wallets
  SET balance = balance + p_amount, updated_at = NOW()
  WHERE vendor_id = p_vendor_id
  RETURNING balance INTO v_new_balance;
  INSERT INTO public.vendor_cash_transactions (vendor_id, type, amount, description, status)
  VALUES (p_vendor_id, 'credit', p_amount, COALESCE(p_description, 'Reward'), 'success');
  RETURN jsonb_build_object('ok', true, 'new_balance', v_new_balance);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_vendor_cash_wallet(UUID, DECIMAL, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.credit_vendor_cash_wallet(UUID, DECIMAL, TEXT) TO service_role;

-- 6) RPC: request withdrawal (stub - inserts pending transaction)
CREATE OR REPLACE FUNCTION public.request_vendor_cash_withdrawal(p_vendor_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance DECIMAL(12,2);
  v_min DECIMAL(12,2);
BEGIN
  IF p_vendor_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid vendor_id');
  END IF;
  SELECT balance INTO v_balance FROM public.vendor_cash_wallets WHERE vendor_id = p_vendor_id;
  v_balance := COALESCE(v_balance, 0);
  SELECT min_withdrawal_amount INTO v_min FROM public.vendor_settings ORDER BY id LIMIT 1;
  v_min := COALESCE(v_min, 499);
  IF v_balance < v_min THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Insufficient balance. Minimum ₹' || v_min || ' required.');
  END IF;
  INSERT INTO public.vendor_cash_transactions (vendor_id, type, amount, description, status)
  VALUES (p_vendor_id, 'withdrawal_request', v_balance, 'Withdrawal request', 'pending');
  RETURN jsonb_build_object('ok', true, 'amount', v_balance, 'message', 'Withdrawal request submitted. Admin will process.');
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_vendor_cash_withdrawal(UUID) TO authenticated;

-- 7) Trigger: when vendor_incentives gets new row, also credit vendor_cash_wallets
CREATE OR REPLACE FUNCTION public.trigger_credit_vendor_cash_on_incentive()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM credit_vendor_cash_wallet(
    NEW.vendor_id,
    NEW.earned_amount,
    CASE
      WHEN NEW.slab_type = 'referral' THEN 'Referral Bonus'
      WHEN NEW.slab_type = 'daily' THEN 'Daily ' || NEW.entry_count::text || ' Transactions Reward'
      WHEN NEW.slab_type = 'monthly' THEN 'Monthly Draw Reward'
      ELSE 'Incentive Reward'
    END
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_credit_vendor_cash_on_incentive ON public.vendor_incentives;
CREATE TRIGGER trg_credit_vendor_cash_on_incentive
  AFTER INSERT ON public.vendor_incentives
  FOR EACH ROW EXECUTE FUNCTION public.trigger_credit_vendor_cash_on_incentive();
