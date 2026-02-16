-- VendorHub: Cash incentives for sales entries + Advertisement column
-- Run AFTER part11. Adds incentive_slabs, vendor_incentives, ads, ad_impressions.

-- 1) incentive_slabs (admin-seeded: daily/monthly slabs)
CREATE TABLE IF NOT EXISTS public.incentive_slabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slab_type TEXT NOT NULL CHECK (slab_type IN ('daily', 'monthly')),
  min_count INTEGER NOT NULL DEFAULT 0,
  max_count INTEGER,
  reward_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.incentive_slabs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read incentive_slabs" ON public.incentive_slabs;
CREATE POLICY "Anyone can read incentive_slabs" ON public.incentive_slabs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage incentive_slabs" ON public.incentive_slabs;
CREATE POLICY "Admins manage incentive_slabs" ON public.incentive_slabs FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- 2) vendor_incentives (earned per vendor per day; monthly draw_eligible)
CREATE TABLE IF NOT EXISTS public.vendor_incentives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  slab_date DATE NOT NULL,
  slab_type TEXT NOT NULL CHECK (slab_type IN ('daily', 'monthly')),
  entry_count INTEGER NOT NULL DEFAULT 0,
  earned_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  draw_eligible BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(vendor_id, slab_date, slab_type)
);

CREATE INDEX IF NOT EXISTS idx_vendor_incentives_vendor_date ON public.vendor_incentives(vendor_id, slab_date);
ALTER TABLE public.vendor_incentives ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Vendor can view own incentives" ON public.vendor_incentives;
CREATE POLICY "Vendor can view own incentives" ON public.vendor_incentives FOR SELECT
  USING (auth.uid() = vendor_id);
DROP POLICY IF EXISTS "Admins manage vendor_incentives" ON public.vendor_incentives;
CREATE POLICY "Admins manage vendor_incentives" ON public.vendor_incentives FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- 3) profiles.zone for ad targeting (optional)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS zone TEXT;

-- 4) ads (brand ads for menu/cart)
CREATE TABLE IF NOT EXISTS public.ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  link_url TEXT,
  zone TEXT DEFAULT 'general',
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read ads" ON public.ads;
CREATE POLICY "Anyone can read ads" ON public.ads FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Admins manage ads" ON public.ads;
CREATE POLICY "Admins manage ads" ON public.ads FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- 5) ad_impressions (analytics)
CREATE TABLE IF NOT EXISTS public.ad_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id UUID NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  customer_phone TEXT,
  action TEXT NOT NULL CHECK (action IN ('view', 'click')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_impressions_ad ON public.ad_impressions(ad_id);
ALTER TABLE public.ad_impressions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can insert ad_impressions" ON public.ad_impressions;
CREATE POLICY "Anyone can insert ad_impressions" ON public.ad_impressions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Admins read ad_impressions" ON public.ad_impressions;
CREATE POLICY "Admins read ad_impressions" ON public.ad_impressions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- 6) Seed incentive_slabs
INSERT INTO public.incentive_slabs (slab_type, min_count, max_count, reward_amount, is_active)
SELECT 'daily', 0, 99, 20.00, true WHERE NOT EXISTS (SELECT 1 FROM public.incentive_slabs WHERE slab_type = 'daily' AND min_count = 0);
INSERT INTO public.incentive_slabs (slab_type, min_count, max_count, reward_amount, is_active)
SELECT 'daily', 100, 199, 30.00, true WHERE NOT EXISTS (SELECT 1 FROM public.incentive_slabs WHERE slab_type = 'daily' AND min_count = 100);
INSERT INTO public.incentive_slabs (slab_type, min_count, max_count, reward_amount, is_active)
SELECT 'daily', 200, 299, 40.00, true WHERE NOT EXISTS (SELECT 1 FROM public.incentive_slabs WHERE slab_type = 'daily' AND min_count = 200);
INSERT INTO public.incentive_slabs (slab_type, min_count, max_count, reward_amount, is_active)
SELECT 'daily', 300, NULL, 50.00, true WHERE NOT EXISTS (SELECT 1 FROM public.incentive_slabs WHERE slab_type = 'daily' AND min_count = 300);
INSERT INTO public.incentive_slabs (slab_type, min_count, max_count, reward_amount, is_active)
SELECT 'monthly', 10000, NULL, 5000.00, true WHERE NOT EXISTS (SELECT 1 FROM public.incentive_slabs WHERE slab_type = 'monthly' AND min_count = 10000);

