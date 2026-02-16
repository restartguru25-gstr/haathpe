-- VendorHub: Run ALL parts (1–11) in one go. Idempotent: safe to re-run.


-- ========== run-this-in-supabase.sql ==========

-- VendorHub: run this entire file in Supabase SQL Editor once
-- Dashboard: https://supabase.com/dashboard -> your project -> SQL Editor -> New query

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT,
  name TEXT,
  stall_type TEXT,
  stall_address TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'hi', 'te')),
  photo_url TEXT,
  credit_limit INTEGER NOT NULL DEFAULT 0,
  credit_used INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'Bronze' CHECK (tier IN ('Bronze', 'Silver', 'Gold')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Orders
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in-transit', 'delivered')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
CREATE POLICY "Users can view own orders"
  ON public.orders FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;
CREATE POLICY "Users can insert own orders"
  ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Purchases daily (streak tracking)
CREATE TABLE IF NOT EXISTS public.purchases_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purchase_date DATE NOT NULL,
  total_amount INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, purchase_date)
);

ALTER TABLE public.purchases_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own purchases" ON public.purchases_daily;
CREATE POLICY "Users can view own purchases"
  ON public.purchases_daily FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own purchases" ON public.purchases_daily;
CREATE POLICY "Users can insert own purchases"
  ON public.purchases_daily FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Loyalty points
CREATE TABLE IF NOT EXISTS public.loyalty_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  points INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own loyalty points" ON public.loyalty_points;
CREATE POLICY "Users can view own loyalty points"
  ON public.loyalty_points FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own loyalty points" ON public.loyalty_points;
CREATE POLICY "Users can insert own loyalty points"
  ON public.loyalty_points FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own loyalty points" ON public.loyalty_points;
CREATE POLICY "Users can update own loyalty points"
  ON public.loyalty_points FOR UPDATE USING (auth.uid() = user_id);

-- Draws entries
CREATE TABLE IF NOT EXISTS public.draws_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  draw_date DATE NOT NULL,
  eligible BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(user_id, draw_date)
);

ALTER TABLE public.draws_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own draws entries" ON public.draws_entries;
CREATE POLICY "Users can view own draws entries"
  ON public.draws_entries FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own draws entries" ON public.draws_entries;
CREATE POLICY "Users can insert own draws entries"
  ON public.draws_entries FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Trigger: auto-update profiles.updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ========== run-this-in-supabase-part2.sql ==========

-- VendorHub: run this AFTER the first migration (order_items, notifications, forum, courses)
-- SQL Editor -> New query -> paste -> Run

-- Order items
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_price INTEGER NOT NULL
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items;
CREATE POLICY "Users can view own order items"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id AND o.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Users can insert own order items" ON public.order_items;
CREATE POLICY "Users can insert own order items"
  ON public.order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id AND o.user_id = auth.uid()
    )
  );

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('order_update', 'promotion', 'draw_result')),
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
CREATE POLICY "Users can insert own notifications"
  ON public.notifications FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- Forum topics
CREATE TABLE IF NOT EXISTS public.forum_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.forum_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view forum topics" ON public.forum_topics;
CREATE POLICY "Authenticated can view forum topics"
  ON public.forum_topics FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert own forum topics" ON public.forum_topics;
CREATE POLICY "Users can insert own forum topics"
  ON public.forum_topics FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Forum replies
CREATE TABLE IF NOT EXISTS public.forum_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES public.forum_topics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.forum_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view forum replies" ON public.forum_replies;
CREATE POLICY "Authenticated can view forum replies"
  ON public.forum_replies FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert forum replies" ON public.forum_replies;
CREATE POLICY "Users can insert forum replies"
  ON public.forum_replies FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Course progress
CREATE TABLE IF NOT EXISTS public.course_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  section_id TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, course_id, section_id)
);

ALTER TABLE public.course_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own course progress" ON public.course_progress;
CREATE POLICY "Users can view own course progress"
  ON public.course_progress FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own course progress" ON public.course_progress;
CREATE POLICY "Users can insert own course progress"
  ON public.course_progress FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Optional: enable Realtime for forum (run if you want live updates)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.forum_topics;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.forum_replies;


-- ========== run-this-in-supabase-part3.sql ==========

-- VendorHub: incentive logic (run AFTER part 1 and part 2)
-- Call these RPCs from the app after placing an order.

