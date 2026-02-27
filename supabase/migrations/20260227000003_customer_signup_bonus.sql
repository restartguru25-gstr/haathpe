-- Customer signup bonus: ₹55 credit, ₹5 usable for first 11 eligible orders, valid 30 days

-- 1) Columns
ALTER TABLE IF EXISTS public.customer_wallets
  ADD COLUMN IF NOT EXISTS bonus_remaining INTEGER NOT NULL DEFAULT 11,
  ADD COLUMN IF NOT EXISTS signup_bonus_credited BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS signup_bonus_credited_at TIMESTAMPTZ NULL;

ALTER TABLE IF EXISTS public.wallet_transactions
  ADD COLUMN IF NOT EXISTS is_bonus BOOLEAN NOT NULL DEFAULT FALSE;

-- 2) RPC: ensure signup bonus credited (idempotent)
CREATE OR REPLACE FUNCTION public.ensure_customer_signup_bonus(p_customer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance DECIMAL(10,2);
  v_bonus_remaining INTEGER;
  v_credited_at TIMESTAMPTZ;
  v_expires_at TIMESTAMPTZ;
  v_just_credited BOOLEAN := FALSE;
BEGIN
  IF p_customer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid customer');
  END IF;
  IF auth.uid() IS NULL OR auth.uid() != p_customer_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
  END IF;

  INSERT INTO public.customer_wallets (customer_id)
  VALUES (p_customer_id)
  ON CONFLICT (customer_id) DO NOTHING;

  SELECT balance, bonus_remaining, signup_bonus_credited_at
  INTO v_balance, v_bonus_remaining, v_credited_at
  FROM public.customer_wallets
  WHERE customer_id = p_customer_id
  FOR UPDATE;

  IF (SELECT signup_bonus_credited FROM public.customer_wallets WHERE customer_id = p_customer_id) IS TRUE THEN
    IF v_credited_at IS NOT NULL THEN
      v_expires_at := v_credited_at + INTERVAL '30 days';
      IF NOW() > v_expires_at AND v_bonus_remaining > 0 THEN
        UPDATE public.customer_wallets
        SET bonus_remaining = 0,
            updated_at = NOW()
        WHERE customer_id = p_customer_id
        RETURNING balance, bonus_remaining INTO v_balance, v_bonus_remaining;
      END IF;
    END IF;
    RETURN jsonb_build_object(
      'ok', true,
      'credited', false,
      'amount', 55,
      'balance', COALESCE(v_balance, 0),
      'bonus_remaining', COALESCE(v_bonus_remaining, 0),
      'credited_at', v_credited_at,
      'expires_at', CASE WHEN v_credited_at IS NULL THEN NULL ELSE (v_credited_at + INTERVAL '30 days') END
    );
  END IF;

  -- Credit ₹55 signup bonus (only once)
  UPDATE public.customer_wallets
  SET balance = balance + 55,
      signup_bonus_credited = TRUE,
      signup_bonus_credited_at = NOW(),
      bonus_remaining = 11,
      updated_at = NOW()
  WHERE customer_id = p_customer_id
  RETURNING balance, bonus_remaining, signup_bonus_credited_at
  INTO v_balance, v_bonus_remaining, v_credited_at;

  INSERT INTO public.wallet_transactions (customer_id, type, amount, coins, description, order_id, is_bonus)
  VALUES (p_customer_id, 'credit', 55, 0, 'Signup Bonus', NULL, TRUE);

  v_expires_at := v_credited_at + INTERVAL '30 days';
  v_just_credited := TRUE;

  RETURN jsonb_build_object(
    'ok', true,
    'credited', v_just_credited,
    'amount', 55,
    'balance', COALESCE(v_balance, 0),
    'bonus_remaining', COALESCE(v_bonus_remaining, 0),
    'credited_at', v_credited_at,
    'expires_at', v_expires_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_customer_signup_bonus(UUID) TO authenticated;

-- 3) RPC: use ₹5 signup bonus for a specific order (idempotent)
CREATE OR REPLACE FUNCTION public.use_customer_signup_bonus_for_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_total DECIMAL(10,2);
  v_balance DECIMAL(10,2);
  v_bonus_remaining INTEGER;
  v_credited_at TIMESTAMPTZ;
  v_expires_at TIMESTAMPTZ;
BEGIN
  v_customer_id := auth.uid();
  IF v_customer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
  END IF;
  IF p_order_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid order');
  END IF;

  SELECT total
  INTO v_total
  FROM public.customer_orders
  WHERE id = p_order_id AND customer_id = v_customer_id
  LIMIT 1;

  IF v_total IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Order not found');
  END IF;
  IF v_total < 55 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Order total not eligible');
  END IF;

  -- Ensure wallet exists and lock it
  INSERT INTO public.customer_wallets (customer_id)
  VALUES (v_customer_id)
  ON CONFLICT (customer_id) DO NOTHING;

  SELECT balance, bonus_remaining, signup_bonus_credited_at
  INTO v_balance, v_bonus_remaining, v_credited_at
  FROM public.customer_wallets
  WHERE customer_id = v_customer_id
  FOR UPDATE;

  IF (SELECT signup_bonus_credited FROM public.customer_wallets WHERE customer_id = v_customer_id) IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Signup bonus not available');
  END IF;

  IF v_credited_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Signup bonus missing credit time');
  END IF;
  v_expires_at := v_credited_at + INTERVAL '30 days';
  IF NOW() > v_expires_at THEN
    UPDATE public.customer_wallets
    SET bonus_remaining = 0, updated_at = NOW()
    WHERE customer_id = v_customer_id;
    RETURN jsonb_build_object('ok', false, 'error', 'Signup bonus expired');
  END IF;

  IF COALESCE(v_bonus_remaining, 0) <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No signup bonus remaining');
  END IF;

  -- Idempotency: if already used for this order, no-op
  IF EXISTS (
    SELECT 1 FROM public.wallet_transactions
    WHERE customer_id = v_customer_id
      AND order_id = p_order_id
      AND is_bonus = TRUE
      AND type = 'debit'
  ) THEN
    RETURN jsonb_build_object(
      'ok', true,
      'used', false,
      'balance', COALESCE(v_balance, 0),
      'bonus_remaining', COALESCE(v_bonus_remaining, 0),
      'expires_at', v_expires_at
    );
  END IF;

  -- Debit ₹5 from wallet, decrement remaining
  UPDATE public.customer_wallets
  SET balance = balance - 5,
      bonus_remaining = GREATEST(0, bonus_remaining - 1),
      updated_at = NOW()
  WHERE customer_id = v_customer_id AND balance >= 5
  RETURNING balance, bonus_remaining INTO v_balance, v_bonus_remaining;

  IF v_balance IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Insufficient wallet balance for bonus');
  END IF;

  INSERT INTO public.wallet_transactions (customer_id, type, amount, coins, description, order_id, is_bonus)
  VALUES (v_customer_id, 'debit', 5, 0, 'Signup Bonus Used', p_order_id, TRUE);

  RETURN jsonb_build_object(
    'ok', true,
    'used', true,
    'balance', COALESCE(v_balance, 0),
    'bonus_remaining', COALESCE(v_bonus_remaining, 0),
    'expires_at', v_expires_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.use_customer_signup_bonus_for_order(UUID) TO authenticated;

-- 4) Optional: admin read policies (only relevant if RLS is enabled on these tables)
DO $$
BEGIN
  BEGIN
    CREATE POLICY "Admin can view all customer_wallets"
      ON public.customer_wallets FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    CREATE POLICY "Admin can view all wallet_transactions"
      ON public.wallet_transactions FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

