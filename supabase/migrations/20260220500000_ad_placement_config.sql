-- Admin-configurable ad placements: enable/disable ads on specific pages

CREATE TABLE IF NOT EXISTS public.ad_placement_config (
  page_slug TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  label TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ad_placement_config ENABLE ROW LEVEL SECURITY;

-- Anyone can read (public pages need to know if placement is enabled)
DROP POLICY IF EXISTS "Anyone can read ad_placement_config" ON public.ad_placement_config;
CREATE POLICY "Anyone can read ad_placement_config" ON public.ad_placement_config
  FOR SELECT USING (true);

-- Only admins can update
DROP POLICY IF EXISTS "Admins manage ad_placement_config" ON public.ad_placement_config;
CREATE POLICY "Admins manage ad_placement_config" ON public.ad_placement_config
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Seed default placements (all enabled)
INSERT INTO public.ad_placement_config (page_slug, enabled, label) VALUES
  ('dukaan', true, 'Dukaanwaale page'),
  ('menu', true, 'Menu sidebar (desktop)'),
  ('menu_mobile', true, 'Menu top (mobile)'),
  ('cart', true, 'Cart section'),
  ('pay', true, 'Pay direct page'),
  ('search', true, 'Search results'),
  ('confirmation', true, 'Order confirmation')
ON CONFLICT (page_slug) DO NOTHING;
