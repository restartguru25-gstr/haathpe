-- Instant Funds: vendors request immediate settlement of their vendor cash wallet balance
-- Settlement cycles (IST): 10:30, 12:30, 14:30, 16:30, 18:30, 20:30
-- Requests outside window (after 20:30 or before 10:30) are blocked until next cycle.

-- 1) Table: vendor_instant_payout_requests
CREATE TABLE IF NOT EXISTS public.vendor_instant_payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processed','rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_vendor_instant_payout_requests_vendor_id ON public.vendor_instant_payout_requests(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_instant_payout_requests_status_requested_at ON public.vendor_instant_payout_requests(status, requested_at DESC);

ALTER TABLE public.vendor_instant_payout_requests ENABLE ROW LEVEL SECURITY;

-- Vendors can view their own requests
DROP POLICY IF EXISTS "Vendor can view own instant payout requests" ON public.vendor_instant_payout_requests;
CREATE POLICY "Vendor can view own instant payout requests"
  ON public.vendor_instant_payout_requests
  FOR SELECT
  USING (auth.uid() = vendor_id);

-- Admin can view all requests (for /admin UI)
DROP POLICY IF EXISTS "Admin can view all instant payout requests" ON public.vendor_instant_payout_requests;
CREATE POLICY "Admin can view all instant payout requests"
  ON public.vendor_instant_payout_requests
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- 2) Helper: compute next cycle (IST) for a given IST timestamp
CREATE OR REPLACE FUNCTION public.next_instant_payout_cycle_ist(p_ist_now TIMESTAMP)
RETURNS TIMESTAMP
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_time TIME := (p_ist_now::time);
  v_date DATE := (p_ist_now::date);
BEGIN
  IF v_time <= TIME '10:30' THEN
    RETURN (v_date + TIME '10:30');
  ELSIF v_time <= TIME '12:30' THEN
    RETURN (v_date + TIME '12:30');
  ELSIF v_time <= TIME '14:30' THEN
    RETURN (v_date + TIME '14:30');
  ELSIF v_time <= TIME '16:30' THEN
    RETURN (v_date + TIME '16:30');
  ELSIF v_time <= TIME '18:30' THEN
    RETURN (v_date + TIME '18:30');
  ELSIF v_time <= TIME '20:30' THEN
    RETURN (v_date + TIME '20:30');
  ELSE
    RETURN ((v_date + 1) + TIME '10:30');
  END IF;
END;
$$;

-- 3) Vendor RPC: request instant payout of current wallet balance (idempotent-ish)
CREATE OR REPLACE FUNCTION public.request_vendor_instant_payout(p_vendor_id UUID)
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
BEGIN
  IF p_vendor_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid vendor_id');
  END IF;
  IF auth.uid() IS NULL OR auth.uid() != p_vendor_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
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

  INSERT INTO public.vendor_instant_payout_requests (vendor_id, amount, status)
  VALUES (p_vendor_id, v_balance, 'pending')
  RETURNING id INTO v_req_id;

  RETURN jsonb_build_object(
    'ok', true,
    'request_id', v_req_id,
    'amount', v_balance,
    'next_cycle_at', v_next_cycle_ts,
    'message', 'Instant payout requested'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_vendor_instant_payout(UUID) TO authenticated;

-- 4) Admin RPC: approve/reject instant payout request (debits vendor wallet on approve)
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

  -- Approve: debit vendor wallet
  INSERT INTO public.vendor_cash_wallets (vendor_id, balance)
  VALUES (v_vendor_id, 0)
  ON CONFLICT (vendor_id) DO NOTHING;

  SELECT balance INTO v_balance
  FROM public.vendor_cash_wallets
  WHERE vendor_id = v_vendor_id
  FOR UPDATE;

  v_balance := COALESCE(v_balance, 0);
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid amount');
  END IF;
  IF v_balance < v_amount THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Insufficient vendor balance to approve');
  END IF;

  UPDATE public.vendor_cash_wallets
  SET balance = balance - v_amount,
      updated_at = NOW()
  WHERE vendor_id = v_vendor_id;

  INSERT INTO public.vendor_cash_transactions (vendor_id, type, amount, description, status)
  VALUES (v_vendor_id, 'debit', v_amount, 'Instant payout settlement', 'success');

  -- Payout trigger stub: integrate RazorpayX/UPI later.
  UPDATE public.vendor_instant_payout_requests
  SET status = 'processed', processed_at = NOW()
  WHERE id = p_request_id;

  RETURN jsonb_build_object('ok', true, 'status', 'processed', 'vendor_id', v_vendor_id, 'amount', v_amount);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_decide_vendor_instant_payout(UUID, TEXT) TO authenticated;