-- 1) Add today's order total to purchases_daily (upsert by user + date)
CREATE OR REPLACE FUNCTION public.upsert_purchase_today(p_user_id UUID, p_amount INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.purchases_daily (user_id, purchase_date, total_amount)
  VALUES (p_user_id, CURRENT_DATE, p_amount)
  ON CONFLICT (user_id, purchase_date)
  DO UPDATE SET total_amount = public.purchases_daily.total_amount + EXCLUDED.total_amount;
END;
$$;

-- 2) Add loyalty points (1 point per ₹100); creates row if missing
CREATE OR REPLACE FUNCTION public.add_loyalty_points(p_user_id UUID, p_points INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.loyalty_points (user_id, points, updated_at)
  VALUES (p_user_id, GREATEST(0, p_points), NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET
    points = public.loyalty_points.points + GREATEST(0, p_points),
    updated_at = NOW();
END;
$$;

-- 3) Recompute streak (last 30 days), sync points/tier/credit_limit to profiles
CREATE OR REPLACE FUNCTION public.refresh_profile_incentives(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_streak INTEGER;
  v_points INTEGER;
  v_tier TEXT;
  v_credit_limit INTEGER;
BEGIN
  SELECT COUNT(DISTINCT purchase_date)::INTEGER
  INTO v_streak
  FROM public.purchases_daily
  WHERE user_id = p_user_id
    AND purchase_date >= (CURRENT_DATE - INTERVAL '30 days');

  SELECT COALESCE(points, 0)
  INTO v_points
  FROM public.loyalty_points
  WHERE user_id = p_user_id;

  v_tier := CASE
    WHEN COALESCE(v_points, 0) >= 2000 THEN 'Gold'
    WHEN COALESCE(v_points, 0) >= 500 THEN 'Silver'
    ELSE 'Bronze'
  END;

  v_credit_limit := CASE
    WHEN v_streak >= 30 THEN 5000
    WHEN v_streak >= 20 THEN 3000
    WHEN v_streak >= 10 THEN 1000
    ELSE 0
  END;

  UPDATE public.profiles
  SET
    streak = COALESCE(v_streak, 0),
    points = COALESCE(v_points, 0),
    tier = v_tier,
    credit_limit = v_credit_limit,
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

-- Allow authenticated users to call these (they pass their own user_id; functions only touch that user)
GRANT EXECUTE ON FUNCTION public.upsert_purchase_today(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_loyalty_points(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_profile_incentives(UUID) TO authenticated;


-- ========== run-this-in-supabase-part4.sql ==========

-- VendorHub: admin role, push subscriptions, admin RLS (run AFTER part 1–3)

-- 1) Add role to profiles (vendor | admin)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'vendor' CHECK (role IN ('vendor', 'admin'));

-- 2) Push subscriptions for browser push notifications
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can insert own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can view own push subscriptions"
  ON public.push_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own push subscriptions"
  ON public.push_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own push subscriptions"
  ON public.push_subscriptions FOR DELETE USING (auth.uid() = user_id);

-- Helper: admin check (SECURITY DEFINER avoids infinite recursion in profiles policies)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;

-- 3) Admin: can read all profiles and all orders
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
CREATE POLICY "Admins can view all orders"
  ON public.orders FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can view all order_items" ON public.order_items;
CREATE POLICY "Admins can view all order_items"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- 4) Admin: can update credit_limit and role on any profile (for overrides)
DROP POLICY IF EXISTS "Admins can update any profile credit and role" ON public.profiles;
CREATE POLICY "Admins can update any profile credit and role"
  ON public.profiles FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 5) Admin-only: run daily draw (pick random winner for today, create notification)
CREATE OR REPLACE FUNCTION public.run_daily_draw()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_winner_id UUID;
  v_winner_name TEXT;
  v_draw_date DATE := CURRENT_DATE;
BEGIN
  SELECT id INTO v_admin_id FROM public.profiles WHERE id = auth.uid() AND role = 'admin';
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not admin');
  END IF;

  SELECT user_id INTO v_winner_id
  FROM public.draws_entries
  WHERE draw_date = v_draw_date AND eligible = true
  ORDER BY random()
  LIMIT 1;

  IF v_winner_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No eligible entries for today');
  END IF;

  SELECT name INTO v_winner_name FROM public.profiles WHERE id = v_winner_id;

  INSERT INTO public.notifications (user_id, type, title, body, read)
  VALUES (
    v_winner_id,
    'draw_result',
    'You won today''s draw! 🎉',
    'Congratulations! You have been selected as today''s daily draw winner.',
    false
  );

  RETURN jsonb_build_object(
    'ok', true,
    'winner_id', v_winner_id,
    'winner_name', COALESCE(v_winner_name, 'Vendor')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_daily_draw() TO authenticated;


-- ========== run-this-in-supabase-part5-catalog.sql ==========

-- VendorHub: Catalog hierarchy + GST (sectors, categories, products, variants)
-- Run AFTER part1–part4. Extends catalog; existing order_items/orders stay valid.

-- 1) Sectors (vendor types)
CREATE TABLE IF NOT EXISTS public.sectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read sectors" ON public.sectors;
CREATE POLICY "Anyone can read sectors" ON public.sectors FOR SELECT USING (true);

-- 2) Categories (per sector, with GST rate %)
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sector_id UUID NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  gst_rate INTEGER NOT NULL DEFAULT 5 CHECK (gst_rate IN (0, 5, 12, 18)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read categories" ON public.categories;
CREATE POLICY "Anyone can read categories" ON public.categories FOR SELECT USING (true);

-- 3) Products (with MRP, selling price, discount %, GST)
CREATE TABLE IF NOT EXISTS public.catalog_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_hi TEXT,
  name_te TEXT,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  description TEXT,
  description_hi TEXT,
  description_te TEXT,
  mrp INTEGER NOT NULL DEFAULT 0,
  selling_price INTEGER NOT NULL DEFAULT 0,
  discount_percent INTEGER NOT NULL DEFAULT 0,
  gst_rate INTEGER NOT NULL DEFAULT 5,
  image_url TEXT,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  is_eco BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.catalog_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read catalog_products" ON public.catalog_products;
CREATE POLICY "Anyone can read catalog_products" ON public.catalog_products FOR SELECT USING (true);

-- 4) Product variants (e.g. 1kg / 5kg / 10kg)
CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  variant_label TEXT NOT NULL,
  variant_price INTEGER NOT NULL,
  variant_stock INTEGER NOT NULL DEFAULT 0,
  weight_unit TEXT,
  UNIQUE(product_id, variant_label)
);

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read product_variants" ON public.product_variants;
CREATE POLICY "Anyone can read product_variants" ON public.product_variants FOR SELECT USING (true);

-- 5) Extend order_items for GST/variant (nullable for existing rows)
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS variant_label TEXT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS mrp INTEGER;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS gst_rate INTEGER;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS discount_amount INTEGER;

-- 6) Extend orders for GST totals
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS gst_total INTEGER;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS subtotal_before_tax INTEGER;

-- 7) Seed sectors
INSERT INTO public.sectors (id, name, icon) VALUES
  ('a0000001-0001-4000-8000-000000000001', 'PaniPuri', '🎪'),
  ('a0000002-0002-4000-8000-000000000002', 'Tiffin Centres', '🍱'),
  ('a0000003-0003-4000-8000-000000000003', 'Pan Shops', '🌿'),
  ('a0000004-0004-4000-8000-000000000004', 'Tea Stalls', '☕'),
  ('a0000005-0005-4000-8000-000000000005', 'Fast Food Carts', '🍟')
