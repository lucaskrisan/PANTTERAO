UPDATE public.internal_tasks 
SET status = 'done', 
    title = '[RESOLVIDO] Falha gateway Asaas — erro transitório, pagamentos funcionando',
    description = 'Alerta antigo de disparidade de ambiente. Auditoria confirmou: todos os gateways Asaas estão configurados como production e ativos. Vendas por cartão funcionando normalmente. Tarefa encerrada.',
    updated_at = now()
WHERE id = 'e7ef94c4-e281-414e-a0ef-3cc5f65461e6';