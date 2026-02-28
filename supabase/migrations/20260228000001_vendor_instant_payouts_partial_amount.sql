-- Instant Funds: allow partial amount requests (<= current vendor wallet balance)

-- New RPC with amount param; keep old RPC for backward compatibility.
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
  v_balance DECIMAL(12,2);
  v_req_id UUID;
  v_amount DECIMAL(12,2);
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

  -- Convert "now" to IST clock time
  v_ist_now := (NOW() AT TIME ZONE 'Asia/Kolkata');
  v_time := v_ist_now::time;
  v_next_cycle_ist := public.next_instant_payout_cycle_ist(v_ist_now);
  v_next_cycle_ts := (v_next_cycle_ist AT TIME ZONE 'Asia/Kolkata');

  -- Allowed window: 10:30–20:30 IST (inclusive). Outside window: blocked.
  IF v_time < TIME '10:30' OR v_time > TIME '20:30' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Outside settlement window',
      'next_cycle_at', v_next_cycle_ts
    );
  END IF;

  -- Prevent multiple pending requests per vendor
  IF EXISTS (
    SELECT 1 FROM public.vendor_instant_payout_requests
    WHERE vendor_id = p_vendor_id AND status = 'pending'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You already have a pending instant payout request', 'next_cycle_at', v_next_cycle_ts);
  END IF;

  -- Ensure wallet row exists
  INSERT INTO public.vendor_cash_wallets (vendor_id, balance)
  VALUES (p_vendor_id, 0)
  ON CONFLICT (vendor_id) DO NOTHING;

  -- Lock wallet, read balance
  SELECT balance INTO v_balance
  FROM public.vendor_cash_wallets
  WHERE vendor_id = p_vendor_id
  FOR UPDATE;

  v_balance := COALESCE(v_balance, 0);
  IF v_balance <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No balance available for instant payout');
  END IF;
  IF v_amount > v_balance THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Requested amount exceeds wallet balance');
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

GRANT EXECUTE ON FUNCTION public.request_vendor_instant_payout_amount(UUID, DECIMAL) TO authenticated;

-- Backward-compatible wrapper: request full balance
CREATE OR REPLACE FUNCTION public.request_vendor_instant_payout(p_vendor_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance DECIMAL(12,2);
BEGIN
  INSERT INTO public.vendor_cash_wallets (vendor_id, balance)
  VALUES (p_vendor_id, 0)
  ON CONFLICT (vendor_id) DO NOTHING;

  SELECT balance INTO v_balance
  FROM public.vendor_cash_wallets
  WHERE vendor_id = p_vendor_id;

  v_balance := COALESCE(v_balance, 0);
  RETURN public.request_vendor_instant_payout_amount(p_vendor_id, v_balance);
END;
$$;