ON CONFLICT (name) DO NOTHING;

-- 8) Seed categories (sector_id from above)
INSERT INTO public.categories (id, name, sector_id, gst_rate) VALUES
  ('b0000001-0001-4000-8000-000000000001', 'Groceries', 'a0000001-0001-4000-8000-000000000001', 5),
  ('b0000002-0002-4000-8000-000000000002', 'Disposables', 'a0000001-0001-4000-8000-000000000001', 12),
  ('b0000003-0003-4000-8000-000000000003', 'General', 'a0000004-0004-4000-8000-000000000004', 5),
  ('b0000004-0004-4000-8000-000000000004', 'Vegetables', 'a0000002-0002-4000-8000-000000000002', 0),
  ('b0000005-0005-4000-8000-000000000005', 'Services', 'a0000003-0003-4000-8000-000000000003', 18)
ON CONFLICT (id) DO NOTHING;

-- 9) Seed catalog_products (prices in paise: ₹1 = 100)
INSERT INTO public.catalog_products (id, name, name_hi, name_te, category_id, description, description_hi, description_te, mrp, selling_price, discount_percent, gst_rate, image_url, stock_quantity, is_eco) VALUES
  ('c0000001-0001-4000-8000-000000000001', 'Basmati Rice', 'बासमती चावल', 'బాస్మతి అన్నం', 'b0000001-0001-4000-8000-000000000001', 'Premium basmati rice for biryani and pulao.', 'बिरयानी और पुलाव के लिए प्रीमियम बासमती चावल।', 'బిర్యానీ మరియు పులావ్ కోసం ప్రీమియం బాస్మతి అన్నం.', 6000, 5500, 8, 5, '🍚', 100, false),
  ('c0000002-0002-4000-8000-000000000002', 'Paper Plates (100 pcs)', 'पेपर प्लेट (100)', 'పేపర్ ప్లేట్లు (100)', 'b0000002-0002-4000-8000-000000000002', 'Biodegradable paper plates.', 'बायोडिग्रेडेबल पेपर प्लेट।', 'బయోడిగ్రేడబుల్ పేపర్ ప్లేట్లు.', 9900, 9900, 0, 12, '🍽️', 200, true),
  ('c0000003-0003-4000-8000-000000000003', 'Matchbox Pack (10)', 'माचिस पैक (10)', 'అగ్గిపెట్టె ప్యాక్ (10)', 'b0000003-0003-4000-8000-000000000003', 'Standard safety matches.', 'स्टैंडर्ड सेफ्टी माचिस।', 'స్టాండర్డ్ సేఫ్టీ అగ్గిపెట్టెలు.', 3000, 3000, 0, 5, '🔥', 150, false),
  ('c0000004-0004-4000-8000-000000000004', 'Tea Powder (1kg)', 'चाय पाउडर (1kg)', 'టీ పొడి (1kg)', 'b0000003-0003-4000-8000-000000000003', 'Premium CTC tea powder.', 'प्रीमियम CTC चाय पाउडर।', 'ప్రీమియం CTC టీ పొడి.', 32000, 32000, 0, 5, '🍵', 80, false),
  ('c0000005-0005-4000-8000-000000000005', 'Sugar (5kg)', 'चीनी (5kg)', 'చక్కెర (5kg)', 'b0000001-0001-4000-8000-000000000001', 'Refined sugar 5kg bag.', 'रिफाइंड चीनी 5kg बैग।', 'రిఫైన్డ్ చక్కెర 5kg బ్యాగ్.', 25000, 25000, 0, 5, '🍬', 60, false)
ON CONFLICT (id) DO NOTHING;

-- 10) Seed product_variants (Basmati Rice: 1kg, 5kg, 10kg)
INSERT INTO public.product_variants (product_id, variant_label, variant_price, variant_stock, weight_unit) VALUES
  ('c0000001-0001-4000-8000-000000000001', '1kg', 5500, 50, 'kg'),
  ('c0000001-0001-4000-8000-000000000001', '5kg', 25000, 30, 'kg'),
  ('c0000001-0001-4000-8000-000000000001', '10kg', 48000, 20, 'kg')
ON CONFLICT (product_id, variant_label) DO NOTHING;

-- Realtime for stock (optional)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.catalog_products;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.product_variants;


-- ========== run-this-in-supabase-part6-sales-pos.sql ==========

-- VendorHub: Vendor Sales Menu + POS (default menu, vendor menu, customer orders)
-- Run AFTER part1–part5. Requires sectors (part5).

-- 1) Default menu items per sector (pre-loaded templates)
CREATE TABLE IF NOT EXISTS public.default_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id UUID NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  description TEXT,
  default_selling_price_range TEXT NOT NULL,
  gst_rate INTEGER NOT NULL DEFAULT 5 CHECK (gst_rate IN (0, 5, 12, 18)),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  image_url TEXT,
  is_popular BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(sector_id, item_name)
);

ALTER TABLE public.default_menu_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read default_menu_items" ON public.default_menu_items;
CREATE POLICY "Anyone can read default_menu_items" ON public.default_menu_items FOR SELECT USING (true);

-- 2) Vendor's menu (copied from default + custom prices)
CREATE TABLE IF NOT EXISTS public.vendor_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  default_menu_item_id UUID REFERENCES public.default_menu_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  description TEXT,
  default_selling_price_range TEXT,
  gst_rate INTEGER NOT NULL DEFAULT 5,
  custom_selling_price DECIMAL(10,2) NOT NULL,
  custom_description TEXT,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(vendor_id, default_menu_item_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_menu_vendor ON public.vendor_menu_items(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_menu_active ON public.vendor_menu_items(vendor_id, is_active);

ALTER TABLE public.vendor_menu_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Vendor can manage own menu" ON public.vendor_menu_items;
CREATE POLICY "Vendor can manage own menu" ON public.vendor_menu_items FOR ALL
  USING (auth.uid() = vendor_id) WITH CHECK (auth.uid() = vendor_id);
DROP POLICY IF EXISTS "Anyone can read active vendor menu" ON public.vendor_menu_items;
CREATE POLICY "Anyone can read active vendor menu" ON public.vendor_menu_items FOR SELECT
  USING (is_active = true);

-- 3) Customer orders (sales by vendor to end-customers)
CREATE TABLE IF NOT EXISTS public.customer_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_name_phone TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  gst_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'upi', 'online')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'prepared', 'delivered', 'paid')),
  payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_orders_vendor ON public.customer_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_customer_orders_created ON public.customer_orders(vendor_id, created_at DESC);

