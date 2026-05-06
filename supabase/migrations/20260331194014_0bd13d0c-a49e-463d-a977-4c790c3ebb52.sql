-- 1. Delete 7 duplicate Asaas gateway errors (keep 1)
DELETE FROM public.internal_tasks 
WHERE category = 'gateway_error' 
  AND title = 'Falha no gateway Asaas' 
  AND id != 'e7ef94c4-e281-414e-a0ef-3cc5f65461e6';

-- 2. Update remaining Asaas error with better info
UPDATE public.internal_tasks SET 
  title = 'Falha recorrente gateway Asaas — chave API em ambiente errado',
  description = 'Produto: O Desafio de 14 Dias (35621f66). Erro: chave API não pertence a este ambiente. Produtor cadastrou chave sandbox em produção ou vice-versa. Ação: validar ambiente da chave no cadastro do gateway.',
  priority = 'medium'
WHERE id = 'e7ef94c4-e281-414e-a0ef-3cc5f65461e6';

-- 3. Delete done Pagar.me gateway errors (resolved clutter)
DELETE FROM public.internal_tasks 
WHERE category = 'gateway_error' 
  AND title LIKE '%Pagar.me%' 
  AND status = 'done';

-- 4. Mark implemented features as DONE
UPDATE public.internal_tasks SET status = 'done', title = '[CONCLUÍDO] Débito automático de 3% por venda aprovada'
WHERE id = 'faca3d09-4c67-4e10-a6af-150f3f135f44';

UPDATE public.internal_tasks SET status = 'done', title = '[CONCLUÍDO] Recarga de saldo via PIX'
WHERE id = 'ca284630-a585-4f56-aae4-1147c75fde84';

UPDATE public.internal_tasks SET status = 'done', title = '[CONCLUÍDO] Recarga de saldo via Cartão de Crédito'
WHERE id = '03f1f23d-700f-4a98-8609-6bf9442b16c5';

UPDATE public.internal_tasks SET status = 'done', title = '[CONCLUÍDO] Histórico de recargas'
WHERE id = '075ca332-009d-4c78-8088-650e38533def';

UPDATE public.internal_tasks SET status = 'done', title = '[CONCLUÍDO] Painel de saldo do produtor'
WHERE id = '9fb7bdaf-e551-439e-b5a7-652ef980fb41';

UPDATE public.internal_tasks SET status = 'done', title = '[CONCLUÍDO] Extrato financeiro do produtor'
WHERE id = '5ad2ffb5-49a9-4a92-a44d-2e7d79fc7b52';

-- 5. Delete duplicate WhatsApp task
DELETE FROM public.internal_tasks WHERE id = '2e8046ac-e5e9-451d-adc8-e62dea53c303';

-- 6. Consolidate WhatsApp delivery task
UPDATE public.internal_tasks SET 
  title = 'Automação WhatsApp: entrega + confirmação pós-compra',
  description = 'Integrar webhook payment.approved com Evolution API para enviar confirmação + link de acesso à área de membros ao comprador via WhatsApp.'
WHERE id = '011b6a7e-7e90-4d3c-afc3-42b605045f20';