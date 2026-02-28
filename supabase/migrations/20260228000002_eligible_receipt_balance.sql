-- Eligible receipt balance: only customer payment receipts (after platform fee) are eligible for instant transfer.
-- Business-given (signup bonus, referral, incentives, etc.) credit balance only, not eligible_receipt_balance.

-- 1) Add column to vendor_cash_wallets
ALTER TABLE public.vendor_cash_wallets
  ADD COLUMN IF NOT EXISTS eligible_receipt_balance DECIMAL(12,2) NOT NULL DEFAULT 0;

-- 2) Backfill: legacy vendors treat current balance as eligible
UPDATE public.vendor_cash_wallets
SET eligible_receipt_balance = balance
WHERE eligible_receipt_balance = 0 AND balance > 0;

-- 3) Track which customer_orders have had vendor receipt credited (idempotent)
ALTER TABLE public.customer_orders
  ADD COLUMN IF NOT EXISTS vendor_receipt_credited_at TIMESTAMPTZ NULL;

-- 4) RPC: credit vendor with customer payment receipt (increases both balance and eligible_receipt_balance)
CREATE OR REPLACE FUNCTION public.credit_vendor_receipt(
  p_vendor_id UUID,
  p_amount DECIMAL,
  p_description TEXT DEFAULT 'Customer payment'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance DECIMAL(12,2);
  v_new_eligible DECIMAL(12,2);
BEGIN
  IF p_vendor_id IS NULL OR p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid params');
  END IF;
  INSERT INTO public.vendor_cash_wallets (vendor_id, balance, eligible_receipt_balance)
  VALUES (p_vendor_id, 0, 0)
  ON CONFLICT (vendor_id) DO NOTHING;

  UPDATE public.vendor_cash_wallets
  SET balance = balance + p_amount,
      eligible_receipt_balance = eligible_receipt_balance + p_amount,
      updated_at = NOW()
  WHERE vendor_id = p_vendor_id
  RETURNING balance, eligible_receipt_balance INTO v_new_balance, v_new_eligible;

  INSERT INTO public.vendor_cash_transactions (vendor_id, type, amount, description, status)
  VALUES (p_vendor_id, 'credit', p_amount, COALESCE(p_description, 'Customer payment'), 'success');

  RETURN jsonb_build_object('ok', true, 'new_balance', v_new_balance, 'new_eligible_receipt_balance', v_new_eligible);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_vendor_receipt(UUID, DECIMAL, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.credit_vendor_receipt(UUID, DECIMAL, TEXT) TO service_role;

-- 5) RPC: credit vendor from a paid customer_orders row (idempotent; called from verify-cca-payment)
-- Platform fee 1.2%; vendor gets total - fee. Only for customer_orders with status = 'paid'.
CREATE OR REPLACE FUNCTION public.credit_vendor_receipt_from_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor_id UUID;
  v_total DECIMAL(12,2);
  v_fee_pct DECIMAL(5,4) := 0.012;
  v_fee DECIMAL(12,2);
  v_after_fee DECIMAL(12,2);
BEGIN
  IF p_order_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid order');
  END IF;

  SELECT vendor_id, total
  INTO v_vendor_id, v_total
  FROM public.customer_orders
  WHERE id = p_order_id AND status = 'paid';

  IF v_vendor_id IS NULL OR v_total IS NULL OR v_total <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Order not found or not paid');
  END IF;

  IF (SELECT vendor_receipt_credited_at FROM public.customer_orders WHERE id = p_order_id) IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already_credited', true);
  END IF;

  v_fee := ROUND(v_total * v_fee_pct, 2);
  v_after_fee := GREATEST(0, v_total - v_fee);
  IF v_after_fee <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'amount', 0);
  END IF;

  PERFORM public.credit_vendor_receipt(v_vendor_id, v_after_fee, 'Customer payment (order ' || p_order_id::text || ')');

  UPDATE public.customer_orders
  SET vendor_receipt_credited_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'vendor_id', v_vendor_id, 'amount', v_after_fee);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_vendor_receipt_from_order(UUID) TO service_role;