ALTER TABLE public.customer_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Vendor can manage own customer_orders" ON public.customer_orders;
CREATE POLICY "Vendor can manage own customer_orders" ON public.customer_orders FOR ALL
  USING (auth.uid() = vendor_id) WITH CHECK (auth.uid() = vendor_id);
DROP POLICY IF EXISTS "Vendor can read own customer_orders" ON public.customer_orders;
CREATE POLICY "Vendor can read own customer_orders" ON public.customer_orders FOR SELECT
  USING (auth.uid() = vendor_id);

-- 4) Optional: profile sector for menu (link stall to sector)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sector_id UUID REFERENCES public.sectors(id) ON DELETE SET NULL;

-- 5) Seed default_menu_items (8–12 items per sector). Sectors: PaniPuri, Tiffin, Pan, Tea, Fast Food
-- PaniPuri (a0000001)
INSERT INTO public.default_menu_items (sector_id, item_name, description, default_selling_price_range, gst_rate, image_url, is_popular, sort_order)
VALUES
  ('a0000001-0001-4000-8000-000000000001', 'Pani Puri', 'Crisp puris with flavoured water', '20-30', 5, '🥟', true, 1),
  ('a0000001-0001-4000-8000-000000000001', 'Sev Puri', 'Flat puri with sev and chutneys', '35-45', 5, '🍽️', true, 2),
  ('a0000001-0001-4000-8000-000000000001', 'Dahi Puri', 'Puri with curd and tamarind', '40-50', 5, '🥛', true, 3),
  ('a0000001-0001-4000-8000-000000000001', 'Bhel Puri', 'Puffed rice with chutneys', '30-40', 5, '🍚', false, 4),
  ('a0000001-0001-4000-8000-000000000001', 'Pav Bhaji', 'Buttered pav with vegetable bhaji', '50-60', 5, '🍞', true, 5),
  ('a0000001-0001-4000-8000-000000000001', 'Masala Puri', 'Crushed puri with gravy', '35-45', 5, '🥣', false, 6),
  ('a0000001-0001-4000-8000-000000000001', 'Raj Kachori', 'Large kachori with fillings', '50-60', 5, '🥟', false, 7),
  ('a0000001-0001-4000-8000-000000000001', 'Aloo Tikki', 'Crispy potato patty', '25-35', 5, '🥔', false, 8)
ON CONFLICT (sector_id, item_name) DO NOTHING;

-- Tiffin Centres (a0000002)
INSERT INTO public.default_menu_items (sector_id, item_name, description, default_selling_price_range, gst_rate, image_url, is_popular, sort_order)
VALUES
  ('a0000002-0002-4000-8000-000000000002', 'Idli (plate)', 'Steamed rice cakes with chutney', '35-45', 5, '🍚', true, 1),
  ('a0000002-0002-4000-8000-000000000002', 'Dosa', 'Crispy rice crepe', '50-70', 5, '🥞', true, 2),
  ('a0000002-0002-4000-8000-000000000002', 'Upma', 'Semolina breakfast', '35-45', 5, '🍲', false, 3),
  ('a0000002-0002-4000-8000-000000000002', 'Pongal', 'Rice and lentil dish', '45-55', 5, '🥣', true, 4),
  ('a0000002-0002-4000-8000-000000000002', 'Vada (2 pcs)', 'Lentil donuts', '25-35', 5, '🍩', true, 5),
  ('a0000002-0002-4000-8000-000000000002', 'Medu Vada', 'Crispy lentil vada', '30-40', 5, '🥯', false, 6),
  ('a0000002-0002-4000-8000-000000000002', 'Uttapam', 'Thick rice pancake', '50-65', 5, '🥞', false, 7),
  ('a0000002-0002-4000-8000-000000000002', 'Pesarattu', 'Green gram crepe', '45-55', 5, '🫓', false, 8)
ON CONFLICT (sector_id, item_name) DO NOTHING;

-- Pan Shops (a0000003)
INSERT INTO public.default_menu_items (sector_id, item_name, description, default_selling_price_range, gst_rate, image_url, is_popular, sort_order)
VALUES
  ('a0000003-0003-4000-8000-000000000003', 'Paan', 'Betel leaf with fillings', '15-25', 5, '🌿', true, 1),
  ('a0000003-0003-4000-8000-000000000003', 'Gutka pack', 'Packaged chewable', '40-60', 18, '📦', true, 2),
  ('a0000003-0003-4000-8000-000000000003', 'Cigarettes (pack)', 'Standard pack', '250-300', 18, '🚬', false, 3),
  ('a0000003-0003-4000-8000-000000000003', 'Lighter', 'Disposable lighter', '20-30', 18, '🔥', false, 4),
  ('a0000003-0003-4000-8000-000000000003', 'Meetha Paan', 'Sweet paan', '20-30', 5, '🌿', true, 5),
  ('a0000003-0003-4000-8000-000000000003', 'Chocolate Paan', 'Chocolate-filled paan', '30-40', 5, '🌿', false, 6)
ON CONFLICT (sector_id, item_name) DO NOTHING;

