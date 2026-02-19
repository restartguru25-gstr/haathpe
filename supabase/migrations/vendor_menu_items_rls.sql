-- RLS for vendor_menu_items: Enable RLS, allow vendor to INSERT/UPDATE own rows.
-- Run in Supabase SQL Editor if custom product add fails with RLS or abort errors.
--
-- Test: Add custom item in /sales → save → check vendor_menu_items table updated.

ALTER TABLE public.vendor_menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendor can manage own menu" ON public.vendor_menu_items;
CREATE POLICY "Vendor can manage own menu" ON public.vendor_menu_items
  FOR ALL
  USING (auth.uid() = vendor_id)
  WITH CHECK (auth.uid() = vendor_id);

DROP POLICY IF EXISTS "Anyone can read active vendor menu" ON public.vendor_menu_items;
CREATE POLICY "Anyone can read active vendor menu" ON public.vendor_menu_items
  FOR SELECT
  USING (is_active = true);
