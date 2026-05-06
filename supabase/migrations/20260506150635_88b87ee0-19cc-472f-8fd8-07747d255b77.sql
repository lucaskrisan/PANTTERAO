-- Tabela de permissões granulares por colaborador
CREATE TABLE IF NOT EXISTS public.collaborator_permissions (
  user_id uuid PRIMARY KEY,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.collaborator_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manages collaborators"
ON public.collaborator_permissions FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Collaborator reads own permissions"
ON public.collaborator_permissions FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER update_collab_perm_updated_at
BEFORE UPDATE ON public.collaborator_permissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: verificar se usuário tem permissão específica
CREATE OR REPLACE FUNCTION public.collaborator_has_permission(_user_id uuid, _key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (permissions ->> _key)::boolean
     FROM public.collaborator_permissions
     WHERE user_id = _user_id AND is_active = true),
    false
  );
$$;