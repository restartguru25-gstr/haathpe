-- Instant transfer min ₹100; normal withdrawal min ₹499 (unchanged).
-- Backfill: vendors with balance > 0 and eligible_receipt_balance = 0 get eligible = balance.

-- 1) Add min_instant_transfer_amount to vendor_settings (default 100)
ALTER TABLE public.vendor_settings
  ADD COLUMN IF NOT EXISTS min_instant_transfer_amount DECIMAL(12,2) NOT NULL DEFAULT 100;

-- Set default for existing row if missing
UPDATE public.vendor_settings
SET min_instant_transfer_amount = 100
WHERE min_instant_transfer_amount IS NULL OR min_instant_transfer_amount < 100;

-- 2) One-time backfill: eligible_receipt_balance = balance where eligible is 0 and balance > 0
UPDATE public.vendor_cash_wallets
SET eligible_receipt_balance = balance
WHERE eligible_receipt_balance = 0 AND balance > 0;

-- 3) request_vendor_instant_payout_amount: use min from vendor_settings (default 100)
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
  v_min_instant DECIMAL(12,2) := 100;
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

  SELECT COALESCE(min_instant_transfer_amount, 100) INTO v_min_instant
  FROM public.vendor_settings ORDER BY id LIMIT 1;

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
  IF v_eligible < v_min_instant THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No eligible receipt balance for instant transfer (min ₹' || v_min_instant::text || ')');
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
