-- Verificar se o tipo de enum existe e adicionar o novo papel se necessário
-- Como o Supabase não permite ALTER TYPE ADD VALUE dentro de transações de forma simples em algumas versões,
-- e como o sistema usa check constraints ou apenas strings em user_roles, vamos garantir a flexibilidade.

-- Adicionar política para permitir que super_admins gerenciem colaboradores
CREATE POLICY "Super admins can manage all roles"
ON public.user_roles
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
  )
);
