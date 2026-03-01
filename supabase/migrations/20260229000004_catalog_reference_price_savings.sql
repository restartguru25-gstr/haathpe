-- B2B catalog: reference_price for "Potential Savings" vs market. Prices in paise.
ALTER TABLE public.catalog_products
  ADD COLUMN IF NOT EXISTS reference_price INTEGER NULL;

COMMENT ON COLUMN public.catalog_products.reference_price IS 'Market/reference price (paise) for savings display. Null = no comparison. Future: admin-editable.';

-- Seed reference prices for testing (slightly above selling_price to show savings)
UPDATE public.catalog_products SET reference_price = 11000 WHERE id = 'c0000002-0002-4000-8000-000000000002' AND (reference_price IS NULL OR reference_price = 0);
UPDATE public.catalog_products SET reference_price = 3300  WHERE id = 'c0000003-0003-4000-8000-000000000003' AND (reference_price IS NULL OR reference_price = 0);
UPDATE public.catalog_products SET reference_price = 35000 WHERE id = 'c0000004-0004-4000-8000-000000000004' AND (reference_price IS NULL OR reference_price = 0);
UPDATE public.catalog_products SET reference_price = 27000 WHERE id = 'c0000005-0005-4000-8000-000000000005' AND (reference_price IS NULL OR reference_price = 0);
UPDATE public.catalog_products SET reference_price = 6000  WHERE id = 'c0000001-0001-4000-8000-000000000001' AND (reference_price IS NULL OR reference_price = 0);