-- Tea Stalls (a0000004)
INSERT INTO public.default_menu_items (sector_id, item_name, description, default_selling_price_range, gst_rate, image_url, is_popular, sort_order)
VALUES
  ('a0000004-0004-4000-8000-000000000004', 'Chai', 'Kadak masala chai', '10-15', 5, '☕', true, 1),
  ('a0000004-0004-4000-8000-000000000004', 'Snack (biscuit/samosa)', 'Tea-time snack', '10-20', 5, '🥐', true, 2),
  ('a0000004-0004-4000-8000-000000000004', 'Biscuit (pack)', '2-4 biscuits', '5-10', 5, '🍪', false, 3),
  ('a0000004-0004-4000-8000-000000000004', 'Bun Maska', 'Bun with butter', '15-25', 5, '🍞', true, 4),
  ('a0000004-0004-4000-8000-000000000004', 'Omelette', 'Egg omelette', '25-35', 5, '🍳', false, 5),
  ('a0000004-0004-4000-8000-000000000004', 'Milk', 'Hot/cold milk', '15-20', 5, '🥛', false, 6),
  ('a0000004-0004-4000-8000-000000000004', 'Ginger Chai', 'Adrak wali chai', '12-18', 5, '☕', false, 7),
  ('a0000004-0004-4000-8000-000000000004', 'Lemon Tea', 'Nimbu chai', '15-20', 5, '🍋', false, 8)
ON CONFLICT (sector_id, item_name) DO NOTHING;

-- Fast Food Carts (a0000005)
INSERT INTO public.default_menu_items (sector_id, item_name, description, default_selling_price_range, gst_rate, image_url, is_popular, sort_order)
VALUES
  ('a0000005-0005-4000-8000-000000000005', 'Burger', 'Veg/egg burger', '50-70', 5, '🍔', true, 1),
  ('a0000005-0005-4000-8000-000000000005', 'Sandwich', 'Grilled sandwich', '40-60', 5, '🥪', true, 2),
  ('a0000005-0005-4000-8000-000000000005', 'French Fries', 'Crispy fries', '40-50', 5, '🍟', true, 3),
  ('a0000005-0005-4000-8000-000000000005', 'Maggi', 'Instant noodles', '30-40', 5, '🍜', true, 4),
  ('a0000005-0005-4000-8000-000000000005', 'Cold Drink', 'Soft drink', '20-30', 12, '🥤', false, 5),
  ('a0000005-0005-4000-8000-000000000005', 'Pav Bhaji', 'Buttered pav with bhaji', '50-65', 5, '🍞', false, 6),
  ('a0000005-0005-4000-8000-000000000005', 'Egg Roll', 'Paratha with egg', '50-60', 5, '🌯', false, 7),
  ('a0000005-0005-4000-8000-000000000005', 'Chicken Roll', 'Paratha with chicken', '80-100', 5, '🌯', false, 8)
ON CONFLICT (sector_id, item_name) DO NOTHING;

-- 6) Realtime for customer_orders (vendor notifications) – idempotent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'customer_orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_orders;
  END IF;
END $$;


-- ========== run-this-in-supabase-part7-community-eco-svanidhi.sql ==========

-- VendorHub: Community Marketplace (Vendor Swap), Eco-Perks, SVANidhi stub
-- Run AFTER part1–part6. Adds vendor_swaps, swap_ratings, eco tracking, green_score.

-- 1) Vendor Swap (excess stock peer-to-peer)
CREATE TABLE IF NOT EXISTS public.vendor_swaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price_notes TEXT NOT NULL,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_swaps_vendor ON public.vendor_swaps(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_swaps_status ON public.vendor_swaps(status);
ALTER TABLE public.vendor_swaps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendor can manage own swaps" ON public.vendor_swaps;
CREATE POLICY "Vendor can manage own swaps" ON public.vendor_swaps FOR ALL
  USING (auth.uid() = vendor_id) WITH CHECK (auth.uid() = vendor_id);
DROP POLICY IF EXISTS "Anyone can read approved swaps" ON public.vendor_swaps;
CREATE POLICY "Anyone can read approved swaps" ON public.vendor_swaps FOR SELECT
  USING (status = 'approved');
DROP POLICY IF EXISTS "Admins can view and moderate swaps" ON public.vendor_swaps;
CREATE POLICY "Admins can view and moderate swaps" ON public.vendor_swaps FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- 2) Swap ratings/reviews
CREATE TABLE IF NOT EXISTS public.swap_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  swap_id UUID NOT NULL REFERENCES public.vendor_swaps(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(swap_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_swap_ratings_swap ON public.swap_ratings(swap_id);
ALTER TABLE public.swap_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can add rating" ON public.swap_ratings;
CREATE POLICY "Anyone authenticated can add rating" ON public.swap_ratings FOR INSERT
  WITH CHECK (auth.uid() = reviewer_id);
DROP POLICY IF EXISTS "Anyone can read ratings for approved swaps" ON public.swap_ratings;
CREATE POLICY "Anyone can read ratings for approved swaps" ON public.swap_ratings FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.vendor_swaps s WHERE s.id = swap_id AND s.status = 'approved')
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
DROP POLICY IF EXISTS "Reviewer can update own rating" ON public.swap_ratings;
CREATE POLICY "Reviewer can update own rating" ON public.swap_ratings FOR UPDATE
  USING (auth.uid() = reviewer_id) WITH CHECK (auth.uid() = reviewer_id);

-- 3) Eco tracking: add eco_flag to orders (eco-disposables / low-waste order)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS eco_flag BOOLEAN NOT NULL DEFAULT false;

-- 4) Green Score on profiles (eco purchases + low-waste sales boost score)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS green_score INTEGER NOT NULL DEFAULT 0;

-- 5) Eco redemptions (e.g. tree-planting via NGO tie-up)
CREATE TABLE IF NOT EXISTS public.eco_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redemption_type TEXT NOT NULL DEFAULT 'tree_planting',
  points_spent INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eco_redemptions_user ON public.eco_redemptions(user_id);
