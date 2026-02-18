-- haathpe: Vendor Shop Details – Opening/Closing Hours, Weekly Off, Holidays, Online Availability
-- Run after part19. Adds columns to profiles for dukaan timings and online status.

-- 1) Add shop detail columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS opening_hours JSONB DEFAULT '{"Monday":"08:00-22:00","Tuesday":"08:00-22:00","Wednesday":"08:00-22:00","Thursday":"08:00-22:00","Friday":"08:00-22:00","Saturday":"08:00-22:00","Sunday":"closed"}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weekly_off TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS holidays JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT true;
