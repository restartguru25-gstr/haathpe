-- Seed default menu items for shop-specific stall types
-- Run this in Supabase SQL Editor after creating sectors + default_menu_items tables
-- Step 1: Insert new sectors (required before default_menu_items due to FK)
-- Step 2: Insert ~15-20 items per sector

-- 1) Insert new sectors (Kirana Store, Hardware Shop, Saloon/Spa)
INSERT INTO public.sectors (id, name, icon) VALUES
  ('a0000006-0006-4000-8000-000000000006', 'Kirana Store', '🏪'),
  ('a0000007-0007-4000-8000-000000000007', 'Hardware Shop', '🔧'),
  ('a0000008-0008-4000-8000-000000000008', 'Saloon/Spa', '💇')
ON CONFLICT (name) DO NOTHING;

-- 2) Kirana Store items (sector_id: a0000006)
INSERT INTO public.default_menu_items (sector_id, item_name, description, default_selling_price_range, gst_rate, image_url, is_popular, sort_order)
VALUES
  ('a0000006-0006-4000-8000-000000000006', 'Rice (1kg)', 'Basmati Rice 1kg', '50-70', 5, '🍚', true, 1),
  ('a0000006-0006-4000-8000-000000000006', 'Wheat Flour (1kg)', 'Aata 1kg', '35-50', 5, '🌾', true, 2),
  ('a0000006-0006-4000-8000-000000000006', 'Sugar (1kg)', 'Crystal Sugar 1kg', '45-60', 5, '🍬', true, 3),
  ('a0000006-0006-4000-8000-000000000006', 'Dal (1kg)', 'Toor Dal 1kg', '120-150', 5, '🫘', true, 4),
  ('a0000006-0006-4000-8000-000000000006', 'Oil (1L)', 'Sunflower Oil 1L', '120-150', 5, '🛢️', true, 5),
  ('a0000006-0006-4000-8000-000000000006', 'Salt (1kg)', 'Iodized Salt 1kg', '20-30', 5, '🧂', false, 6),
  ('a0000006-0006-4000-8000-000000000006', 'Tea (500g)', 'Tea Powder 500g', '80-120', 5, '🍵', true, 7),
  ('a0000006-0006-4000-8000-000000000006', 'Coffee (200g)', 'Instant Coffee 200g', '150-200', 5, '☕', false, 8),
  ('a0000006-0006-4000-8000-000000000006', 'Biscuits (200g)', 'Glucose Biscuits', '25-40', 5, '🍪', true, 9),
  ('a0000006-0006-4000-8000-000000000006', 'Soap (1 piece)', 'Bathing Soap', '25-50', 18, '🧼', true, 10),
  ('a0000006-0006-4000-8000-000000000006', 'Detergent (500g)', 'Washing Powder', '40-70', 18, '🧴', true, 11),
  ('a0000006-0006-4000-8000-000000000006', 'Shampoo (200ml)', 'Hair Shampoo', '80-150', 18, '💧', false, 12),
  ('a0000006-0006-4000-8000-000000000006', 'Toothpaste (100g)', 'Toothpaste Tube', '50-100', 18, '🦷', true, 13),
  ('a0000006-0006-4000-8000-000000000006', 'Maggi (2 min)', 'Instant Noodles', '14-20', 12, '🍜', true, 14),
  ('a0000006-0006-4000-8000-000000000006', 'Chips (50g)', 'Potato Chips', '10-20', 12, '🥔', true, 15),
  ('a0000006-0006-4000-8000-000000000006', 'Candles (pack)', 'Candle Pack 10pcs', '30-50', 18, '🕯️', false, 16),
  ('a0000006-0006-4000-8000-000000000006', 'Matchbox', 'Safety Matches', '2-5', 5, '🔥', false, 17),
  ('a0000006-0006-4000-8000-000000000006', 'Batteries (2pcs)', 'AA Batteries', '30-50', 18, '🔋', false, 18),
  ('a0000006-0006-4000-8000-000000000006', 'Pen (1pc)', 'Ball Pen', '5-15', 18, '✏️', false, 19),
  ('a0000006-0006-4000-8000-000000000006', 'Notebook', 'Ruled Notebook', '20-40', 5, '📓', false, 20)
ON CONFLICT (sector_id, item_name) DO NOTHING;

