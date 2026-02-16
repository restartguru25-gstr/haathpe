-- VendorHub: SVANidhi support requests – vendors request help, admin sees and follows up
-- Run AFTER part9. Creates svanidhi_support_requests.

CREATE TABLE IF NOT EXISTS public.svanidhi_support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'done')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optional: keep updated_at in sync on update (Supabase has no built-in)
CREATE OR REPLACE FUNCTION public.set_svanidhi_support_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS svanidhi_support_updated ON public.svanidhi_support_requests;
CREATE TRIGGER svanidhi_support_updated
  BEFORE UPDATE ON public.svanidhi_support_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_svanidhi_support_updated_at();

CREATE INDEX IF NOT EXISTS idx_svanidhi_support_user ON public.svanidhi_support_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_svanidhi_support_created ON public.svanidhi_support_requests(created_at DESC);
ALTER TABLE public.svanidhi_support_requests ENABLE ROW LEVEL SECURITY;

-- Vendors can insert their own request (one row per click)
DROP POLICY IF EXISTS "Users can insert own SVANidhi support request" ON public.svanidhi_support_requests;
CREATE POLICY "Users can insert own SVANidhi support request" ON public.svanidhi_support_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Vendors can read their own requests (optional, for "see my requests" later)
DROP POLICY IF EXISTS "Users can read own SVANidhi support requests" ON public.svanidhi_support_requests;
CREATE POLICY "Users can read own SVANidhi support requests" ON public.svanidhi_support_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read all and update (status, notes)
DROP POLICY IF EXISTS "Admins can view all SVANidhi support requests" ON public.svanidhi_support_requests;
CREATE POLICY "Admins can view all SVANidhi support requests" ON public.svanidhi_support_requests FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Admins can update SVANidhi support requests" ON public.svanidhi_support_requests;
CREATE POLICY "Admins can update SVANidhi support requests" ON public.svanidhi_support_requests FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
