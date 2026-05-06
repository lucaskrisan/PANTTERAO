
-- Mark already-implemented tasks as done
UPDATE internal_tasks SET status = 'done', title = '[CONCLUÍDO] Automação WhatsApp: entrega + confirmação pós-compra', updated_at = now() WHERE id = '011b6a7e-7e90-4d3c-afc3-42b605045f20';
UPDATE internal_tasks SET status = 'done', title = '[CONCLUÍDO] Recuperação de carrinho abandonado via WhatsApp', updated_at = now() WHERE id = '90d6f141-e9a1-4d2e-8bd7-488f03e2d88f';
UPDATE internal_tasks SET status = 'done', title = '[CONCLUÍDO] Recarga automática (auto-recharge)', updated_at = now() WHERE id = 'd8f88074-c1a7-4e5a-a3dc-dfd21b1a1689';
UPDATE internal_tasks SET status = 'done', title = '[CONCLUÍDO] Proteger rota /admin/pwa por role', updated_at = now() WHERE id = '9d27f4f2-872b-4d7d-9dde-47b5a2f4fe69';

-- Add new completed tasks that were missing from roadmap
INSERT INTO internal_tasks (title, description, priority, status, category, user_id) VALUES
('[CONCLUÍDO] Analytics Nativo com Mapa do Brasil', 'Dashboard analytics nativo com KPIs, funil, mapa geográfico por DDD e segmentação UTM/pagamento.', 'high', 'done', 'Feature', (SELECT user_id FROM internal_tasks LIMIT 1)),
('[CONCLUÍDO] Deduplicação CAPI + Pixel', 'event_id sincronizado entre browser e servidor para evitar contagem dupla na Meta.', 'high', 'done', 'Integração', (SELECT user_id FROM internal_tasks LIMIT 1)),
('[CONCLUÍDO] CAPI com BRL e hashing SHA-256', 'Conversions API com currency=BRL e user_data hashado em SHA-256.', 'critical', 'done', 'Integração', (SELECT user_id FROM internal_tasks LIMIT 1)),
('[CONCLUÍDO] Rate limiting nas edge functions', 'Tabela rate_limit_hits + check_rate_limit em funções sensíveis.', 'critical', 'done', 'Segurança', (SELECT user_id FROM internal_tasks LIMIT 1)),
('[CONCLUÍDO] Verificação de identidade (KYC)', 'Upload de documentos, selfie, revisão e aprovação pelo super admin.', 'high', 'done', 'Segurança', (SELECT user_id FROM internal_tasks LIMIT 1)),
('[CONCLUÍDO] Billing R$0,99/venda', 'Taxa fixa de R$0,99 por venda após R$500 acumulados.', 'critical', 'done', 'Financeiro', (SELECT user_id FROM internal_tasks LIMIT 1)),
('[CONCLUÍDO] Security Scanner', 'Scanner que audita RLS, tokens expostos e vulnerabilidades.', 'high', 'done', 'Segurança', (SELECT user_id FROM internal_tasks LIMIT 1)),
('[CONCLUÍDO] Lembrete PIX via WhatsApp', 'Cron que envia lembrete para PIX pendentes há mais de 15min.', 'high', 'done', 'Feature', (SELECT user_id FROM internal_tasks LIMIT 1));
