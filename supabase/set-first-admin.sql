-- Super admin: assign admin role to admin@street.com (by email, any UUID).
-- Run in Supabase SQL Editor after part4. Safe to run again if you still don't see Admin.

-- Set role = 'admin' for the user whose email is admin@street.com (lookup from auth.users)
UPDATE public.profiles
SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@street.com');

-- If that user has no profile yet (e.g. never logged in), create one with admin role
INSERT INTO public.profiles (
  id,
  preferred_language,
  credit_limit,
  credit_used,
  streak,
  points,
  tier,
  created_at,
  updated_at,
  role
)
SELECT
  id,
  'en',
  0,
  0,
  0,
  0,
  'Bronze',
  NOW(),
  NOW(),
  'admin'
FROM auth.users
WHERE email = 'admin@street.com'
  AND id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO UPDATE SET role = 'admin';
