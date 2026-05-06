
-- Function to auto-promote user to admin when profile is completed
CREATE OR REPLACE FUNCTION public.promote_to_admin_on_profile_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.profile_completed = true AND (OLD.profile_completed IS NULL OR OLD.profile_completed = false) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger
CREATE TRIGGER on_profile_complete_promote
AFTER UPDATE ON public.profiles
FOR EACH ROW
WHEN (NEW.profile_completed = true AND (OLD.profile_completed IS DISTINCT FROM true))
EXECUTE FUNCTION public.promote_to_admin_on_profile_complete();