ALTER TABLE public.eco_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own eco_redemptions" ON public.eco_redemptions;
CREATE POLICY "Users can view own eco_redemptions" ON public.eco_redemptions FOR SELECT
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own eco_redemptions" ON public.eco_redemptions;
CREATE POLICY "Users can insert own eco_redemptions" ON public.eco_redemptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can view all eco_redemptions" ON public.eco_redemptions;
CREATE POLICY "Admins can view all eco_redemptions" ON public.eco_redemptions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- 6) RPC: increment green_score (e.g. when order has eco_flag)
CREATE OR REPLACE FUNCTION public.increment_green_score(p_user_id UUID, p_delta INTEGER DEFAULT 10)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET green_score = COALESCE(green_score, 0) + p_delta
  WHERE id = p_user_id;
END;
$$;

-- 7) RPC: redeem points for tree-planting (e.g. 100 points = 1 tree via Grow-Trees tie-up)
CREATE OR REPLACE FUNCTION public.redeem_tree_planting(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points INTEGER;
  v_cost INTEGER := 100;
  v_new_points INTEGER;
BEGIN
  SELECT points INTO v_points FROM public.profiles WHERE id = p_user_id;
  IF v_points IS NULL OR v_points < v_cost THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not enough points');
  END IF;
  v_new_points := v_points - v_cost;
  UPDATE public.profiles SET points = v_new_points WHERE id = p_user_id;
  INSERT INTO public.eco_redemptions (user_id, redemption_type, points_spent)
  VALUES (p_user_id, 'tree_planting', v_cost);
  RETURN jsonb_build_object('ok', true, 'points_left', v_new_points);
END;
$$;


-- ========== run-this-in-supabase-part8-rewards.sql ==========

-- VendorHub: Rewards / point redemptions (run AFTER part7)
-- Adds reward_redemptions table and RPC for all loyalty redemptions (trip, repair_kit, credit_boost, supplies_kit).

-- 1) Reward redemptions (all point redemptions except tree-planting which uses eco_redemptions)
CREATE TABLE IF NOT EXISTS public.reward_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('family_trip', 'repair_kit', 'credit_boost', 'supplies_kit')),
  points_spent INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reward_redemptions_user ON public.reward_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_created ON public.reward_redemptions(created_at DESC);
ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own reward_redemptions" ON public.reward_redemptions;
DROP POLICY IF EXISTS "Users can insert own reward_redemptions" ON public.reward_redemptions;
DROP POLICY IF EXISTS "Admins can view all reward_redemptions" ON public.reward_redemptions;

CREATE POLICY "Users can view own reward_redemptions" ON public.reward_redemptions FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reward_redemptions" ON public.reward_redemptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all reward_redemptions" ON public.reward_redemptions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- 2) RPC: redeem points for a reward (deducts from profiles.points, inserts into reward_redemptions)
CREATE OR REPLACE FUNCTION public.redeem_reward(p_user_id UUID, p_reward_type TEXT, p_points_cost INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points INTEGER;
  v_new_points INTEGER;
BEGIN
  IF p_reward_type NOT IN ('family_trip', 'repair_kit', 'credit_boost', 'supplies_kit') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid reward type');
  END IF;
  IF p_points_cost IS NULL OR p_points_cost <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid points cost');
  END IF;

  SELECT points INTO v_points FROM public.profiles WHERE id = p_user_id;
  IF v_points IS NULL OR v_points < p_points_cost THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not enough points');
  END IF;

  v_new_points := v_points - p_points_cost;
  UPDATE public.profiles SET points = v_new_points WHERE id = p_user_id;
  INSERT INTO public.reward_redemptions (user_id, reward_type, points_spent, status)
  VALUES (p_user_id, p_reward_type, p_points_cost, 'pending');

  RETURN jsonb_build_object('ok', true, 'points_left', v_new_points);
END;
$$;


-- ========== run-this-in-supabase-part9-admin-full-crud.sql ==========

-- VendorHub: Admin full CRUD on all tables (run AFTER part1–part8)
-- Gives admins full Create, Read, Update, Delete where applicable.

-- 1) PROFILES – Admin full CRUD (already have SELECT + UPDATE; add DELETE)
DROP POLICY IF EXISTS "Admins can delete any profile" ON public.profiles;
CREATE POLICY "Admins can delete any profile" ON public.profiles FOR DELETE
  USING (public.is_admin());

