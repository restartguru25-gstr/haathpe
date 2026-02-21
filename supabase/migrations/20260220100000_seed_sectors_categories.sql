-- Seed sectors and categories for Kirana, Electricals, Paint, Street Food, Juice, Coffee, etc.
-- Run: supabase db push  OR  paste in Supabase SQL Editor
-- Uses ON CONFLICT (name) so safe to run multiple times; skips existing sectors

-- 1) Sectors (emoji icons) – only inserts if name doesn't exist
INSERT INTO public.sectors (name, icon) VALUES
  ('PaniPuri', '🎪'),
  ('Tiffin Centres', '🍱'),
  ('Pan Shops', '🌿'),
  ('Tea Stalls', '☕'),
  ('Fast Food Carts', '🍟'),
  ('Kirana Store', '🏪'),
  ('Electricals', '⚡'),
  ('Paint & Hardware', '🎨'),
  ('Street Food', '🥡'),
  ('Juice & Beverages', '🧃'),
  ('Coffee Shop', '☕'),
  ('Hardware Shop', '🔧'),
  ('Groceries', '🛒'),
  ('Saloon/Spa', '💇'),
  ('General Store', '🏬')
ON CONFLICT (name) DO NOTHING;

-- 2) Categories – lookup sector by name, skip if category already exists for that sector
INSERT INTO public.categories (name, sector_id, gst_rate)
SELECT 'Groceries', s.id, 5 FROM public.sectors s WHERE s.name = 'Kirana Store'
  AND NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.sector_id = s.id AND c.name = 'Groceries');
INSERT INTO public.categories (name, sector_id, gst_rate)
SELECT 'FMCG', s.id, 18 FROM public.sectors s WHERE s.name = 'Kirana Store'
  AND NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.sector_id = s.id AND c.name = 'FMCG');
INSERT INTO public.categories (name, sector_id, gst_rate)
SELECT 'Snacks', s.id, 12 FROM public.sectors s WHERE s.name = 'Kirana Store'
  AND NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.sector_id = s.id AND c.name = 'Snacks');

INSERT INTO public.categories (name, sector_id, gst_rate)
SELECT 'Lighting', s.id, 18 FROM public.sectors s WHERE s.name = 'Electricals'
  AND NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.sector_id = s.id AND c.name = 'Lighting');
INSERT INTO public.categories (name, sector_id, gst_rate)
SELECT 'Switches & Wiring', s.id, 18 FROM public.sectors s WHERE s.name = 'Electricals'
  AND NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.sector_id = s.id AND c.name = 'Switches & Wiring');
INSERT INTO public.categories (name, sector_id, gst_rate)
SELECT 'Fans & Appliances', s.id, 18 FROM public.sectors s WHERE s.name = 'Electricals'
  AND NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.sector_id = s.id AND c.name = 'Fans & Appliances');

INSERT INTO public.categories (name, sector_id, gst_rate)
SELECT 'Paints', s.id, 18 FROM public.sectors s WHERE s.name = 'Paint & Hardware'
  AND NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.sector_id = s.id AND c.name = 'Paints');
INSERT INTO public.categories (name, sector_id, gst_rate)
SELECT 'Hardware', s.id, 18 FROM public.sectors s WHERE s.name = 'Paint & Hardware'
  AND NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.sector_id = s.id AND c.name = 'Hardware');
INSERT INTO public.categories (name, sector_id, gst_rate)
SELECT 'Tools', s.id, 18 FROM public.sectors s WHERE s.name = 'Paint & Hardware'
  AND NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.sector_id = s.id AND c.name = 'Tools');

INSERT INTO public.categories (name, sector_id, gst_rate)
SELECT 'Snacks', s.id, 5 FROM public.sectors s WHERE s.name = 'Street Food'
  AND NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.sector_id = s.id AND c.name = 'Snacks');
INSERT INTO public.categories (name, sector_id, gst_rate)
SELECT 'Beverages', s.id, 5 FROM public.sectors s WHERE s.name = 'Street Food'
  AND NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.sector_id = s.id AND c.name = 'Beverages');
