-- Ensure profile update policy allows users to update their own row (WITH CHECK).
-- Fixes "profile is not able to save" when RLS blocks the updated row.

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