-- 2) ORDERS – Admin UPDATE and DELETE (already have SELECT)
DROP POLICY IF EXISTS "Admins can update any order" ON public.orders;
CREATE POLICY "Admins can update any order" ON public.orders FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "Admins can delete any order" ON public.orders;
CREATE POLICY "Admins can delete any order" ON public.orders FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- 3) ORDER_ITEMS – Admin INSERT, UPDATE, DELETE (already have SELECT)
DROP POLICY IF EXISTS "Admins can insert any order_item" ON public.order_items;
CREATE POLICY "Admins can insert any order_item" ON public.order_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "Admins can update any order_item" ON public.order_items;
CREATE POLICY "Admins can update any order_item" ON public.order_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "Admins can delete any order_item" ON public.order_items;
CREATE POLICY "Admins can delete any order_item" ON public.order_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- 4) NOTIFICATIONS – Admin SELECT all, UPDATE, DELETE
DROP POLICY IF EXISTS "Admins can view all notifications" ON public.notifications;
CREATE POLICY "Admins can view all notifications" ON public.notifications FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "Admins can update any notification" ON public.notifications;
CREATE POLICY "Admins can update any notification" ON public.notifications FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "Admins can delete any notification" ON public.notifications;
CREATE POLICY "Admins can delete any notification" ON public.notifications FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- 5) FORUM_TOPICS – Admin UPDATE, DELETE
DROP POLICY IF EXISTS "Admins can update any forum_topic" ON public.forum_topics;
CREATE POLICY "Admins can update any forum_topic" ON public.forum_topics FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "Admins can delete any forum_topic" ON public.forum_topics;
CREATE POLICY "Admins can delete any forum_topic" ON public.forum_topics FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- 6) FORUM_REPLIES – Admin UPDATE, DELETE
DROP POLICY IF EXISTS "Admins can update any forum_reply" ON public.forum_replies;
CREATE POLICY "Admins can update any forum_reply" ON public.forum_replies FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "Admins can delete any forum_reply" ON public.forum_replies;
CREATE POLICY "Admins can delete any forum_reply" ON public.forum_replies FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- 7) CUSTOMER_ORDERS (part6) – Admin SELECT all, UPDATE, DELETE
DROP POLICY IF EXISTS "Admins can view all customer_orders" ON public.customer_orders;
CREATE POLICY "Admins can view all customer_orders" ON public.customer_orders FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "Admins can update any customer_order" ON public.customer_orders;
CREATE POLICY "Admins can update any customer_order" ON public.customer_orders FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "Admins can delete any customer_order" ON public.customer_orders;
CREATE POLICY "Admins can delete any customer_order" ON public.customer_orders FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- 8) SWAP_RATINGS – Admin SELECT all, DELETE (moderation)
DROP POLICY IF EXISTS "Admins can delete any swap_rating" ON public.swap_ratings;
CREATE POLICY "Admins can delete any swap_rating" ON public.swap_ratings FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- 9) REWARD_REDEMPTIONS – Admin UPDATE, DELETE
DROP POLICY IF EXISTS "Admins can update any reward_redemption" ON public.reward_redemptions;
CREATE POLICY "Admins can update any reward_redemption" ON public.reward_redemptions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "Admins can delete any reward_redemption" ON public.reward_redemptions;
CREATE POLICY "Admins can delete any reward_redemption" ON public.reward_redemptions FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- 10) ECO_REDEMPTIONS – Admin UPDATE, DELETE
DROP POLICY IF EXISTS "Admins can update any eco_redemption" ON public.eco_redemptions;
CREATE POLICY "Admins can update any eco_redemption" ON public.eco_redemptions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "Admins can delete any eco_redemption" ON public.eco_redemptions;
CREATE POLICY "Admins can delete any eco_redemption" ON public.eco_redemptions FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- 11) LOYALTY_POINTS – Admin SELECT all, UPDATE, INSERT, DELETE
DROP POLICY IF EXISTS "Admins can view all loyalty_points" ON public.loyalty_points;
CREATE POLICY "Admins can view all loyalty_points" ON public.loyalty_points FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "Admins can update any loyalty_points" ON public.loyalty_points;
CREATE POLICY "Admins can update any loyalty_points" ON public.loyalty_points FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "Admins can insert loyalty_points" ON public.loyalty_points;
CREATE POLICY "Admins can insert loyalty_points" ON public.loyalty_points FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "Admins can delete any loyalty_points" ON public.loyalty_points;
CREATE POLICY "Admins can delete any loyalty_points" ON public.loyalty_points FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- 12) DRAWS_ENTRIES – Admin SELECT all, DELETE
DROP POLICY IF EXISTS "Admins can view all draws_entries" ON public.draws_entries;
CREATE POLICY "Admins can view all draws_entries" ON public.draws_entries FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "Admins can delete any draws_entry" ON public.draws_entries;
CREATE POLICY "Admins can delete any draws_entry" ON public.draws_entries FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- 13) PURCHASES_DAILY – Admin SELECT all
DROP POLICY IF EXISTS "Admins can view all purchases_daily" ON public.purchases_daily;
CREATE POLICY "Admins can view all purchases_daily" ON public.purchases_daily FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- 14) PUSH_SUBSCRIPTIONS – Admin SELECT all, DELETE
DROP POLICY IF EXISTS "Admins can view all push_subscriptions" ON public.push_subscriptions;
CREATE POLICY "Admins can view all push_subscriptions" ON public.push_subscriptions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "Admins can delete any push_subscription" ON public.push_subscriptions;
CREATE POLICY "Admins can delete any push_subscription" ON public.push_subscriptions FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- 15) VENDOR_MENU_ITEMS – Admin SELECT all (for any vendor), UPDATE, DELETE
DROP POLICY IF EXISTS "Admins can view all vendor_menu_items" ON public.vendor_menu_items;
CREATE POLICY "Admins can view all vendor_menu_items" ON public.vendor_menu_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "Admins can update any vendor_menu_item" ON public.vendor_menu_items;
CREATE POLICY "Admins can update any vendor_menu_item" ON public.vendor_menu_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "Admins can delete any vendor_menu_item" ON public.vendor_menu_items;
CREATE POLICY "Admins can delete any vendor_menu_item" ON public.vendor_menu_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- 16) DEFAULT_MENU_ITEMS – Admin INSERT, UPDATE, DELETE (anyone can read)
DROP POLICY IF EXISTS "Admins can insert default_menu_items" ON public.default_menu_items;
CREATE POLICY "Admins can insert default_menu_items" ON public.default_menu_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "Admins can update default_menu_items" ON public.default_menu_items;
CREATE POLICY "Admins can update default_menu_items" ON public.default_menu_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "Admins can delete default_menu_items" ON public.default_menu_items;
CREATE POLICY "Admins can delete default_menu_items" ON public.default_menu_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- 17) SECTORS – Admin INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "Admins can insert sectors" ON public.sectors;
CREATE POLICY "Admins can insert sectors" ON public.sectors FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "Admins can update sectors" ON public.sectors;
CREATE POLICY "Admins can update sectors" ON public.sectors FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "Admins can delete sectors" ON public.sectors;
CREATE POLICY "Admins can delete sectors" ON public.sectors FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- 18) CATEGORIES – Admin INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "Admins can insert categories" ON public.categories;
CREATE POLICY "Admins can insert categories" ON public.categories FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "Admins can update categories" ON public.categories;
CREATE POLICY "Admins can update categories" ON public.categories FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "Admins can delete categories" ON public.categories;
CREATE POLICY "Admins can delete categories" ON public.categories FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- 19) CATALOG_PRODUCTS – Admin INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "Admins can insert catalog_products" ON public.catalog_products;
CREATE POLICY "Admins can insert catalog_products" ON public.catalog_products FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "Admins can update catalog_products" ON public.catalog_products;
CREATE POLICY "Admins can update catalog_products" ON public.catalog_products FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "Admins can delete catalog_products" ON public.catalog_products;
CREATE POLICY "Admins can delete catalog_products" ON public.catalog_products FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- 20) PRODUCT_VARIANTS – Admin INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "Admins can insert product_variants" ON public.product_variants;
CREATE POLICY "Admins can insert product_variants" ON public.product_variants FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "Admins can update product_variants" ON public.product_variants;
CREATE POLICY "Admins can update product_variants" ON public.product_variants FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "Admins can delete product_variants" ON public.product_variants;
CREATE POLICY "Admins can delete product_variants" ON public.product_variants FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- 21) COURSE_PROGRESS – Admin SELECT all, DELETE (for support)
DROP POLICY IF EXISTS "Admins can view all course_progress" ON public.course_progress;
CREATE POLICY "Admins can view all course_progress" ON public.course_progress FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "Admins can delete any course_progress" ON public.course_progress;
CREATE POLICY "Admins can delete any course_progress" ON public.course_progress FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));