INSERT INTO public.categories (name, sector_id, gst_rate)
SELECT 'Disposables', s.id, 12 FROM public.sectors s WHERE s.name = 'Street Food'
  AND NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.sector_id = s.id AND c.name = 'Disposables');

INSERT INTO public.categories (name, sector_id, gst_rate)
SELECT 'Fresh Juice', s.id, 5 FROM public.sectors s WHERE s.name = 'Juice & Beverages'
  AND NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.sector_id = s.id AND c.name = 'Fresh Juice');
INSERT INTO public.categories (name, sector_id, gst_rate)
SELECT 'Beverages', s.id, 5 FROM public.sectors s WHERE s.name = 'Juice & Beverages'
  AND NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.sector_id = s.id AND c.name = 'Beverages');
INSERT INTO public.categories (name, sector_id, gst_rate)
SELECT 'Shakes', s.id, 5 FROM public.sectors s WHERE s.name = 'Juice & Beverages'
  AND NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.sector_id = s.id AND c.name = 'Shakes');

INSERT INTO public.categories (name, sector_id, gst_rate)
SELECT 'Coffee', s.id, 5 FROM public.sectors s WHERE s.name = 'Coffee Shop'
  AND NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.sector_id = s.id AND c.name = 'Coffee');
INSERT INTO public.categories (name, sector_id, gst_rate)
SELECT 'Tea', s.id, 5 FROM public.sectors s WHERE s.name = 'Coffee Shop'
  AND NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.sector_id = s.id AND c.name = 'Tea');
INSERT INTO public.categories (name, sector_id, gst_rate)
SELECT 'Snacks', s.id, 5 FROM public.sectors s WHERE s.name = 'Coffee Shop'
  AND NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.sector_id = s.id AND c.name = 'Snacks');

INSERT INTO public.categories (name, sector_id, gst_rate)
SELECT 'Tools', s.id, 18 FROM public.sectors s WHERE s.name = 'Hardware Shop'
  AND NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.sector_id = s.id AND c.name = 'Tools');
INSERT INTO public.categories (name, sector_id, gst_rate)
SELECT 'Fasteners', s.id, 18 FROM public.sectors s WHERE s.name = 'Hardware Shop'
  AND NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.sector_id = s.id AND c.name = 'Fasteners');
INSERT INTO public.categories (name, sector_id, gst_rate)
SELECT 'Paints & Chemicals', s.id, 18 FROM public.sectors s WHERE s.name = 'Hardware Shop'
  AND NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.sector_id = s.id AND c.name = 'Paints & Chemicals');

INSERT INTO public.categories (name, sector_id, gst_rate)
SELECT 'Staples', s.id, 5 FROM public.sectors s WHERE s.name = 'Groceries'
  AND NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.sector_id = s.id AND c.name = 'Staples');
INSERT INTO public.categories (name, sector_id, gst_rate)
SELECT 'Pulses & Oils', s.id, 5 FROM public.sectors s WHERE s.name = 'Groceries'
  AND NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.sector_id = s.id AND c.name = 'Pulses & Oils');
INSERT INTO public.categories (name, sector_id, gst_rate)
SELECT 'General', s.id, 5 FROM public.sectors s WHERE s.name = 'Groceries'
  AND NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.sector_id = s.id AND c.name = 'General');

INSERT INTO public.categories (name, sector_id, gst_rate)
SELECT 'Hair', s.id, 18 FROM public.sectors s WHERE s.name = 'Saloon/Spa'
  AND NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.sector_id = s.id AND c.name = 'Hair');
INSERT INTO public.categories (name, sector_id, gst_rate)
SELECT 'Beauty', s.id, 18 FROM public.sectors s WHERE s.name = 'Saloon/Spa'
  AND NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.sector_id = s.id AND c.name = 'Beauty');

INSERT INTO public.categories (name, sector_id, gst_rate)
SELECT 'General', s.id, 5 FROM public.sectors s WHERE s.name = 'General Store'
  AND NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.sector_id = s.id AND c.name = 'General');
