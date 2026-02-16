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
