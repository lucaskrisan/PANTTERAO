
-- Update trigger to auto-assign 'admin' role to all new users (producer access)
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- All new users get 'user' (buyer) + 'admin' (producer) roles automatically.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user'), (NEW.id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$function$;
