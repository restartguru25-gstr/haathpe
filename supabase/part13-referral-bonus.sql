-- VendorHub: Referral Bonus (₹100 when vendor refers another who hits 100 entries)
-- Run AFTER part12. Adds referred_by, referral_bonus_paid, extends vendor_incentives.

-- 1) profiles.referred_by (who invited this vendor)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON public.profiles(referred_by);

-- 2) referral_bonus_paid (one bonus per referrer–referred pair)
CREATE TABLE IF NOT EXISTS public.referral_bonus_paid (
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  slab_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (referrer_id, referred_id)
);

ALTER TABLE public.referral_bonus_paid ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Vendor can view own referral bonuses" ON public.referral_bonus_paid;
CREATE POLICY "Vendor can view own referral bonuses" ON public.referral_bonus_paid FOR SELECT
  USING (auth.uid() = referrer_id);
DROP POLICY IF EXISTS "Admins manage referral_bonus_paid" ON public.referral_bonus_paid;
CREATE POLICY "Admins manage referral_bonus_paid" ON public.referral_bonus_paid FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 3) Extend vendor_incentives for referral type
ALTER TABLE public.vendor_incentives DROP CONSTRAINT IF EXISTS vendor_incentives_slab_type_check;
ALTER TABLE public.vendor_incentives ADD CONSTRAINT vendor_incentives_slab_type_check
  CHECK (slab_type IN ('daily', 'monthly', 'referral'));

ALTER TABLE public.vendor_incentives ADD COLUMN IF NOT EXISTS referred_vendor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Allow multiple referral bonuses per referrer per day (different referred vendors)
DROP INDEX IF EXISTS vendor_incentives_vendor_date_type_referred_key;
CREATE UNIQUE INDEX IF NOT EXISTS vendor_incentives_vendor_date_type_referred_key
  ON public.vendor_incentives (vendor_id, slab_date, slab_type, COALESCE(referred_vendor_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Drop old unique if it exists (part12 used vendor_id, slab_date, slab_type)
ALTER TABLE public.vendor_incentives DROP CONSTRAINT IF EXISTS vendor_incentives_vendor_id_slab_date_slab_type_key;

-- 4) RPC: set_my_referrer (call after signup with ?ref=UUID in URL)
CREATE OR REPLACE FUNCTION public.set_my_referrer(p_referrer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_referrer_id IS NULL OR p_referrer_id = auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid referrer');
  END IF;
  UPDATE public.profiles
  SET referred_by = p_referrer_id
  WHERE id = auth.uid() AND referred_by IS NULL;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true);
  END IF;
  RETURN jsonb_build_object('ok', false, 'error', 'Already has referrer or profile not found');
END;
$$;

-- 5) RPC: run_referral_bonus_calc (run after run_daily_incentive_calc)
-- For yesterday: vendors who hit 100+ entries, have referred_by, and referrer not yet paid → pay referrer ₹100
CREATE OR REPLACE FUNCTION public.run_referral_bonus_calc()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_check BOOLEAN;
  v_yesterday DATE;
  v_count INT := 0;
  v_vendor RECORD;
  v_referrer_id UUID;
BEGIN
  SELECT public.is_admin() INTO v_admin_check;
  IF NOT v_admin_check THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Admin only');
  END IF;

  v_yesterday := CURRENT_DATE - INTERVAL '1 day';

  FOR v_vendor IN
    SELECT vendor_id, COUNT(*)::INT AS cnt
    FROM customer_orders
    WHERE created_at::DATE = v_yesterday
    GROUP BY vendor_id
    HAVING COUNT(*) >= 100
  LOOP
    SELECT referred_by INTO v_referrer_id FROM profiles WHERE id = v_vendor.vendor_id;
    IF v_referrer_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM referral_bonus_paid WHERE referrer_id = v_referrer_id AND referred_id = v_vendor.vendor_id) THEN
      INSERT INTO referral_bonus_paid (referrer_id, referred_id, slab_date)
      VALUES (v_referrer_id, v_vendor.vendor_id, v_yesterday);
      INSERT INTO vendor_incentives (vendor_id, slab_date, slab_type, entry_count, earned_amount, status, referred_vendor_id)
      VALUES (v_referrer_id, v_yesterday, 'referral', 1, 100.00, 'pending', v_vendor.vendor_id);
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'count', v_count);
END;
$$;
