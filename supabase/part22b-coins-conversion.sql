-- Coins ≠ Cash: e.g. 10 coins = ₹1. Admin sets coins_per_payment and coins_to_rupees.
-- Run AFTER part22.

ALTER TABLE public.coins_config ADD COLUMN IF NOT EXISTS coins_to_rupees INTEGER NOT NULL DEFAULT 10;
COMMENT ON COLUMN public.coins_config.coins_to_rupees IS 'Number of coins that equal ₹1 (e.g. 10 = 10 coins = ₹1)';

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
  v_coins_to_rupees INTEGER;
  v_amount DECIMAL;
  v_new_balance DECIMAL;
BEGIN
  IF p_customer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid params');
  END IF;
  SELECT COALESCE(p_coins, coins_per_payment), COALESCE(coins_to_rupees, 10)
  INTO v_coins, v_coins_to_rupees
  FROM public.coins_config WHERE scenario = 'default' LIMIT 1;
  v_coins := COALESCE(v_coins, 2);
  v_coins_to_rupees := COALESCE(v_coins_to_rupees, 10);
  IF v_coins <= 0 OR v_coins_to_rupees <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid config');
  END IF;
  v_amount := v_coins::DECIMAL / v_coins_to_rupees::DECIMAL;
  INSERT INTO public.customer_wallets (customer_id)
  VALUES (p_customer_id)
  ON CONFLICT (customer_id) DO NOTHING;
  UPDATE public.customer_wallets
  SET balance = balance + v_amount,
      updated_at = NOW()
  WHERE customer_id = p_customer_id
  RETURNING balance INTO v_new_balance;
  INSERT INTO public.wallet_transactions (customer_id, type, amount, description, order_id)
  VALUES (p_customer_id, 'credit', v_amount, v_coins || ' coins from order (=' || v_amount || ')', p_order_id);
  UPDATE public.customer_orders SET coins_awarded = v_coins WHERE id = p_order_id;
  RETURN jsonb_build_object('ok', true, 'new_balance', v_new_balance);
END;
$$;
