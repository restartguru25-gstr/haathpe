-- Fix: "infinite recursion detected in policy for relation profiles"
-- Run this in Supabase SQL Editor. Policies on profiles that use SELECT from profiles
-- cause recursion. Use SECURITY DEFINER function to bypass RLS for admin check.

-- 1) Create helper function (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;

-- 2) Replace profiles policies that caused recursion
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update any profile credit and role" ON public.profiles;
CREATE POLICY "Admins can update any profile credit and role"
  ON public.profiles FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete any profile" ON public.profiles;
CREATE POLICY "Admins can delete any profile"
  ON public.profiles FOR DELETE
  USING (public.is_admin());
