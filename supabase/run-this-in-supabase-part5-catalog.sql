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
