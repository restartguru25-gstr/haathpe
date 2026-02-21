-- Extend get_vendor_public_info to return zone, is_online for PublicMenu/PayDirect.
-- Fixes HTTP 406 when anon users access profiles directly (RLS blocks).

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT true;

CREATE OR REPLACE FUNCTION public.get_vendor_public_info(p_vendor_id UUID)
RETURNS TABLE (
  name TEXT,
  stall_type TEXT,
  opening_hours JSONB,
  weekly_off TEXT,
  holidays JSONB,
  zone TEXT,
  is_online BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    p.name,
    p.stall_type,
    p.opening_hours,
    p.weekly_off,
    p.holidays,
    p.zone,
    COALESCE(p.is_online, true)
  FROM profiles p
  WHERE p.id = p_vendor_id
  LIMIT 1;
$$;
