-- Add alert_volume to profiles for payment notification sound level (low / medium / high).
-- Run in Supabase SQL Editor after part20 (shop details).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS alert_volume TEXT DEFAULT 'medium'
  CHECK (alert_volume IS NULL OR alert_volume IN ('low', 'medium', 'high'));

COMMENT ON COLUMN public.profiles.alert_volume IS 'Vendor preference for payment alert sound: low (0.3), medium (0.7), high (1.0).';
