-- VendorHub: Free local sponsor ads (Hyderabad chai brands) for click-through testing
-- Run after part12. Adds local chai brand ads to measure click-through.
-- Safe to run multiple times – only inserts if brand not already present.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.ads WHERE brand_name = 'Chai Point Hyderabad') THEN
    INSERT INTO public.ads (image_url, brand_name, link_url, zone, is_active, priority)
    VALUES ('https://placehold.co/200x100/7c2d12/white?text=Chai+Point+Hyd', 'Chai Point Hyderabad', 'https://chaipoint.com', 'general', true, 15);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ads WHERE brand_name = 'Irani Chai Co') THEN
    INSERT INTO public.ads (image_url, brand_name, link_url, zone, is_active, priority)
    VALUES ('https://placehold.co/200x100/92400e/white?text=Irani+Chai', 'Irani Chai Co', 'https://example.com/irani-chai', 'Charminar', true, 14);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ads WHERE brand_name = 'Tea Trails Secunderabad') THEN
    INSERT INTO public.ads (image_url, brand_name, link_url, zone, is_active, priority)
    VALUES ('https://placehold.co/200x100/78350f/white?text=Tea+Trails', 'Tea Trails Secunderabad', 'https://example.com/tea-trails', 'Secunderabad', true, 13);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ads WHERE brand_name = 'Darjeeling Express Chai') THEN
    INSERT INTO public.ads (image_url, brand_name, link_url, zone, is_active, priority)
    VALUES ('https://placehold.co/200x100/713f12/white?text=Darjeeling+Express', 'Darjeeling Express Chai', 'https://example.com/darjeeling', 'general', true, 12);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ads WHERE brand_name = 'Street Chai Co') THEN
    INSERT INTO public.ads (image_url, brand_name, link_url, zone, is_active, priority)
    VALUES ('https://placehold.co/200x100/451a03/white?text=Street+Chai+Co', 'Street Chai Co', 'https://example.com/street-chai', 'general', true, 11);
  END IF;
END $$;
