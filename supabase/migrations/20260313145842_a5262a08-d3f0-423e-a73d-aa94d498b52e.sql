-- Only super_admin can manage roles (not regular admins)
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view roles" ON public.user_roles;

-- Super admins can view all roles
CREATE POLICY "Super admins can view all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR user_id = auth.uid());

-- Super admins can insert roles (but never super_admin role)
CREATE POLICY "Super admins can insert roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (is_super_admin(auth.uid()) AND role != 'super_admin');

-- Super admins can delete roles (but never super_admin role)
CREATE POLICY "Super admins can delete roles"
ON public.user_roles FOR DELETE TO authenticated
USING (is_super_admin(auth.uid()) AND role != 'super_admin');

-- Also allow super_admin to view all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins and super admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id OR has_role(auth.uid(), 'admin') OR is_super_admin(auth.uid()));