-- ========== run-this-in-supabase-part10-svanidhi-support.sql ==========

-- VendorHub: SVANidhi support requests – vendors request help, admin sees and follows up
-- Run AFTER part9. Creates svanidhi_support_requests.

CREATE TABLE IF NOT EXISTS public.svanidhi_support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'done')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optional: keep updated_at in sync on update (Supabase has no built-in)
CREATE OR REPLACE FUNCTION public.set_svanidhi_support_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS svanidhi_support_updated ON public.svanidhi_support_requests;
CREATE TRIGGER svanidhi_support_updated
  BEFORE UPDATE ON public.svanidhi_support_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_svanidhi_support_updated_at();

CREATE INDEX IF NOT EXISTS idx_svanidhi_support_user ON public.svanidhi_support_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_svanidhi_support_created ON public.svanidhi_support_requests(created_at DESC);
ALTER TABLE public.svanidhi_support_requests ENABLE ROW LEVEL SECURITY;

-- Vendors can insert their own request (one row per click)
DROP POLICY IF EXISTS "Users can insert own SVANidhi support request" ON public.svanidhi_support_requests;
CREATE POLICY "Users can insert own SVANidhi support request" ON public.svanidhi_support_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Vendors can read their own requests (optional, for "see my requests" later)
DROP POLICY IF EXISTS "Users can read own SVANidhi support requests" ON public.svanidhi_support_requests;
CREATE POLICY "Users can read own SVANidhi support requests" ON public.svanidhi_support_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read all and update (status, notes)
DROP POLICY IF EXISTS "Admins can view all SVANidhi support requests" ON public.svanidhi_support_requests;
CREATE POLICY "Admins can view all SVANidhi support requests" ON public.svanidhi_support_requests FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Admins can update SVANidhi support requests" ON public.svanidhi_support_requests;
CREATE POLICY "Admins can update SVANidhi support requests" ON public.svanidhi_support_requests FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));


-- ========== run-this-in-supabase-part11-business-details.sql ==========

-- VendorHub: Business details for profile (SVANidhi / compliance)
-- Run AFTER part10. Adds columns to profiles and optional storage for shop photos.

-- 1) Profile columns: complete business address, shop photos (2–3), optional GST/PAN/UDYAM/FSSAI, other
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_address TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS shop_photo_urls JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gst_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pan_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS udyam_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fssai_license TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS other_business_details TEXT;

-- Backfill: if business_address is null, copy from stall_address for existing rows
UPDATE public.profiles SET business_address = stall_address WHERE business_address IS NULL AND stall_address IS NOT NULL;

-- 2) Storage bucket for vendor shop photos (2–3 images per vendor)
-- Bucket is public so profile page can show images. Vendors upload to folder: {user_id}/filename
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vendor-shop-photos',
  'vendor-shop-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS: authenticated users can upload/update/delete only in their own folder ({user_id}/...)
DROP POLICY IF EXISTS "Vendors can upload own shop photos" ON storage.objects;
CREATE POLICY "Vendors can upload own shop photos" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'vendor-shop-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Vendors can update own shop photos" ON storage.objects;
CREATE POLICY "Vendors can update own shop photos" ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'vendor-shop-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Vendors can delete own shop photos" ON storage.objects;
CREATE POLICY "Vendors can delete own shop photos" ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'vendor-shop-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public read (bucket is public)
DROP POLICY IF EXISTS "Public read vendor shop photos" ON storage.objects;
CREATE POLICY "Public read vendor shop photos" ON storage.objects FOR SELECT
  USING (bucket_id = 'vendor-shop-photos');


-- ========== run-this-in-supabase-part12-incentives-ads.sql ==========

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

-- 2) vendor_incentives
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

-- 3) profiles.zone for ad targeting
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS zone TEXT;

-- 4) ads
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

-- 5) ad_impressions
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

-- 7) Seed sample ads
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

-- 8) RPC: run_daily_incentive_calc
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
    SELECT reward_amount INTO v_reward
    FROM incentive_slabs
    WHERE slab_type = 'daily' AND is_active = true
      AND min_count <= v_vendor.cnt AND (max_count IS NULL OR max_count >= v_vendor.cnt)
    ORDER BY min_count DESC LIMIT 1;
    IF v_reward > 0 THEN
      INSERT INTO vendor_incentives (vendor_id, slab_date, slab_type, entry_count, earned_amount, status)
      VALUES (v_vendor.vendor_id, v_yesterday, 'daily', v_vendor.cnt, v_reward, 'pending')
      ON CONFLICT (vendor_id, slab_date, slab_type) DO UPDATE
      SET entry_count = EXCLUDED.entry_count, earned_amount = EXCLUDED.earned_amount;
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'count', v_count);
END;
$$;

-- 9) RPC: run_monthly_draw
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

