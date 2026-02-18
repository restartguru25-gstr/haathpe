-- Customer Wallet, Coins & Redemptions
-- Run AFTER part15 (customer_profiles). Adds wallet, transactions, redemptions, coins config.

-- 1) Coins config (admin-editable)
CREATE TABLE IF NOT EXISTS public.coins_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario TEXT NOT NULL UNIQUE DEFAULT 'default',
  coins_per_payment INTEGER NOT NULL DEFAULT 2,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.coins_config (scenario, coins_per_payment, description)
VALUES ('default', 2, 'Default coins per successful payment')
ON CONFLICT (scenario) DO NOTHING;

ALTER TABLE public.coins_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read coins_config" ON public.coins_config;
CREATE POLICY "Anyone can read coins_config" ON public.coins_config FOR SELECT USING (true);
-- 1b) Admin can update coins_config
DROP POLICY IF EXISTS "Admin can update coins_config" ON public.coins_config;
CREATE POLICY "Admin can update coins_config" ON public.coins_config FOR UPDATE
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- 2) customer_wallets
CREATE TABLE IF NOT EXISTS public.customer_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE UNIQUE,
  balance DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_wallets_customer ON public.customer_wallets(customer_id);
ALTER TABLE public.customer_wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customer can read own wallet" ON public.customer_wallets;
CREATE POLICY "Customer can read own wallet" ON public.customer_wallets
  FOR SELECT USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customer can insert own wallet" ON public.customer_wallets;
CREATE POLICY "Customer can insert own wallet" ON public.customer_wallets
  FOR INSERT WITH CHECK (auth.uid() = customer_id);

-- Updates via RPC only (credit/debit)

-- 3) wallet_transactions
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit', 'redemption')),
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
  description TEXT,
  order_id UUID REFERENCES public.customer_orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_customer ON public.wallet_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created ON public.wallet_transactions(customer_id, created_at DESC);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customer can read own transactions" ON public.wallet_transactions;
CREATE POLICY "Customer can read own transactions" ON public.wallet_transactions
  FOR SELECT USING (auth.uid() = customer_id);

-- Inserts via RPC only

-- 4) redemptions
CREATE TABLE IF NOT EXISTS public.redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('cash', 'coupon', 'cashback')),
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_redemptions_customer ON public.redemptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_status ON public.redemptions(status);

ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customer can read own redemptions" ON public.redemptions;
CREATE POLICY "Customer can read own redemptions" ON public.redemptions
  FOR SELECT USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customer can insert own redemption" ON public.redemptions;
CREATE POLICY "Customer can insert own redemption" ON public.redemptions
  FOR INSERT WITH CHECK (auth.uid() = customer_id);

-- Admin can read and update redemptions
DROP POLICY IF EXISTS "Admin can read all redemptions" ON public.redemptions;
CREATE POLICY "Admin can read all redemptions" ON public.redemptions FOR SELECT
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
DROP POLICY IF EXISTS "Admin can update redemptions" ON public.redemptions;
CREATE POLICY "Admin can update redemptions" ON public.redemptions FOR UPDATE
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- 5) Add columns to customer_orders
ALTER TABLE public.customer_orders ADD COLUMN IF NOT EXISTS wallet_used DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.customer_orders ADD COLUMN IF NOT EXISTS coins_awarded INTEGER NOT NULL DEFAULT 0;

-- 6) Add customer_id to customer_orders (nullable, for logged-in customers - links to customer_profiles.id)
-- We use customer_phone for guest orders; customer_id for logged-in when we have it.
ALTER TABLE public.customer_orders ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customer_profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_customer_orders_customer_id ON public.customer_orders(customer_id);

-- 7) RPC: Get or create customer wallet
CREATE OR REPLACE FUNCTION public.get_or_create_wallet(p_customer_id UUID)
RETURNS TABLE (id UUID, balance DECIMAL)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.customer_wallets (customer_id)
  VALUES (p_customer_id)
  ON CONFLICT (customer_id) DO NOTHING;
  RETURN QUERY
  SELECT w.id, w.balance
  FROM public.customer_wallets w
  WHERE w.customer_id = p_customer_id;
END;
$$;

-- 8) RPC: Award coins for order (credit wallet)
CREATE OR REPLACE FUNCTION public.award_coins_for_order(
  p_order_id UUID,
  p_customer_id UUID,
  p_coins INTEGER DEFAULT 2
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount DECIMAL := p_coins::DECIMAL;
  v_new_balance DECIMAL;
BEGIN
  IF p_coins <= 0 OR p_customer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid params');
  END IF;
  INSERT INTO public.customer_wallets (customer_id)
  VALUES (p_customer_id)
  ON CONFLICT (customer_id) DO NOTHING;
  UPDATE public.customer_wallets
  SET balance = balance + v_amount,
      updated_at = NOW()
  WHERE customer_id = p_customer_id
  RETURNING balance INTO v_new_balance;
  INSERT INTO public.wallet_transactions (customer_id, type, amount, description, order_id)
  VALUES (p_customer_id, 'credit', v_amount, 'Coins earned from order', p_order_id);
  UPDATE public.customer_orders SET coins_awarded = p_coins WHERE id = p_order_id;
  RETURN jsonb_build_object('ok', true, 'new_balance', v_new_balance);
END;
$$;

-- 9) RPC: Use wallet in order (debit)
CREATE OR REPLACE FUNCTION public.debit_wallet_for_order(
  p_customer_id UUID,
  p_order_id UUID,
  p_amount DECIMAL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance DECIMAL;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', true);
  END IF;
  SELECT balance INTO v_balance FROM public.customer_wallets WHERE customer_id = p_customer_id;
  IF v_balance IS NULL OR v_balance < p_amount THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Insufficient wallet balance');
  END IF;
  UPDATE public.customer_wallets
  SET balance = balance - p_amount, updated_at = NOW()
  WHERE customer_id = p_customer_id;
  INSERT INTO public.wallet_transactions (customer_id, type, amount, description, order_id)
  VALUES (p_customer_id, 'debit', p_amount, 'Used for order', p_order_id);
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 10) RPC: Admin approve redemption (debit wallet, update status)
CREATE OR REPLACE FUNCTION public.approve_redemption(p_redemption_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_balance DECIMAL;
BEGIN
  SELECT * INTO v_row FROM public.redemptions WHERE id = p_redemption_id AND status = 'pending';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Redemption not found or not pending');
  END IF;
  SELECT balance INTO v_balance FROM public.customer_wallets WHERE customer_id = v_row.customer_id;
  IF v_balance IS NULL OR v_balance < v_row.amount THEN
    UPDATE public.redemptions SET status = 'rejected', updated_at = NOW() WHERE id = p_redemption_id;
    RETURN jsonb_build_object('ok', false, 'error', 'Insufficient wallet balance');
  END IF;
  UPDATE public.customer_wallets
  SET balance = balance - v_row.amount, updated_at = NOW()
  WHERE customer_id = v_row.customer_id;
  INSERT INTO public.wallet_transactions (customer_id, type, amount, description)
  VALUES (v_row.customer_id, 'redemption', v_row.amount, 'Redemption: ' || v_row.type);
  UPDATE public.redemptions SET status = 'approved', updated_at = NOW() WHERE id = p_redemption_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 11) Realtime for wallet
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'customer_wallets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_wallets;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'wallet_transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_transactions;
  END IF;
END;
$$;