-- 3) Hardware Shop items (sector_id: a0000007)
INSERT INTO public.default_menu_items (sector_id, item_name, description, default_selling_price_range, gst_rate, image_url, is_popular, sort_order)
VALUES
  ('a0000007-0007-4000-8000-000000000007', 'Screwdriver Set', 'Multi-size Screwdriver Set', '150-300', 18, '🔧', true, 1),
  ('a0000007-0007-4000-8000-000000000007', 'Hammer', 'Claw Hammer', '200-400', 18, '🔨', true, 2),
  ('a0000007-0007-4000-8000-000000000007', 'Pliers', 'Cutting Pliers', '150-300', 18, '🔩', true, 3),
  ('a0000007-0007-4000-8000-000000000007', 'Nails (1kg)', 'Iron Nails', '80-120', 18, '📌', true, 4),
  ('a0000007-0007-4000-8000-000000000007', 'Screws (pack)', 'Screw Pack 100pcs', '50-100', 18, '⚙️', true, 5),
  ('a0000007-0007-4000-8000-000000000007', 'Wire (1m)', 'Electrical Wire', '30-60', 18, '🔌', true, 6),
  ('a0000007-0007-4000-8000-000000000007', 'Switch', 'Electrical Switch', '50-150', 18, '💡', true, 7),
  ('a0000007-0007-4000-8000-000000000007', 'Bulb (LED)', 'LED Bulb 9W', '80-150', 18, '💡', true, 8),
  ('a0000007-0007-4000-8000-000000000007', 'Tape (1 roll)', 'Electrical Tape', '30-60', 18, '📏', false, 9),
  ('a0000007-0007-4000-8000-000000000007', 'Paint Brush', 'Paint Brush Set', '100-200', 18, '🖌️', false, 10),
  ('a0000007-0007-4000-8000-000000000007', 'Paint (1L)', 'Wall Paint', '300-600', 18, '🎨', true, 11),
  ('a0000007-0007-4000-8000-000000000007', 'Hinges (pair)', 'Door Hinges', '50-150', 18, '🚪', false, 12),
  ('a0000007-0007-4000-8000-000000000007', 'Lock', 'Door Lock', '200-500', 18, '🔒', true, 13),
  ('a0000007-0007-4000-8000-000000000007', 'Hose Pipe (10m)', 'Water Hose', '200-400', 18, '🚿', false, 14),
  ('a0000007-0007-4000-8000-000000000007', 'Pipe Fitting', 'PVC Pipe Fitting', '30-100', 18, '🔗', false, 15),
  ('a0000007-0007-4000-8000-000000000007', 'Cement (50kg)', 'Portland Cement', '350-450', 18, '🏗️', true, 16),
  ('a0000007-0007-4000-8000-000000000007', 'Sand (1 bag)', 'Construction Sand', '200-300', 5, '🏖️', false, 17),
  ('a0000007-0007-4000-8000-000000000007', 'Rope (10m)', 'Nylon Rope', '50-100', 18, '🪢', false, 18)
ON CONFLICT (sector_id, item_name) DO NOTHING;

-- 4) Saloon/Spa items (sector_id: a0000008)
INSERT INTO public.default_menu_items (sector_id, item_name, description, default_selling_price_range, gst_rate, image_url, is_popular, sort_order)
VALUES
  ('a0000008-0008-4000-8000-000000000008', 'Haircut (Men)', 'Men Haircut', '50-150', 18, '✂️', true, 1),
  ('a0000008-0008-4000-8000-000000000008', 'Haircut (Women)', 'Women Haircut', '100-300', 18, '💇', true, 2),
  ('a0000008-0008-4000-8000-000000000008', 'Haircut (Kids)', 'Kids Haircut', '40-100', 18, '👶', true, 3),
  ('a0000008-0008-4000-8000-000000000008', 'Hair Wash', 'Hair Wash Service', '50-150', 18, '💆', true, 4),
  ('a0000008-0008-4000-8000-000000000008', 'Hair Color', 'Hair Coloring', '300-800', 18, '🎨', true, 5),
  ('a0000008-0008-4000-8000-000000000008', 'Hair Spa', 'Hair Spa Treatment', '200-500', 18, '💆‍♀️', false, 6),
  ('a0000008-0008-4000-8000-000000000008', 'Beard Trim', 'Beard Styling', '50-150', 18, '🧔', true, 7),
  ('a0000008-0008-4000-8000-000000000008', 'Shave', 'Clean Shave', '30-80', 18, '🪒', true, 8),
  ('a0000008-0008-4000-8000-000000000008', 'Facial (Men)', 'Men Facial', '200-500', 18, '🧖', false, 9),
  ('a0000008-0008-4000-8000-000000000008', 'Facial (Women)', 'Women Facial', '300-800', 18, '🧖‍♀️', true, 10),
  ('a0000008-0008-4000-8000-000000000008', 'Threading', 'Face Threading', '50-150', 18, '🧵', true, 11),
  ('a0000008-0008-4000-8000-000000000008', 'Waxing (Arms)', 'Arm Waxing', '100-300', 18, '💪', false, 12),
  ('a0000008-0008-4000-8000-000000000008', 'Waxing (Legs)', 'Leg Waxing', '200-400', 18, '🦵', false, 13),
  ('a0000008-0008-4000-8000-000000000008', 'Manicure', 'Nail Manicure', '150-400', 18, '💅', false, 14),
  ('a0000008-0008-4000-8000-000000000008', 'Pedicure', 'Foot Pedicure', '200-500', 18, '🦶', false, 15),
  ('a0000008-0008-4000-8000-000000000008', 'Hair Treatment', 'Hair Treatment', '300-1000', 18, '💇‍♀️', false, 16),
  ('a0000008-0008-4000-8000-000000000008', 'Head Massage', 'Head Massage', '100-300', 18, '💆', true, 17),
  ('a0000008-0008-4000-8000-000000000008', 'Body Massage', 'Full Body Massage', '500-1500', 18, '💆‍♂️', false, 18)
ON CONFLICT (sector_id, item_name) DO NOTHING;

-- Note: Run this SQL in Supabase SQL Editor
-- After running, vendors with stall_type = 'Kirana Store' will see 20 items
-- Hardware Shop vendors will see 18 items
-- Saloon/Spa vendors will see 18 items
-- When they click "Activate Default Menu", these items will be copied to their vendor_menu_items
