-- Fix: ensure anon/authenticated can execute get_vendor_public_info().
-- A later migration recreated the function but omitted GRANTs, causing "Dukaan not found"
-- for public (non-logged-in) users when opening `/menu/:vendorId`.

GRANT EXECUTE ON FUNCTION public.get_vendor_public_info(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_vendor_public_info(UUID) TO authenticated;

