-- Add bank account and verification status columns (verification provider-agnostic)
-- Run after vendor_cash_wallet migration

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bank_account_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ifsc_code TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bank_verified BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pan_verified BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gstin_verified BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.profiles.bank_account_number IS 'Vendor bank account (masked in UI). Used with ifsc_code for bank verification.';
COMMENT ON COLUMN public.profiles.ifsc_code IS 'Bank IFSC code for bank verification.';
COMMENT ON COLUMN public.profiles.bank_verified IS 'True if bank account verified.';
COMMENT ON COLUMN public.profiles.pan_verified IS 'True if PAN verified.';
COMMENT ON COLUMN public.profiles.gstin_verified IS 'True if GSTIN (gst_number) verified.';
