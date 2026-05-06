
-- Mark existing admin/super_admin profiles as completed
UPDATE public.profiles
SET profile_completed = true
WHERE id IN (
  SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'super_admin')
);