-- 7) Seed sample ads (only if table is empty)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.ads LIMIT 1) THEN
    INSERT INTO public.ads (image_url, brand_name, link_url, zone, is_active, priority) VALUES
      ('https://placehold.co/200x100/1a5f2a/white?text=XYZ+Tea', 'XYZ Tea', '/catalog', 'general', true, 10),
      ('https://placehold.co/200x100/1e40af/white?text=Local+Groceries', 'Local Groceries', '/catalog', 'general', true, 9),
      ('https://placehold.co/200x100/7c2d12/white?text=Charminar+Spices', 'Charminar Spices', '/catalog', 'Charminar', true, 8),
      ('https://placehold.co/200x100/422006/white?text=Hyderabad+Oil', 'Hyderabad Oil', '/catalog', 'general', true, 7),
      ('https://placehold.co/200x100/14532d/white?text=Eco+Packaging', 'Eco Packaging', '/catalog', 'general', true, 6),
      ('https://placehold.co/200x100/4c1d95/white?text=Street+Snacks', 'Street Snacks Co', '/catalog', 'general', true, 5);
  END IF;
END $$;

-- 8) RPC: run_daily_incentive_calc (admin-triggered; counts yesterday's customer_orders per vendor, matches slabs, inserts vendor_incentives)
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
  v_slab RECORD;
  v_reward DECIMAL(10,2);
BEGIN
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') INTO v_admin_check;
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
      INSERT INTO vendor_incentives (vendor_id, slab_date, slab_type, entry_count, earned_amount, status)
      VALUES (v_vendor.vendor_id, v_yesterday, 'daily', v_entry_count, v_reward, 'pending')
      ON CONFLICT (vendor_id, slab_date, slab_type) DO UPDATE
      SET entry_count = EXCLUDED.entry_count, earned_amount = EXCLUDED.earned_amount;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'count', v_count);
END;
$$;

-- 9) RPC: run_monthly_draw (admin-triggered; finds vendors with 10000+ entries in past month, picks RNG winner)
CREATE OR REPLACE FUNCTION public.run_monthly_draw()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_check BOOLEAN;
  v_month_start DATE;
  v_month_end DATE;
  v_vendor RECORD;
  v_total INT;
  v_winner_id UUID;
  v_winner_name TEXT;
  v_eligible UUID[] := '{}';
  v_idx INT;
BEGIN
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') INTO v_admin_check;
  IF NOT v_admin_check THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Admin only');
  END IF;

  v_month_start := date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::DATE;
  v_month_end := v_month_start + INTERVAL '1 month' - INTERVAL '1 day';

  FOR v_vendor IN
    SELECT vendor_id, COUNT(*)::INT AS cnt
    FROM customer_orders
    WHERE created_at::DATE >= v_month_start AND created_at::DATE <= v_month_end
    GROUP BY vendor_id
    HAVING COUNT(*) >= 10000
  LOOP
    v_eligible := array_append(v_eligible, v_vendor.vendor_id);
    INSERT INTO vendor_incentives (vendor_id, slab_date, slab_type, entry_count, earned_amount, status, draw_eligible)
    VALUES (v_vendor.vendor_id, v_month_end, 'monthly', v_vendor.cnt, 5000.00, 'pending', true)
    ON CONFLICT (vendor_id, slab_date, slab_type) DO UPDATE
    SET entry_count = EXCLUDED.entry_count, draw_eligible = true;
  END LOOP;

  IF array_length(v_eligible, 1) IS NULL OR array_length(v_eligible, 1) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No eligible vendors (need 10000+ entries last month)');
  END IF;

  v_idx := 1 + floor(random() * array_length(v_eligible, 1))::INT;
  v_winner_id := v_eligible[v_idx];

  SELECT name INTO v_winner_name FROM profiles WHERE id = v_winner_id;

  RETURN jsonb_build_object('ok', true, 'winner_id', v_winner_id, 'winner_name', v_winner_name);
END;
$$;
