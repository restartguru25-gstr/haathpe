-- Allow anonymous users to load vendor (dukaan) entry page: public RPC that returns
-- only public vendor fields. VendorEntry uses this instead of direct profiles SELECT
-- so unauthenticated users can view dukaans from search.

CREATE OR REPLACE FUNCTION public.get_vendor_public_info(p_vendor_id UUID)
RETURNS TABLE (
  name TEXT,
  stall_type TEXT,
  opening_hours JSONB,
  weekly_off TEXT,
  holidays JSONB
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
    p.holidays
  FROM profiles p
  WHERE p.id = p_vendor_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_vendor_public_info(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_vendor_public_info(UUID) TO authenticated;
