-- Add mpin column for storing MPIN (used for sign-in via prepare-mpin-signin)
-- Set MPIN uses direct REST update; no Edge Function needed.
ALTER TABLE public.customer_profiles ADD COLUMN IF NOT EXISTS mpin TEXT;
