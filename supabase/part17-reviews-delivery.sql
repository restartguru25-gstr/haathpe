-- VendorHub: Customer reviews, order tracking, delivery stub
-- Run AFTER part15 (customer_profiles). Adds rating/review, delivery option, status 'ready'.

-- 1) Add rating/review columns to customer_orders (post-delivery)
ALTER TABLE public.customer_orders ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5));
ALTER TABLE public.customer_orders ADD COLUMN IF NOT EXISTS review_text TEXT;
ALTER TABLE public.customer_orders ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- 2) Add delivery option columns
ALTER TABLE public.customer_orders ADD COLUMN IF NOT EXISTS delivery_option TEXT NOT NULL DEFAULT 'pickup' CHECK (delivery_option IN ('pickup', 'self_delivery'));
ALTER TABLE public.customer_orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;

-- 3) Add 'ready' status (pending → prepared → ready → delivered/paid)
-- Drop existing check and recreate with 'ready'
ALTER TABLE public.customer_orders DROP CONSTRAINT IF EXISTS customer_orders_status_check;
ALTER TABLE public.customer_orders ADD CONSTRAINT customer_orders_status_check
  CHECK (status IN ('pending', 'prepared', 'ready', 'delivered', 'paid'));

-- 4) RPC: submit_order_review (customer can submit review if phone matches, order delivered/paid, not yet reviewed)
CREATE OR REPLACE FUNCTION public.submit_order_review(
  p_order_id UUID,
  p_rating INTEGER,
  p_review_text TEXT DEFAULT NULL
)
RETURNS TABLE (ok BOOLEAN, error_msg TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT;
  v_status TEXT;
  v_reviewed_at TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN QUERY SELECT false, 'Not logged in'::TEXT;
    RETURN;
  END IF;
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RETURN QUERY SELECT false, 'Rating must be 1-5'::TEXT;
    RETURN;
  END IF;

  SELECT o.customer_phone, o.status, o.reviewed_at
  INTO v_phone, v_status, v_reviewed_at
  FROM customer_orders o
  WHERE o.id = p_order_id;

  IF v_phone IS NULL THEN
    RETURN QUERY SELECT false, 'Order not linked to customer'::TEXT;
    RETURN;
  END IF;
  IF v_phone != (SELECT phone FROM customer_profiles WHERE id = auth.uid()) THEN
    RETURN QUERY SELECT false, 'Not your order'::TEXT;
    RETURN;
  END IF;
  IF v_status NOT IN ('delivered', 'paid') THEN
    RETURN QUERY SELECT false, 'Order must be delivered to review'::TEXT;
    RETURN;
  END IF;
  IF v_reviewed_at IS NOT NULL THEN
    RETURN QUERY SELECT false, 'Already reviewed'::TEXT;
    RETURN;
  END IF;

  UPDATE customer_orders
  SET rating = p_rating,
      review_text = NULLIF(TRIM(p_review_text), ''),
      reviewed_at = NOW()
  WHERE id = p_order_id;

  RETURN QUERY SELECT true, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_order_review(UUID, INTEGER, TEXT) TO authenticated;

-- 5) RPC: get_order_by_id (for public tracking - minimal info, no auth required for shareable link)
CREATE OR REPLACE FUNCTION public.get_order_for_tracking(p_order_id UUID)
RETURNS TABLE (
  id UUID,
  vendor_id UUID,
  status TEXT,
  created_at TIMESTAMPTZ,
  vendor_name TEXT,
  delivery_option TEXT,
  delivery_address TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT o.id, o.vendor_id, o.status, o.created_at,
         p.name AS vendor_name,
         o.delivery_option,
         o.delivery_address
  FROM customer_orders o
  LEFT JOIN profiles p ON p.id = o.vendor_id
  WHERE o.id = p_order_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_for_tracking(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_order_for_tracking(UUID) TO authenticated;

-- 6) RPC: get_vendor_reviews (vendor reads their own reviews)
CREATE OR REPLACE FUNCTION public.get_vendor_reviews(p_vendor_id UUID)
RETURNS TABLE (
  order_id UUID,
  rating INTEGER,
  review_text TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT o.id AS order_id, o.rating, o.review_text, o.reviewed_at, o.created_at
  FROM customer_orders o
  WHERE o.vendor_id = p_vendor_id
    AND o.rating IS NOT NULL
  ORDER BY o.reviewed_at DESC NULLS LAST
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION public.get_vendor_reviews(UUID) TO authenticated;

COMMENT ON FUNCTION public.submit_order_review IS 'Customer submits rating (1-5) and optional review text. One review per order, phone must match.';
COMMENT ON FUNCTION public.get_order_for_tracking IS 'Public order tracking by order ID (shareable link).';
COMMENT ON FUNCTION public.get_vendor_reviews IS 'Vendor fetches their reviews for dashboard.';
