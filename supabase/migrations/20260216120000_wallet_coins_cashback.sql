-- Premium wallet: coins + cashback, award on payment success (app + customer_orders)
-- Run after part22 + part22b.

-- 1) Coins and cashback on wallet
ALTER TABLE public.customer_wallets
  ADD COLUMN IF NOT EXISTS coins INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS coins INTEGER NOT NULL DEFAULT 0;

-- 2) Config: cashback per payment (e.g. ₹2)
ALTER TABLE public.coins_config
  ADD COLUMN IF NOT EXISTS cashback_per_payment DECIMAL(10,2) NOT NULL DEFAULT 2;

-- 3) App orders: track coins awarded (for idempotent award)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS coins_awarded INTEGER NOT NULL DEFAULT 0;

-- Allow wallet_transactions.order_id to reference either orders or customer_orders (drop FK)
ALTER TABLE public.wallet_transactions
  DROP CONSTRAINT IF EXISTS wallet_transactions_order_id_fkey;

-- 4) Award function: credit coins + cashback, set coins on wallet and transaction
CREATE OR REPLACE FUNCTION public.award_coins_for_order(
  p_order_id UUID,
  p_customer_id UUID,
  p_coins INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coins INTEGER;
  v_cashback DECIMAL(10,2);
  v_new_balance DECIMAL;
  v_new_coins INTEGER;
BEGIN
  IF p_customer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid params');
  END IF;
  SELECT COALESCE(p_coins, c.coins_per_payment), COALESCE(c.cashback_per_payment, 2)
  INTO v_coins, v_cashback
  FROM public.coins_config c WHERE scenario = 'default' LIMIT 1;
  v_coins := COALESCE(v_coins, 2);
  v_cashback := COALESCE(v_cashback, 2);
  IF v_coins <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid config');
  END IF;

  INSERT INTO public.customer_wallets (customer_id)
  VALUES (p_customer_id)
  ON CONFLICT (customer_id) DO NOTHING;

  UPDATE public.customer_wallets
  SET balance = balance + v_cashback,
      coins = coins + v_coins,
      updated_at = NOW()
  WHERE customer_id = p_customer_id
  RETURNING balance, coins INTO v_new_balance, v_new_coins;

  INSERT INTO public.wallet_transactions (customer_id, type, amount, coins, description, order_id)
  VALUES (
    p_customer_id,
    'credit',
    v_cashback,
    v_coins,
    v_coins || ' coins + ₹' || v_cashback || ' from order',
    p_order_id
  );

  UPDATE public.customer_orders SET coins_awarded = v_coins WHERE id = p_order_id;
  UPDATE public.orders SET coins_awarded = v_coins WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'new_balance', v_new_balance, 'new_coins', v_new_coins, 'coins', v_coins, 'cashback', v_cashback);
END;
$$;

-- 5) Single RPC: award for a paid order (orders or customer_orders), idempotent
CREATE OR REPLACE FUNCTION public.award_coins_for_paid_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_customer_id UUID;
  v_already INTEGER;
  v_coins INTEGER;
  v_cashback DECIMAL(10,2);
  v_result JSONB;
BEGIN
  -- Try app orders first (caller must be order owner when invoked from client)
  SELECT user_id, COALESCE(coins_awarded, 0) INTO v_user_id, v_already
  FROM public.orders WHERE id = p_order_id LIMIT 1;
  IF FOUND AND v_user_id IS NOT NULL AND v_already = 0 THEN
    IF auth.uid() IS NOT NULL AND auth.uid() != v_user_id THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Not your order');
    END IF;
    -- Ensure customer_profiles row for app user (phone must be unique: use synthetic)
    INSERT INTO public.customer_profiles (id, phone, name)
    SELECT v_user_id, 'app-' || v_user_id::text, (SELECT name FROM public.profiles WHERE id = v_user_id LIMIT 1)
    WHERE NOT EXISTS (SELECT 1 FROM public.customer_profiles WHERE id = v_user_id)
    ON CONFLICT (id) DO NOTHING;
    v_result := public.award_coins_for_order(p_order_id, v_user_id, NULL);
    IF (v_result->>'ok')::boolean THEN
      UPDATE public.orders SET coins_awarded = (v_result->>'coins')::INTEGER WHERE id = p_order_id;
    END IF;
    RETURN v_result;
  END IF;

  -- Try customer_orders (caller must be order owner when invoked from client)
  SELECT customer_id, COALESCE(coins_awarded, 0) INTO v_customer_id, v_already
  FROM public.customer_orders WHERE id = p_order_id LIMIT 1;
  IF FOUND AND v_customer_id IS NOT NULL AND v_already = 0 THEN
    IF auth.uid() IS NOT NULL AND auth.uid() != v_customer_id THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Not your order');
    END IF;
    v_result := public.award_coins_for_order(p_order_id, v_customer_id, NULL);
    RETURN v_result;
  END IF;

  RETURN jsonb_build_object('ok', false, 'error', 'Order not found or already awarded');
END;
$$;

-- Allow service role / anon to call award_coins_for_paid_order (called from webhook and client)
GRANT EXECUTE ON FUNCTION public.award_coins_for_paid_order(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.award_coins_for_paid_order(UUID) TO authenticated;

-- 6) get_or_create_wallet returns coins too (must DROP first when changing return type)
DROP FUNCTION IF EXISTS public.get_or_create_wallet(UUID);

CREATE FUNCTION public.get_or_create_wallet(p_customer_id UUID)
RETURNS TABLE (id UUID, balance DECIMAL, coins INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.customer_wallets (customer_id)
  VALUES (p_customer_id)
  ON CONFLICT (customer_id) DO NOTHING;
  RETURN QUERY
  SELECT w.id, w.balance, COALESCE(w.coins, 0)
  FROM public.customer_wallets w
  WHERE w.customer_id = p_customer_id;
END;
$$;
