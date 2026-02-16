-- VendorHub: Business details for profile (SVANidhi / compliance)
-- Run AFTER part10. Adds columns to profiles and optional storage for shop photos.

-- 1) Profile columns: complete business address, shop photos (2–3), optional GST/PAN/UDYAM/FSSAI, other
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_address TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS shop_photo_urls JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gst_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pan_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS udyam_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fssai_license TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS other_business_details TEXT;

-- Backfill: if business_address is null, copy from stall_address for existing rows
UPDATE public.profiles SET business_address = stall_address WHERE business_address IS NULL AND stall_address IS NOT NULL;

-- 2) Storage bucket for vendor shop photos (2–3 images per vendor)
-- Bucket is public so profile page can show images. Vendors upload to folder: {user_id}/filename
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vendor-shop-photos',
  'vendor-shop-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS: authenticated users can upload/update/delete only in their own folder ({user_id}/...)
DROP POLICY IF EXISTS "Vendors can upload own shop photos" ON storage.objects;
CREATE POLICY "Vendors can upload own shop photos" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'vendor-shop-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Vendors can update own shop photos" ON storage.objects;
CREATE POLICY "Vendors can update own shop photos" ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'vendor-shop-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Vendors can delete own shop photos" ON storage.objects;
CREATE POLICY "Vendors can delete own shop photos" ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'vendor-shop-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public read (bucket is public)
DROP POLICY IF EXISTS "Public read vendor shop photos" ON storage.objects;
CREATE POLICY "Public read vendor shop photos" ON storage.objects FOR SELECT
  USING (bucket_id = 'vendor-shop-photos');
