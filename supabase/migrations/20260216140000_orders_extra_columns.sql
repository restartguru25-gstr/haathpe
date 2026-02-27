-- Orders + order_items: add columns used by Cart and allow status 'paid'.
-- Run after initial_schema + order_items migration. Safe to run multiple times.

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS gst_total INTEGER;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS subtotal_before_tax INTEGER;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS eco_flag BOOLEAN NOT NULL DEFAULT false;

-- Allow status 'paid' (for payment success). Include common statuses so we don't break existing DBs.
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'in-transit', 'delivered', 'paid', 'prepared', 'ready'));

-- order_items: columns used by Cart (variant, mrp, gst_rate, discount)
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS variant_id UUID;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS variant_label TEXT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS mrp INTEGER;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS gst_rate INTEGER;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS discount_amount INTEGER;
