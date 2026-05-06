-- 1. Remove the dangerous trigger that gives admin to everyone
DROP TRIGGER IF EXISTS on_auth_user_created_assign_role ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user_role();

-- 2. Create a safe function that assigns 'user' role by default
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 3. Recreate trigger with safe role
CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- 4. Revoke Juliana's admin access (she should be 'user')
DELETE FROM public.user_roles WHERE user_id = '708727eb-beca-4246-9cde-bb521b65d9fe' AND role = 'admin';

-- 5. Give her 'user' role instead
INSERT INTO public.user_roles (user_id, role) VALUES ('708727eb-beca-4246-9cde-bb521b65d9fe', 'user') ON CONFLICT (user_id, role) DO NOTHING;

-- 6. Also fix lucaskrisann (your other account) - keep admin only if intended
-- No action needed, keeping existing roles