-- 6) Ensure INSERTs in instant payout RPCs include eligible_receipt_balance (default 0)
-- request_vendor_instant_payout_amount: use eligible_receipt_balance for cap and validation
CREATE OR REPLACE FUNCTION public.request_vendor_instant_payout_amount(
  p_vendor_id UUID,
  p_amount DECIMAL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ist_now TIMESTAMP;
  v_time TIME;
  v_next_cycle_ist TIMESTAMP;
  v_next_cycle_ts TIMESTAMPTZ;
  v_eligible DECIMAL(12,2);
  v_req_id UUID;
  v_amount DECIMAL(12,2);
  v_cap DECIMAL(12,2);
BEGIN
  IF p_vendor_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid vendor_id');
  END IF;
  IF auth.uid() IS NULL OR auth.uid() != p_vendor_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
  END IF;

  v_amount := COALESCE(p_amount, 0);
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid amount');
  END IF;

  v_ist_now := (NOW() AT TIME ZONE 'Asia/Kolkata');
  v_time := v_ist_now::time;
  v_next_cycle_ist := public.next_instant_payout_cycle_ist(v_ist_now);
  v_next_cycle_ts := (v_next_cycle_ist AT TIME ZONE 'Asia/Kolkata');

  IF v_time < TIME '10:30' OR v_time > TIME '20:30' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Outside settlement window', 'next_cycle_at', v_next_cycle_ts);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.vendor_instant_payout_requests
    WHERE vendor_id = p_vendor_id AND status = 'pending'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You already have a pending instant payout request', 'next_cycle_at', v_next_cycle_ts);
  END IF;

  INSERT INTO public.vendor_cash_wallets (vendor_id, balance, eligible_receipt_balance)
  VALUES (p_vendor_id, 0, 0)
  ON CONFLICT (vendor_id) DO NOTHING;

  SELECT eligible_receipt_balance INTO v_eligible
  FROM public.vendor_cash_wallets
  WHERE vendor_id = p_vendor_id
  FOR UPDATE;

  v_eligible := COALESCE(v_eligible, 0);
  IF v_eligible < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No eligible receipt balance for instant transfer (min ₹1)');
  END IF;

  v_cap := LEAST(v_amount, v_eligible);
  IF v_amount > v_eligible THEN
    v_amount := v_cap;
  END IF;

  INSERT INTO public.vendor_instant_payout_requests (vendor_id, amount, status)
  VALUES (p_vendor_id, v_amount, 'pending')
  RETURNING id INTO v_req_id;

  RETURN jsonb_build_object(
    'ok', true,
    'request_id', v_req_id,
    'amount', v_amount,
    'next_cycle_at', v_next_cycle_ts,
    'message', 'Instant payout requested'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- 7) request_vendor_instant_payout (full): use eligible_receipt_balance as amount
CREATE OR REPLACE FUNCTION public.request_vendor_instant_payout(p_vendor_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_eligible DECIMAL(12,2);
BEGIN
  INSERT INTO public.vendor_cash_wallets (vendor_id, balance, eligible_receipt_balance)
  VALUES (p_vendor_id, 0, 0)
  ON CONFLICT (vendor_id) DO NOTHING;

  SELECT eligible_receipt_balance INTO v_eligible
  FROM public.vendor_cash_wallets
  WHERE vendor_id = p_vendor_id;

  v_eligible := COALESCE(v_eligible, 0);
  RETURN public.request_vendor_instant_payout_amount(p_vendor_id, v_eligible);
END;
$$;

-- 8) admin_decide: on approve, debit both balance and eligible_receipt_balance
CREATE OR REPLACE FUNCTION public.admin_decide_vendor_instant_payout(
  p_request_id UUID,
  p_action TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin UUID := auth.uid();
  v_vendor_id UUID;
  v_amount DECIMAL(12,2);
  v_status TEXT;
  v_balance DECIMAL(12,2);
  v_eligible DECIMAL(12,2);
BEGIN
  IF v_admin IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_admin AND p.role = 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Admin only');
  END IF;
  IF p_request_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid request');
  END IF;
  IF p_action IS NULL OR p_action NOT IN ('approve','reject') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid action');
  END IF;

  SELECT vendor_id, amount, status
  INTO v_vendor_id, v_amount, v_status
  FROM public.vendor_instant_payout_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_vendor_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Request not found');
  END IF;
  IF v_status != 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Request already processed');
  END IF;

  IF p_action = 'reject' THEN
    UPDATE public.vendor_instant_payout_requests
    SET status = 'rejected', processed_at = NOW()
    WHERE id = p_request_id;
    RETURN jsonb_build_object('ok', true, 'status', 'rejected');
  END IF;

  INSERT INTO public.vendor_cash_wallets (vendor_id, balance, eligible_receipt_balance)
  VALUES (v_vendor_id, 0, 0)
  ON CONFLICT (vendor_id) DO NOTHING;

  SELECT balance, eligible_receipt_balance INTO v_balance, v_eligible
  FROM public.vendor_cash_wallets
  WHERE vendor_id = v_vendor_id
  FOR UPDATE;

  v_balance := COALESCE(v_balance, 0);
  v_eligible := COALESCE(v_eligible, 0);
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid amount');
  END IF;
  IF v_balance < v_amount THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Insufficient vendor balance to approve');
  END IF;
  IF v_eligible < v_amount THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Insufficient eligible receipt balance to approve');
  END IF;

  UPDATE public.vendor_cash_wallets
  SET balance = balance - v_amount,
      eligible_receipt_balance = eligible_receipt_balance - v_amount,
      updated_at = NOW()
  WHERE vendor_id = v_vendor_id;

  INSERT INTO public.vendor_cash_transactions (vendor_id, type, amount, description, status)
  VALUES (v_vendor_id, 'debit', v_amount, 'Instant payout settlement', 'success');

  UPDATE public.vendor_instant_payout_requests
  SET status = 'processed', processed_at = NOW()
  WHERE id = p_request_id;

  RETURN jsonb_build_object('ok', true, 'status', 'processed', 'vendor_id', v_vendor_id, 'amount', v_amount);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- 9) credit_vendor_cash_wallet (existing): only updates balance; does not touch eligible_receipt_balance (business-given credits).
-- ensure_vendor_cash_wallet_with_signup_bonus: inserts (vendor_id, balance, updated_at); new column default 0.

-- 10) Admin: allow reading all vendor_cash_wallets for breakdown (eligible vs total)
DROP POLICY IF EXISTS "Admin can read all vendor wallets" ON public.vendor_cash_wallets;
CREATE POLICY "Admin can read all vendor wallets" ON public.vendor_cash_wallets
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
