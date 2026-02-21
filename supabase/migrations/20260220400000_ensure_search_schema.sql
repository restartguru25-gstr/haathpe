-- Ensure columns needed for search and vendor public info exist
-- (zone for search filters; opening_hours, weekly_off, holidays for dukaan entry)

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS zone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS opening_hours JSONB;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weekly_off TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS holidays JSONB;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS premium_tier TEXT;
