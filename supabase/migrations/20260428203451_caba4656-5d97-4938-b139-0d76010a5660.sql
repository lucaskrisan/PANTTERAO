-- Tabela para gerenciar e-mails que não desejam receber mais comunicações
CREATE TABLE IF NOT EXISTS public.email_unsubscribes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.email_unsubscribes ENABLE ROW LEVEL SECURITY;

-- Política de leitura (público pode ler o próprio se souber o e-mail? Não, melhor apenas service role)
CREATE POLICY "Service role can manage unsubscribes" ON public.email_unsubscribes
    FOR ALL USING (auth.role() = 'service_role');

-- Função para verificar se um e-mail está na lista de supressão antes de enviar
CREATE OR REPLACE FUNCTION public.is_email_unsubscribed(p_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM public.email_unsubscribes WHERE email = p_email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
