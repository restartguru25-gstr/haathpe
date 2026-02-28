-- Rental Income: prorated monthly credit by successful days (≥9 paid tx/day).
-- Successful day = at least 9 paid transactions that day. Monthly credit = slab × (successful_days/30) floored.

-- 1) vendor_daily_activity: one row per vendor per calendar day (IST)
CREATE TABLE IF NOT EXISTS public.vendor_daily_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  tx_count INTEGER NOT NULL DEFAULT 0,
  is_successful BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(vendor_id, date)
);

CREATE INDEX IF NOT EXISTS idx_vendor_daily_activity_vendor_date ON public.vendor_daily_activity(vendor_id, date DESC);
ALTER TABLE public.vendor_daily_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendors can view own daily activity" ON public.vendor_daily_activity;
CREATE POLICY "Vendors can view own daily activity" ON public.vendor_daily_activity
  FOR SELECT USING (auth.uid() = vendor_id);

DROP POLICY IF EXISTS "Admins can view all daily activity" ON public.vendor_daily_activity;
CREATE POLICY "Admins can view all daily activity" ON public.vendor_daily_activity
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- 2) Trigger: when customer_orders becomes paid, increment tx_count for that vendor/date (IST)
CREATE OR REPLACE FUNCTION public.inc_vendor_daily_activity_on_paid_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date DATE;
BEGIN
  IF NEW.status IS DISTINCT FROM 'paid' OR NEW.vendor_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'paid' THEN
    RETURN NEW;
  END IF;

  v_date := (NEW.created_at AT TIME ZONE 'Asia/Kolkata')::date;

  INSERT INTO public.vendor_daily_activity (vendor_id, date, tx_count, is_successful, updated_at)
  VALUES (NEW.vendor_id, v_date, 1, FALSE, NOW())
  ON CONFLICT (vendor_id, date) DO UPDATE SET
    tx_count = public.vendor_daily_activity.tx_count + 1,
    is_successful = (public.vendor_daily_activity.tx_count + 1 >= 9),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inc_vendor_daily_activity_on_paid ON public.customer_orders;
CREATE TRIGGER trg_inc_vendor_daily_activity_on_paid
  AFTER INSERT OR UPDATE OF status
  ON public.customer_orders
  FOR EACH ROW
  WHEN (NEW.status = 'paid')
  EXECUTE FUNCTION public.inc_vendor_daily_activity_on_paid_order();

-- 3) Add successful_days to vendor_rental_payouts (optional, for display)
ALTER TABLE public.vendor_rental_payouts
  ADD COLUMN IF NOT EXISTS successful_days INTEGER;

-- 4) Slab lookup: same as app (below 20k=0, 20-30k=150, ..., 100k+=500). In SQL for monthly calc.
CREATE OR REPLACE FUNCTION public.rental_slab_payout(p_volume DECIMAL)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_volume IS NULL OR p_volume < 20000 THEN RETURN 0; END IF;
  IF p_volume < 30000 THEN RETURN 150; END IF;
  IF p_volume < 40000 THEN RETURN 200; END IF;
  IF p_volume < 50000 THEN RETURN 250; END IF;
  IF p_volume < 60000 THEN RETURN 300; END IF;
  IF p_volume < 80000 THEN RETURN 350; END IF;
  IF p_volume < 100000 THEN RETURN 400; END IF;
  RETURN 500;
END;
$$;

-- 5) Monthly calc: for given month, each vendor gets credit = FLOOR(slab_payout(volume) * successful_days/30), credit wallet, record payout
CREATE OR REPLACE FUNCTION public.run_rental_income_monthly_calc(p_month TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin BOOLEAN;
  v_start DATE;
  v_end DATE;
  v_vendor RECORD;
  v_volume DECIMAL(12,2);
  v_slab_amt INTEGER;
  v_successful_days INTEGER;
  v_credit INTEGER;
  v_done INTEGER := 0;
BEGIN
  IF p_month IS NULL OR p_month !~ '^\d{4}-\d{2}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid month (use YYYY-MM)');
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') INTO v_admin;
  IF NOT v_admin THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Admin only');
  END IF;

  v_start := (p_month || '-01')::date;
  v_end := (date_trunc('month', v_start::timestamp) + interval '1 month' - interval '1 day')::date;

  FOR v_vendor IN
    SELECT DISTINCT vendor_id FROM public.vendor_daily_activity
    WHERE date >= v_start AND date <= v_end
  LOOP
    SELECT COUNT(*)::INTEGER INTO v_successful_days
    FROM public.vendor_daily_activity
    WHERE vendor_id = v_vendor.vendor_id AND date >= v_start AND date <= v_end AND is_successful = TRUE;

    SELECT COALESCE(SUM(total), 0) INTO v_volume
    FROM public.customer_orders
    WHERE vendor_id = v_vendor.vendor_id AND status = 'paid'
      AND (created_at AT TIME ZONE 'Asia/Kolkata')::date >= v_start
      AND (created_at AT TIME ZONE 'Asia/Kolkata')::date <= v_end;

    v_slab_amt := public.rental_slab_payout(v_volume);
    v_credit := FLOOR(v_slab_amt * v_successful_days / 30.0);

    IF v_credit > 0 THEN
      PERFORM public.credit_vendor_cash_wallet(
        v_vendor.vendor_id,
        v_credit,
        'Rental income ' || p_month || ' (' || v_successful_days || ' successful days)'
      );
    END IF;

    INSERT INTO public.vendor_rental_payouts (vendor_id, month, transaction_volume, incentive_amount, successful_days, status, paid_at)
    VALUES (v_vendor.vendor_id, p_month, v_volume, v_credit, v_successful_days, CASE WHEN v_credit > 0 THEN 'paid' ELSE 'pending' END, CASE WHEN v_credit > 0 THEN NOW() ELSE NULL END)
    ON CONFLICT (vendor_id, month) DO UPDATE SET
      transaction_volume = EXCLUDED.transaction_volume,
      incentive_amount = EXCLUDED.incentive_amount,
      successful_days = EXCLUDED.successful_days,
      status = EXCLUDED.status,
      paid_at = EXCLUDED.paid_at;

    v_done := v_done + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'month', p_month, 'vendors_processed', v_done);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_rental_income_monthly_calc(TEXT) TO authenticated;

COMMENT ON TABLE public.vendor_daily_activity IS 'Rental Income: daily paid tx count per vendor; is_successful = (tx_count >= 9)';

-- Realtime: vendor dashboard can subscribe to own daily activity
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'vendor_daily_activity'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vendor_daily_activity;
  END IF;
END $$;
