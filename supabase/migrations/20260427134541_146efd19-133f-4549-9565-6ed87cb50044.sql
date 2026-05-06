-- Remove credential_source=global_secret dos gateways do super-admin (lucas krisan)
-- O secret global ASAAS_API_KEY estava com chave de ambiente errado, recusando vendas.
-- Agora o super-admin precisa colar a chave própria no painel.
UPDATE public.payment_gateways
SET config = config - 'credential_source',
    active = false,  -- desativa até que a chave própria seja colada
    updated_at = now()
WHERE user_id = '9663fed8-8f87-44bf-aa1e-3462cb867a62'
  AND provider IN ('asaas', 'pagarme')
  AND config->>'credential_source' = 'global_secret';