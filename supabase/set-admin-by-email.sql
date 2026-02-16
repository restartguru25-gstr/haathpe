-- Set admin role for ANY user by email.
-- 1. Replace 'YOUR_EMAIL@example.com' below with your actual sign-up email (in all 3 places).
-- 2. Run in Supabase SQL Editor.
-- 3. Log out and log back in so the app picks up the new role.

-- Set role = 'admin' for that user
UPDATE public.profiles
SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL@example.com');

-- If no profile exists yet, create one with admin role
INSERT INTO public.profiles (
  id, preferred_language, credit_limit, credit_used, streak, points, tier, created_at, updated_at, role
)
SELECT id, 'en', 0, 0, 0, 0, 'Bronze', NOW(), NOW(), 'admin'
FROM auth.users
WHERE email = 'YOUR_EMAIL@example.com'
  AND id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO UPDATE SET role = 'admin';
