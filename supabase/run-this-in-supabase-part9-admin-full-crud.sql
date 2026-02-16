-- VendorHub: Admin full CRUD on all tables (run AFTER part1–part8)
-- Gives admins full Create, Read, Update, Delete where applicable.

-- Helper: admin check (reused in USING/WITH CHECK)
-- Policies use: EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')

-- 1) PROFILES – Admin full CRUD (already have SELECT + UPDATE; add DELETE)
DROP POLICY IF EXISTS "Admins can delete any profile" ON public.profiles;
CREATE POLICY "Admins can delete any profile" ON public.profiles FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

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
