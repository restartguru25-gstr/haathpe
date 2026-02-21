-- Run in Supabase Dashboard → SQL Editor (required for Set MPIN to work)
ALTER TABLE public.customer_profiles ADD COLUMN IF NOT EXISTS mpin TEXT;
