-- VendorHub: Schema extensions for incentives & ads (run AFTER part12/part13)
-- Adds: description, notes, available_balance, title, page, session_id, impressions/clicks
-- Storage bucket ad-images for admin ad uploads. Payouts table for withdrawal audit.

-- 1) incentive_slabs.description
ALTER TABLE public.incentive_slabs ADD COLUMN IF NOT EXISTS description TEXT;

-- 2) vendor_incentives.notes
ALTER TABLE public.vendor_incentives ADD COLUMN IF NOT EXISTS notes TEXT;

-- 3) profiles.available_balance (for payout)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS available_balance DECIMAL(10,2) NOT NULL DEFAULT 0;

-- 4) ads.title, impressions_count, clicks_count
ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS impressions_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS clicks_count INTEGER NOT NULL DEFAULT 0;

-- 5) ad_impressions.page, session_id
ALTER TABLE public.ad_impressions ADD COLUMN IF NOT EXISTS page TEXT;
ALTER TABLE public.ad_impressions ADD COLUMN IF NOT EXISTS session_id TEXT;

-- 6) Trigger: increment ads.impressions_count / clicks_count on insert
CREATE OR REPLACE FUNCTION public.increment_ad_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.action = 'view' THEN
    UPDATE ads SET impressions_count = COALESCE(impressions_count, 0) + 1 WHERE id = NEW.ad_id;
  ELSIF NEW.action = 'click' THEN
    UPDATE ads SET clicks_count = COALESCE(clicks_count, 0) + 1 WHERE id = NEW.ad_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_increment_ad_counts ON public.ad_impressions;
CREATE TRIGGER trg_increment_ad_counts
  AFTER INSERT ON public.ad_impressions
  FOR EACH ROW EXECUTE FUNCTION public.increment_ad_counts();

-- 6b) Storage bucket for ad images (admin upload)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ad-images',
  'ad-images',
  true,
  1048576,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Admins upload ad images" ON storage.objects;
CREATE POLICY "Admins upload ad images" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'ad-images'
    AND public.is_admin()
  );

DROP POLICY IF EXISTS "Public read ad images" ON storage.objects;
CREATE POLICY "Public read ad images" ON storage.objects FOR SELECT
  USING (bucket_id = 'ad-images');

-- 6c) Payouts table for withdrawal audit
CREATE TABLE IF NOT EXISTS public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Vendor can view own payouts" ON public.payouts;
CREATE POLICY "Vendor can view own payouts" ON public.payouts FOR SELECT USING (auth.uid() = vendor_id);
DROP POLICY IF EXISTS "Admins manage payouts" ON public.payouts;
CREATE POLICY "Admins manage payouts" ON public.payouts FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 6d) Trigger: add earned_amount to profiles.available_balance on vendor_incentives INSERT
CREATE OR REPLACE FUNCTION public.credit_incentive_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles SET available_balance = COALESCE(available_balance, 0) + NEW.earned_amount WHERE id = NEW.vendor_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_credit_incentive_balance ON public.vendor_incentives;
CREATE TRIGGER trg_credit_incentive_balance
  AFTER INSERT ON public.vendor_incentives
  FOR EACH ROW EXECUTE FUNCTION public.credit_incentive_balance();

-- 7) Update run_daily_incentive_calc to add earned_amount to profiles.available_balance
CREATE OR REPLACE FUNCTION public.run_daily_incentive_calc()
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
  v_entry_count INT;
  v_reward DECIMAL(10,2);
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
  LOOP
    v_entry_count := v_vendor.cnt;
    v_reward := 0;

    SELECT reward_amount INTO v_reward
    FROM incentive_slabs
    WHERE slab_type = 'daily'
      AND is_active = true
      AND min_count <= v_entry_count
      AND (max_count IS NULL OR max_count >= v_entry_count)
    ORDER BY min_count DESC
    LIMIT 1;

    IF v_reward > 0 THEN
      INSERT INTO vendor_incentives (vendor_id, slab_date, slab_type, entry_count, earned_amount, status, referred_vendor_id)
      VALUES (v_vendor.vendor_id, v_yesterday, 'daily', v_entry_count, v_reward, 'pending', NULL)
      ON CONFLICT (vendor_id, slab_date, slab_type, (COALESCE(referred_vendor_id, '00000000-0000-0000-0000-000000000000'::uuid))) DO UPDATE
      SET entry_count = EXCLUDED.entry_count, earned_amount = EXCLUDED.earned_amount;
      -- Add to available_balance only on INSERT; trigger credit_incentive_balance handles new rows
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'count', v_count);
END;
$$;

-- 7b) run_referral_bonus_calc inserts into vendor_incentives; trigger credit_incentive_balance adds to available_balance
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

-- 8) RPC: request_payout (vendor withdraws from available_balance)
CREATE OR REPLACE FUNCTION public.request_payout(p_amount DECIMAL(10,2))
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_balance DECIMAL(10,2);
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid amount');
  END IF;

  SELECT COALESCE(available_balance, 0) INTO v_balance FROM profiles WHERE id = v_uid;
  IF v_balance IS NULL OR v_balance < p_amount THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Insufficient balance');
  END IF;

  UPDATE profiles SET available_balance = COALESCE(available_balance, 0) - p_amount WHERE id = v_uid;
  INSERT INTO payouts (vendor_id, amount, status) VALUES (v_uid, p_amount, 'completed');
  RETURN jsonb_build_object('ok', true, 'new_balance', v_balance - p_amount);
END;
$$;
