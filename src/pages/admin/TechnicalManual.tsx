const downloadManualAsHTML = () => {
  const el = document.getElementById("manual-content");
  if (!el) return;
  const textContent = el.innerText;
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Manual Técnico Completo — PanteraPay</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; background: #0f172a; color: #e2e8f0; line-height: 1.7; padding: 40px 20px; }
  .container { max-width: 900px; margin: 0 auto; background: #1e293b; border-radius: 16px; padding: 48px; border: 1px solid #334155; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
  h1 { font-size: 28px; font-weight: 800; margin-bottom: 8px; color: #f8fafc; }
  .meta { font-size: 13px; color: #94a3b8; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #334155; }
  pre { white-space: pre-wrap; word-wrap: break-word; font-family: 'Segoe UI', system-ui, sans-serif; font-size: 14px; line-height: 1.8; color: #cbd5e1; }
  @media print { body { background: #fff; color: #1e293b; } .container { border: none; box-shadow: none; background: #fff; } pre { color: #334155; } }
</style>
</head>
<body>
<div class="container">
  <h1>Manual Técnico Completo — PanteraPay</h1>
  <p class="meta">Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")} | Documento de uso interno</p>
  <pre>${textContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</div>
</body>
</html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Manual_Tecnico_PanteraPay_${new Date().toISOString().slice(0,10)}.html`;
  a.click();
  URL.revokeObjectURL(url);
};

const TechnicalManual = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8 text-foreground">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-bold">Manual Técnico Completo — PanteraPay</h1>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const el = document.getElementById("manual-content");
              if (el) {
                navigator.clipboard.writeText(el.innerText);
                alert("Copiado para a área de transferência!");
              }
            }}
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:opacity-90"
          >
            Copiar tudo
          </button>
          <button
            onClick={downloadManualAsHTML}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
          >
            ⬇ Baixar HTML
          </button>
        </div>
      </div>

      <div id="manual-content" className="prose prose-sm max-w-none dark:prose-invert space-y-6 bg-card p-8 rounded-2xl border border-border">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">{`
═══════════════════════════════════════════════════════════════
  MANUAL TÉCNICO COMPLETO — PANTERAPAY
  Versão: 3.0 | Data: ${new Date().toLocaleDateString("pt-BR")}
  Documento de uso interno — Documentação oficial do sistema
═══════════════════════════════════════════════════════════════

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. VISÃO GERAL DO SISTEMA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1.1 Propósito Estratégico
  PanteraPay é uma plataforma SaaS de "Checkout as a Service" para
  produtores digitais brasileiros. Permite criar checkouts de alta
  conversão, processar pagamentos (PIX, cartão, boleto), entregar
  conteúdo via área de membros e rastrear conversões com Pixel/CAPI.

  Nome da marca: PanteraPay (com dois "t" em panttera.com.br)
  Motivo do domínio com "tt": evitar categorização automática de
  "Serviços Financeiros" pelo Meta (Facebook), que bloqueia parâmetros
  de dados do usuário via CAPI quando detecta palavras-chave como "pay".

1.2 Público-alvo
  • Produtores digitais (infoprodutores): criam produtos, configuram
    checkouts e gerenciam vendas.
  • Compradores (alunos): acessam conteúdo adquirido via portal do aluno.
  • Super Admin: administra a plataforma, gerencia produtores e billing.

1.3 Modelo de Negócio
  Monetização via take-rate: taxa percentual (padrão 4.99%) + taxa fixa
  (R$ 0,99) sobre cada venda aprovada. Créditos pré-pagos com tiers:
  • Iron: R$ 5 (padrão)
  • Bronze: R$ 50
  • Silver: R$ 500
  • Gold: R$ 5.000
  Atingir o limite sem quitação bloqueia geração de novos checkouts.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. ARQUITETURA TÉCNICA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2.1 Stack
  Frontend: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
  Backend: Supabase (Lovable Cloud)
    • PostgreSQL (banco de dados)
    • Auth (autenticação)
    • Edge Functions (Deno runtime)
    • Storage (arquivos)
    • Realtime (WebSocket)
  Integrações: Asaas, Pagar.me, Mercado Pago, Stripe, OneSignal,
    Resend, Facebook CAPI, Lovable AI, Cloudflare (domínios custom),
    Crisp (chat ao vivo)

2.2 Fluxo Geral
  Cadastro → Completar Perfil (CPF/Telefone) → Auto-promoção Admin
  → Painel Produtor → Criar Produto → Gerar Checkout → Vender
  → Webhook → Entrega automática → Área de Membros

2.3 Organização do Código
  src/
  ├── pages/              → Páginas (rotas)
  │   ├── admin/          → Painel do produtor (20+ páginas)
  │   ├── Checkout.tsx     → Checkout público
  │   ├── MemberArea.tsx   → Área de membros
  │   ├── CustomerPortal.tsx → Portal do comprador
  │   ├── Login.tsx        → Autenticação
  │   └── CompleteProfile.tsx → Onboarding
  ├── components/         → Componentes reutilizáveis
  │   ├── admin/          → Componentes do painel admin
  │   ├── checkout/       → Componentes do checkout
  │   ├── checkout-builder/ → Builder visual de checkout
  │   ├── landing/        → Componentes da landing page
  │   ├── member/         → Componentes da área de membros
  │   └── ui/             → shadcn/ui components
  ├── hooks/              → Custom hooks
  ├── integrations/       → Supabase client + types + Lovable auth
  └── lib/                → Utilitários

  supabase/
  └── functions/          → 35+ Edge Functions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. ARQUITETURA DE DOMÍNIOS E INFRAESTRUTURA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3.1 Domínios
  ┌────────────────────────┬─────────────────────┬────────────────────────────┐
  │ Domínio                │ Uso                 │ Hospedagem                 │
  ├────────────────────────┼─────────────────────┼────────────────────────────┤
  │ panttera.com.br        │ Landing page        │ Cloudflare Pages (futuro)  │
  │ www.panttera.com.br    │ Redirect → raiz     │ Cloudflare Pages (futuro)  │
  │ app.panttera.com.br    │ App (checkout/admin) │ Lovable (IP 185.158.133.1)│
  │ paycheckout.lovable.app│ Staging (legacy)    │ Lovable (automático)       │
  └────────────────────────┴─────────────────────┴────────────────────────────┘

  Domínio anterior: checkout.panterapay.com.br (desativado)
  Motivo da migração: ver seção 16 (CAPI/Pixel)

3.2 DNS (Cloudflare)
  Registrador: Registro.br → Nameservers apontados para Cloudflare
  ┌──────┬──────┬──────────────────────────┬─────────────┐
  │ Tipo │ Nome │ Valor                    │ Proxy       │
  ├──────┼──────┼──────────────────────────┼─────────────┤
  │ A    │ app  │ 185.158.133.1            │ DNS Only ⚠️ │
  │ CNAME│ @    │ panttera.pages.dev       │ Proxied ☁️  │
  │ CNAME│ www  │ panttera.pages.dev       │ Proxied ☁️  │
  │ TXT  │ _lovable.app │ (gerado pela Lovable) │ —       │
  └──────┴──────┴──────────────────────────┴─────────────┘

  ⚠️ REGRA CRÍTICA: O registro "app" DEVE estar como "DNS Only"
  (nuvem cinza). Se estiver com Proxy (nuvem laranja), o Cloudflare
  intercepta rotas de autenticação e causa erros 404, falhas de
  redirecionamento e problemas no fluxo de login.

3.3 Estratégia de Separação
  FASE 5 (planejada): Remixar o projeto Lovable:
  • Projeto A (remix): Landing page → conectar panttera.com.br
  • Projeto B (este): App → conectar app.panttera.com.br
  • Neste projeto: remover landing, redirecionar / → /login

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. ESTRUTURA DE NAVEGAÇÃO E ROTAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ROTAS PÚBLICAS
┌─────────────────────────────┬──────────────────────┬──────────────────────────────┐
│ URL                         │ Módulo               │ Acesso                       │
├─────────────────────────────┼──────────────────────┼──────────────────────────────┤
│ /                           │ Landing Page         │ Público                      │
│ /login                      │ Autenticação         │ Público                      │
│ /login?signup=true          │ Cadastro             │ Público                      │
│ /checkout/:productId        │ Checkout             │ Público (anon)               │
│ /checkout/sucesso           │ Sucesso pós-compra   │ Público                      │
│ /membros?token=xxx          │ Área de Membros      │ Token de acesso              │
│ /minha-conta?token=xxx      │ Portal do Comprador  │ Token de acesso              │
│ /completar-perfil           │ Onboarding           │ Autenticado (perfil incompleto)│
│ /aguardando-aprovacao       │ Aprovação pendente   │ Autenticado                  │
│ /termos                     │ Termos de Serviço    │ Público                      │
│ /privacidade                │ Política Privacidade │ Público                      │
│ /cookies                    │ Política Cookies     │ Público                      │
│ /isencao-financeira         │ Isenção Financeira   │ Público                      │
│ /produtos-proibidos         │ Produtos Proibidos   │ Público                      │
└─────────────────────────────┴──────────────────────┴──────────────────────────────┘

ROTAS ADMIN (requer role admin ou super_admin)
┌─────────────────────────────┬──────────────────────┬──────────────────────────────┐
│ /admin                      │ Dashboard            │ admin, super_admin           │
│ /admin/orders               │ Vendas               │ admin, super_admin           │
│ /admin/products             │ Produtos             │ admin, super_admin           │
│ /admin/products/:id/edit    │ Editar Produto       │ admin (dono), super_admin    │
│ /admin/customers            │ Clientes             │ admin, super_admin           │
│ /admin/settings             │ Config. Checkout     │ admin, super_admin           │
│ /admin/upsell               │ Upsell               │ admin, super_admin           │
│ /admin/coupons              │ Cupons               │ admin, super_admin           │
│ /admin/courses              │ Área de Membros      │ admin, super_admin           │
│ /admin/reviews              │ Avaliações           │ admin, super_admin           │
│ /admin/abandoned            │ Carrinhos Abandonados│ admin, super_admin           │
│ /admin/metrics              │ Métricas             │ admin, super_admin           │
│ /admin/financeiro           │ Financeiro Produtor  │ admin, super_admin           │
│ /admin/integrations         │ Gateways/Integrações │ admin, super_admin           │
│ /admin/crisp                │ Crisp Chat           │ admin, super_admin           │
│ /admin/domains              │ Domínios             │ admin, super_admin           │
│ /admin/communications       │ Comunicações/E-mails │ admin, super_admin           │
│ /admin/webhooks             │ Webhooks             │ admin, super_admin           │
│ /admin/whatsapp             │ WhatsApp             │ admin, super_admin           │
│ /admin/notifications        │ Notificações Push    │ admin, super_admin           │
│ /admin/pwa                  │ App Mobile (PWA)     │ admin, super_admin           │
│ /admin/my-account           │ Minha Conta          │ admin, super_admin           │
│ /admin/tracking             │ Rastreamento/Pixel   │ admin, super_admin           │
│ /admin/emails               │ Logs de E-mail       │ admin, super_admin           │
│ /admin/manual               │ Manual Técnico       │ super_admin                  │
│ /admin/billing              │ Billing              │ super_admin                  │
│ /admin/platform             │ Painel Plataforma    │ super_admin                  │
│ /admin/meta-ads             │ Meta Ads             │ super_admin                  │
│ /admin/health               │ Fiscalizar           │ super_admin                  │
│ /admin/roadmap              │ Roadmap              │ super_admin                  │
│ /admin/blacklist            │ Blacklist Fraude     │ super_admin                  │
│ /admin/api-keys             │ API Keys             │ super_admin                  │
│ /admin/product-review       │ Revisão de Produtos  │ super_admin                  │
└─────────────────────────────┴──────────────────────┴──────────────────────────────┘

ROTAS ESPECIAIS
┌──────────────────────────────────────────────────────┬──────────────────────────┐
│ /admin/products/:id/checkout-builder                 │ Checkout Builder         │
│ /admin/products/:id/checkout-builder/:configId       │ Builder com config       │
└──────────────────────────────────────────────────────┴──────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. MÓDULOS FUNCIONAIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5.1 CHECKOUT (/checkout/:productId)
────────────────────────────────────
  Objetivo: Página pública de pagamento para compradores.
  Uso: Gerada automaticamente para cada produto ativo.

  Campos de Entrada (comprador):
  ┌────────────────┬──────────────┬────────────┬─────────────┬───────────────┐
  │ Campo técnico  │ Label        │ Tipo       │ Obrigatório │ Validação     │
  ├────────────────┼──────────────┼────────────┼─────────────┼───────────────┤
  │ name           │ Nome completo│ text       │ Sim         │ min 3 chars   │
  │ email          │ E-mail       │ email      │ Sim         │ formato email │
  │ cpf            │ CPF          │ text       │ Sim         │ CPF válido    │
  │ phone          │ Telefone     │ text       │ Sim         │ 10-11 dígitos │
  │ payment_method │ Método pgto  │ enum       │ Sim         │ pix|credit    │
  └────────────────┴──────────────┴────────────┴─────────────┴───────────────┘

  Campos Cartão (se payment_method = credit):
  ┌────────────────┬──────────────┬────────────┬─────────────┐
  │ card_number    │ Nº do cartão │ text       │ Sim         │
  │ card_name      │ Nome cartão  │ text       │ Sim         │
  │ card_expiry    │ Validade     │ text       │ Sim (MM/AA) │
  │ card_cvv       │ CVV          │ text       │ Sim (3-4 d) │
  │ installments   │ Parcelas     │ select     │ Sim         │
  └────────────────┴──────────────┴────────────┴─────────────┘

  Regras de Negócio:
  • Desconto PIX: percentual configurável (padrão 5%)
  • Fórmula: valor_pix = price * (1 - pix_discount_percent / 100)
  • Order Bumps: produtos adicionais exibidos antes do pagamento
  • Fórmula total: total = product_price + Σ(bump_prices) - desconto_cupom
  • Validação server-side: Edge Function valida valor contra DB
  • Cupons: desconto % ou fixo, com uso máximo e expiração
  • Countdown Timer: minutos configuráveis (padrão 15)

  Edge Functions envolvidas:
  • create-asaas-payment — Pagamento via Asaas (PIX/cartão/boleto)
  • create-pix-payment — Pagamento PIX via Pagar.me
  • create-mercadopago-payment — Pagamento via Mercado Pago
  • create-stripe-payment — Pagamento via Stripe
  • check-order-status — Polling de status (sem autenticação)

  Saída:
  • PIX: QR Code + código copia-e-cola em modal
  • Cartão: processamento direto, redirect para /checkout/sucesso
  • Notificação push via OneSignal ao produtor

5.2 PRODUTOS (/admin/products)
────────────────────────────────
  Objetivo: Gerenciamento de produtos digitais.

  Campos:
  ┌────────────────┬──────────────┬────────────┬─────────────┬───────────────┐
  │ name           │ Nome         │ text       │ Sim         │ min 1 char    │
  │ description    │ Descrição    │ text       │ Não         │ —             │
  │ price          │ Preço        │ numeric    │ Sim         │ > 0           │
  │ original_price │ Preço orig.  │ numeric    │ Não         │ > price       │
  │ image_url      │ Imagem       │ text(URL)  │ Não         │ URL válida    │
  │ active         │ Ativo        │ boolean    │ —           │ default: true │
  │ is_subscription│ Assinatura   │ boolean    │ —           │ default: false│
  │ billing_cycle  │ Ciclo cobr.  │ text       │ Se assinat. │ weekly..yearly│
  │ show_coupon    │ Mostrar cupom│ boolean    │ —           │ default: true │
  └────────────────┴──────────────┴────────────┴─────────────┴───────────────┘

  RLS: user_id = auth.uid() OR is_super_admin()

5.3 DASHBOARD (/admin)
────────────────────────
  Objetivo: Visão consolidada de vendas e métricas.

  Métricas exibidas:
  • Receita total (soma de orders com status paid/approved)
  • Pedidos totais
  • Taxa de aprovação: (paid+approved) / total * 100
  • Ticket médio: receita / pedidos_aprovados
  • Visitantes ao vivo (via Supabase Realtime)

  Períodos: Hoje, Ontem, 7 dias, Mês atual, Mês passado, Total
  Gráfico: AreaChart (Recharts) com série temporal de vendas
  Gamificação: SalesGamification + HeaderGamification (confetti, sons)

5.4 ÁREA DE MEMBROS (/membros?token=xxx)
──────────────────────────────────────────
  Objetivo: Entrega de conteúdo digital (cursos/aulas).
  Acesso: via access_token (UUID) no header x-access-token.

  Estrutura: Curso → Módulos → Aulas → Materiais
  Funcionalidades:
  • Progresso de aulas (lesson_progress)
  • Avaliações/Reviews por aula (lesson_reviews)
  • Materiais complementares (lesson_materials)
  • Conteúdo: text, vídeo (embed), arquivo
  • Banner de instalação PWA (MemberInstallBanner)

  RLS: Validação via member_access.access_token + expires_at

5.5 CHECKOUT BUILDER (/admin/products/:id/checkout-builder)
────────────────────────────────────────────────────────────
  Objetivo: Editor visual drag-and-drop de checkout.
  Componentes: Paleta, Canvas, Editor de Propriedades
  Persistência: checkout_builder_configs (JSON layout + settings)
  Suporte a múltiplas configurações por produto (A/B testing)
  Lib: @dnd-kit/core + @dnd-kit/sortable

5.6 UPSELL (/admin/upsell)
────────────────────────────
  Objetivo: Ofertas pós-compra (one-click upsell).
  Edge Function: process-upsell
  Fluxo: Após pagamento aprovado → exibir oferta → aceitar →
    criar novo pedido reaproveitando dados do cliente.
  Campos: product_id, upsell_product_id, discount_percent, title, description

5.7 CUPONS (/admin/coupons)
────────────────────────────
  Campos: code, discount_type (percent|fixed), discount_value,
    max_uses, min_amount, expires_at, product_id, active
  Validação: checkout verifica ativo + não expirado + não excedeu max_uses

5.8 GATEWAYS (/admin/integrations)
────────────────────────────────────
  Provedores suportados:
  • Asaas (PIX, cartão, boleto, assinatura)
  • Pagar.me (PIX, cartão com 3D Secure)
  • Mercado Pago (PIX, cartão)
  • Stripe (cartão, com webhook)

  Modalidades:
  • Split: taxa descontada na hora da venda
  • Sob Demanda (Billing): R$ 0,99 fixo por venda aprovada

  Cada produtor configura suas próprias credenciais.
  Campos: provider, name, environment (sandbox|production), config (JSON), payment_methods (JSON)
  RLS: isolamento total por user_id

5.9 CRISP CHAT (/admin/crisp)
────────────────────────────────
  Objetivo: Integração com Crisp para chat ao vivo no checkout.
  Configuração: Website ID do Crisp armazenado em checkout_settings.

5.10 API KEYS (/admin/api-keys) — super_admin
────────────────────────────────────────────────
  Objetivo: Gerenciamento de chaves de API da plataforma.
  Acesso restrito a super_admin.

5.11 REVISÃO DE PRODUTOS (/admin/product-review) — super_admin
────────────────────────────────────────────────────────────────
  Objetivo: Moderação de produtos cadastrados pelos produtores.
  Campo: moderation_status (pending, approved, rejected)
  Edge Function: product-moderation-email (notifica produtor)

5.9 RASTREAMENTO (/admin/tracking)
────────────────────────────────────
  Objetivo: Configuração de Pixel Facebook e CAPI por produto.
  Tabela: product_pixels (pixel_id, capi_token, domain, fire_on_pix, fire_on_boleto)
  Edge Function: facebook-capi (envio server-side)
  Eventos: PageView, InitiateCheckout, AddPaymentInfo, Purchase
  EMQ: Monitoramento de saúde via emq_snapshots

  Componentes de tracking:
  • TrackingScriptGenerator — Gera snippets de integração
  • TrackingFullAudit — Varredura completa de saúde
  • TrackingOnboardingGuide — Guia passo-a-passo
  • PixelEventsDashboard — Dashboard de eventos
  • UtmAttributionTable — Tabela de atribuição UTM

5.13 COMUNICAÇÕES (/admin/communications)
──────────────────────────────────────────
  • E-mails transacionais via Resend
  • Logs completos: email_logs (status, aberturas, cliques, bounces)
  • Geração de copy via IA: Edge Function generate-email-copy (Lovable AI)
  • Webhooks customizados: fire-webhooks (HMAC-SHA256)
  • Push notifications: OneSignal

5.14 DOMÍNIOS CUSTOMIZADOS (/admin/domains)
─────────────────────────────────────────────
  Objetivo: Permitir que produtores conectem domínios próprios.
  Tabela: custom_domains (hostname, status, ssl_status, cloudflare_hostname_id)
  Edge Functions: cloudflare-add-hostname, cloudflare-check-status,
    cloudflare-remove-hostname
  Fluxo: Adicionar domínio → Cloudflare SaaS → Verificar DNS → SSL auto

5.15 SIDEBAR DO ADMIN — ORGANIZAÇÃO
──────────────────────────────────────
  Seções (em ordem):
  1. PRINCIPAL: Dashboard, Vendas, Produtos, Clientes
  2. VENDAS: Checkouts, Upsell, Cupons
  3. CONTEÚDO: Área de Membros, Avaliações
  4. ANÁLISE: Relatórios (carrinhos abandonados), Métricas, Financeiro
  5. GERAL (collapsible): Gateways, Crisp Chat, Domínios, Comunicações,
     Webhook, WhatsApp, Notificações, App Mobile, Minha Conta
  6. PLATAFORMA (super_admin): Revisão Produtos, Meta Ads, Painel
     Plataforma, Billing, API Keys, Blacklist, Roadmap, Fiscalizar,
     Manual Técnico

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. SISTEMA DE AUTENTICAÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

6.1 Métodos de Login
  • E-mail + Senha (Supabase Auth)
  • Google OAuth (Lovable Cloud managed)
  • Token de acesso (compradores, sem autenticação auth.users)

6.2 Fluxo Completo
  1. Cadastro: email+senha+nome → signUp → profile criado via trigger
  2. Cadastro completo: +telefone+CPF → profile.profile_completed = true
  3. Auto-promoção: Edge Function resolve-user-destination detecta
     profile completo sem role admin e sem acesso de comprador →
     insere role 'admin' automaticamente
  4. Google OAuth: redirect para /completar-perfil → preencher CPF+telefone

6.3 Roles (tabela user_roles)
  • user — padrão (atribuído via trigger handle_new_user_role)
  • admin — produtor (auto-promoção ou manual pelo super_admin)
  • super_admin — administrador global (promoção manual apenas)

6.4 Sessão
  • Supabase Auth JWT
  • onAuthStateChange listener
  • Persistência automática (localStorage)

6.5 Fluxo de Roteamento (Edge Function: resolve-user-destination)
  1. Verifica profile_completed
  2. Verifica roles (admin/super_admin)
  3. Verifica se é comprador (customers + member_access)
  4. Auto-promove para admin se: profile completo + não comprador + não admin
  5. Retorna destino:
     • !profileCompleted → /completar-perfil
     • isAdmin → /admin (PRIORIDADE sobre comprador)
     • buyerToken → /minha-conta?token=xxx
     • fallback → /admin

6.6 Verificação Turnstile (Cloudflare)
   • Cloudflare Turnstile integrado no checkout E na landing page
   • Na landing: ao clicar "Entrar", Turnstile valida antes de redirecionar ao login
   • Edge Function: verify-turnstile

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. SISTEMA DE ACESSO E MONETIZAÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

7.1 Hierarquia de Acesso
  ┌──────────────┬────────────────────────────────────────────────┐
  │ Role         │ Permissões                                     │
  ├──────────────┼────────────────────────────────────────────────┤
  │ anon         │ Checkout público, leitura de produtos ativos   │
  │ user         │ Completar perfil, acesso básico                │
  │ admin        │ Painel completo do produtor (CRUD próprio)     │
  │ super_admin  │ Tudo + billing + platform + meta-ads + health  │
  └──────────────┴────────────────────────────────────────────────┘

7.2 Billing (Faturamento da Plataforma)
  Tabelas: billing_accounts, billing_transactions, billing_tiers
  Trigger: accrue_platform_fee (dispara quando order.status → paid/approved)
  Fórmula: fee = order.platform_fee_amount (calculado na Edge Function)
  Bloqueio: if balance > credit_limit → blocked = true

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. EDGE FUNCTIONS (Backend)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌──────────────────────────────┬────────────────────────────────────────┐
│ Função                       │ Propósito                              │
├──────────────────────────────┼────────────────────────────────────────┤
│ create-asaas-payment         │ Criar pagamento via Asaas              │
│ create-pix-payment           │ Criar pagamento PIX via Pagar.me       │
│ create-pagarme-card-payment  │ Criar pagamento cartão via Pagar.me    │
│ create-mercadopago-payment   │ Criar pagamento via Mercado Pago       │
│ create-stripe-payment        │ Criar pagamento via Stripe             │
│ generate-3ds-token           │ Gerar token 3D Secure (autenticação)   │
│ check-order-status           │ Polling status (sem auth, anon)        │
│ asaas-webhook                │ Receber webhooks Asaas                 │
│ mercadopago-webhook          │ Receber webhooks Mercado Pago          │
│ pagarme-webhook              │ Receber webhooks Pagar.me              │
│ stripe-webhook               │ Receber webhooks Stripe                │
│ resend-webhook               │ Receber webhooks Resend (email events) │
│ facebook-capi                │ Enviar eventos CAPI ao Facebook        │
│ fire-webhooks                │ Disparar webhooks customizados (HMAC)  │
│ generate-email-copy          │ Gerar copy de email via Lovable AI     │
│ process-upsell               │ Processar one-click upsell             │
│ send-access-link             │ Enviar link de acesso via Resend       │
│ send-pix-reminder            │ Lembrete de PIX pendente               │
│ product-moderation-email     │ E-mail de moderação de produto         │
│ resolve-user-destination     │ Determinar destino pós-login           │
│ delete-account               │ Deletar conta do usuário               │
│ pwa-manifest                 │ Gerar manifest.json dinâmico           │
│ test-push                    │ Testar notificação push                │
│ verify-turnstile             │ Validar Cloudflare Turnstile           │
│ reconcile-orders             │ Reconciliar pedidos com gateway        │
│ validate-gateway             │ Validar credenciais do gateway         │
│ signed-material-url          │ Gerar URL assinada para materiais      │
│ billing-notify               │ Notificar sobre billing                │
│ billing-recharge             │ Processar recarga de créditos          │
│ billing-validate-card        │ Validar cartão para billing            │
│ cloudflare-add-hostname      │ Adicionar domínio custom (Cloudflare)  │
│ cloudflare-check-status      │ Verificar status domínio (Cloudflare)  │
│ cloudflare-remove-hostname   │ Remover domínio custom (Cloudflare)    │
│ webhook-test                 │ Testar webhook com payload simulado    │
│ webhook-retry                │ Reprocessar webhooks com falha (backoff│
│                              │ exponencial: 5s, 30s, 2min)            │
│ meta-ads                     │ Consultar dados Meta Ads               │
│ meta-ads-alerts              │ Alertas de Meta Ads                    │
│ meta-diagnostics             │ Diagnóstico de pixels                  │
│ meta-emq                     │ Consultar EMQ score                    │
│ meta-emq-monitor             │ Monitorar EMQ automaticamente          │
└──────────────────────────────┴────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
9. SISTEMA DE IA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

9.1 IA-01: Gerador de E-mail Copy
  Edge Function: generate-email-copy
  Modelo: Lovable AI (via LOVABLE_API_KEY)
  Objetivo: Gerar copy de e-mails transacionais e marketing
  Inputs: funnel_type, customer_name, product_name, product_price
  Output: Texto HTML de e-mail pronto para envio
  Uso: Botão "Gerar com IA" na tela de Comunicações

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
10. TELEMETRIA E LOGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

10.1 Tabelas de Tracking
  • pixel_events — Eventos de pixel por produto (browser/server)
  • emq_snapshots — Snapshots diários de qualidade de eventos
  • email_logs — Logs completos de e-mails enviados
  • abandoned_carts — Carrinhos abandonados (com UTM params)

10.2 Eventos Capturados (pixel_events)
  • PageView, ViewContent, InitiateCheckout
  • AddPaymentInfo, Purchase
  • Source: browser | server (CAPI)
  • Visualização: selo DUAL ✓ quando browser+server registrados

10.3 Métricas de E-mail (email_logs)
  • sent, delivered, opened, clicked, bounced
  • cost_estimate por e-mail
  • Webhook Resend: atualiza status em tempo real

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
11. BANCO DE DADOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABELAS PRINCIPAIS (31 tabelas + 2 views)

Core:
  • profiles — Dados do usuário (CPF, telefone, avatar, profile_completed)
  • user_roles — Roles (admin, user, super_admin) com enum app_role
  • products — Produtos digitais
  • orders — Pedidos de compra (com platform_fee_amount/percent)
  • customers — Compradores

Checkout:
  • checkout_settings — Personalização visual por produtor
  • checkout_builder_configs — Layouts drag-and-drop
  • checkout_templates — Templates pré-prontos
  • coupons — Cupons de desconto
  • order_bumps — Order bumps
  • upsell_offers — Ofertas upsell

Conteúdo:
  • courses — Cursos
  • course_modules — Módulos
  • course_lessons — Aulas
  • lesson_materials — Materiais complementares
  • lesson_progress — Progresso do aluno
  • lesson_reviews — Avaliações
  • member_access — Tokens de acesso

Pagamento:
  • payment_gateways — Configuração de gateways por produtor
  • billing_accounts — Conta de billing da plataforma
  • billing_transactions — Transações de billing
  • billing_tiers — Tiers de crédito (Iron/Bronze/Silver/Gold)

Rastreamento:
  • product_pixels — Configuração de pixels por produto
  • pixel_events — Eventos registrados
  • emq_snapshots — Snapshots de qualidade EMQ
  • abandoned_carts — Carrinhos abandonados
  • email_logs — Logs de e-mail

Infraestrutura:
  • notification_settings — Config de notificações push
  • pwa_settings — Config PWA por produtor
  • webhook_endpoints — Endpoints de webhook customizados
  • webhook_deliveries — Log de entregas de webhooks (retry/backoff)
  • facebook_domains — Domínios verificados no Facebook
  • custom_domains — Domínios customizados (Cloudflare SaaS)
  • platform_settings — Config global da plataforma
  • internal_tasks — Tarefas internas (super_admin)
  • fraud_blacklist — Blacklist de fraude (CPF, email, IP)
  • sales_pages — Páginas de venda (slug-based)
  • billing_recharges — Recargas de crédito (billing)

Views:
  • active_gateways — Gateways ativos (view)
  • public_product_pixels — Pixels sem CAPI token (view segura)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
12. SEGURANÇA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

12.1 Row Level Security (RLS)
  TODAS as tabelas possuem RLS habilitado.
  Padrão: user_id = auth.uid() OR is_super_admin(auth.uid())
  Tabelas de checkout (products, checkout_settings): leitura pública permitida
  Tabelas sensíveis (billing, internal_tasks): apenas super_admin

12.2 Functions SECURITY DEFINER
  • has_role(_user_id, _role) — Verifica role sem recursão RLS
  • is_super_admin(_user_id)
  • owns_course, owns_module, owns_lesson — Validação de propriedade

12.3 Proteções
  • Validação server-side de preços (Edge Functions)
  • HMAC-SHA256 em webhooks customizados
  • View public_product_pixels oculta capi_token
  • Logins anônimos desabilitados
  • Roles armazenados em tabela separada (não no profile)
  • Service Role usado apenas em Edge Functions
  • Cloudflare Turnstile no checkout

12.4 Secrets (nunca expostos no código)
  SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_DB_URL, ASAAS_API_KEY, PAGARME_API_KEY,
  MERCADOPAGO_ACCESS_TOKEN, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
  RESEND_API_KEY, RESEND_WEBHOOK_SECRET, ONESIGNAL_APP_ID,
  ONESIGNAL_REST_API_KEY, META_ACCESS_TOKEN, LOVABLE_API_KEY,
  SUPABASE_PUBLISHABLE_KEY, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID,
  TURNSTILE_SECRET_KEY, CRISP_WEBSITE_ID

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
13. PWA E RECURSOS AVANÇADOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

13.1 Progressive Web App
  • Manifest dinâmico via Edge Function pwa-manifest (puxa branding por user)
  • Link rel="manifest" no index.html aponta para a edge function
  • Service Worker do OneSignal (OneSignalSDKWorker.js) — único SW ativo
  • Instalação nativa via BeforeInstallPromptEvent (componente InstallPrompt)
  • Ícones default 192x192 e 512x512 em /public (fallback quando user não subiu)
  • Customização por produtor em /admin/pwa (nome, cores, ícones)

13.2 Push Notifications
  • Via OneSignal
  • Notificação automática a cada venda
  • Sons customizáveis (bell, coin, kaching, magic, success)

13.3 Realtime
  • Checkout presence: visitantes ao vivo via Supabase Realtime
  • Hook: useCheckoutPresence

13.4 Capacitor
  • Configuração para build mobile (capacitor.config.ts)
  • Pronto para compilação iOS/Android

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
14. DATABASE TRIGGERS E FUNCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌──────────────────────────────────┬───────────────────────────────────────┐
│ Function                         │ Propósito                             │
├──────────────────────────────────┼───────────────────────────────────────┤
│ handle_new_user()                │ Cria profile ao registrar usuário     │
│ handle_new_user_role()           │ Atribui role 'user' ao novo cadastro  │
│ promote_to_admin_on_profile_     │ Auto-promove para admin quando        │
│   complete()                     │ profile_completed = true              │
│ accrue_platform_fee()            │ Acumula taxa da plataforma ao aprovar │
│                                  │ um pedido (billing_accounts/trans.)   │
│ has_role(_user_id, _role)        │ Verifica role (SECURITY DEFINER)      │
│ is_super_admin(_user_id)         │ Verifica super_admin                  │
│ owns_course/module/lesson()      │ Verifica propriedade de conteúdo      │
└──────────────────────────────────┴───────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
15. DESIGN SYSTEM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

15.1 Identidade Visual
  Nome: PanteraPay — "Predador Estratégico"
  Tema: Dark-first (fundo escuro premium)
  Cor primária: HSL 151 100% 45% (verde vibrante #00E676)
  Foreground: Branco puro
  Cards: HSL 240 8% 8% (cinza muito escuro)

15.2 Tokens CSS (index.css)
  --background: 240 8% 4%
  --primary: 151 100% 45%
  --primary-foreground: 0 0% 0% (preto sobre verde)
  --card: 240 8% 8%
  --muted: 240 8% 13%
  --destructive: 0 100% 66%
  --checkout-highlight: 151 100% 45%
  --checkout-badge: 43 64% 52% (dourado)

15.3 Landing Page
  Componentes: LandingHeader, HeroSection, ShowcaseSection,
  WhatsAppSection, FeaturesGrid, CheckoutCustomSection,
  IntegrationsSection, NotificationsSection, AllFeatures,
  AchievementsSection, CTASection, LandingFooter
  Mascote: pantera-mascot.png (usado no header e footer)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
16. CAPI / PIXEL — PROBLEMA E SOLUÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

16.1 Problema Identificado
  O Meta (Facebook) categoriza automaticamente Datasets de Pixel
  baseado no domínio. Domínios com palavras como "pay", "checkout",
  "finance" são classificados como "Serviços Financeiros".

  Consequência: O Meta bloqueia o compartilhamento de dados pessoais
  via CAPI (email, telefone, IP, fbclid) para compliance com LGPD.
  Resultado: EMQ (Event Match Quality) baixo → otimização de
  campanhas prejudicada → custo por aquisição mais alto.

  Domínios afetados:
  • checkout.panterapay.com.br → "panterapay" contém "pay"
  • paycheckout.lovable.app → "paycheckout" contém "pay" e "checkout"

16.2 Solução Implementada
  Migração para panttera.com.br (com dois "t"):
  • "panttera" não contém palavras-chave de serviços financeiros
  • Categorização esperada: "E-commerce/Varejo" (permite dados completos)
  • Subdomínio app.panttera.com.br para o aplicativo

16.3 Edge Function facebook-capi — Detalhes Técnicos
  Endpoint: /facebook-capi
  Método: POST (sem auth — aceita eventos do checkout público)
  Versão da API do Meta: v22.0

  Dados enviados ao Meta:
  • user_data.em — SHA256(email)
  • user_data.ph — SHA256(55+telefone)
  • user_data.fn — SHA256(primeiro_nome)
  • user_data.ln — SHA256(sobrenome)
  • user_data.external_id — SHA256(CPF) ou SHA256(visitor_id)
  • user_data.country — SHA256("br") (sempre)
  • user_data.fbc — Click ID do Facebook (validado < 90 dias)
  • user_data.fbp — Browser ID do Facebook
  • user_data.client_ip_address — IP público real (filtra IPs privados)
  • user_data.client_user_agent — User-Agent do navegador
  • custom_data — value, currency, content_ids, order_id

  Validações implementadas:
  • fbc vazio ou expirado (>90 dias) é descartado
  • IPs privados (RFC 1918) são filtrados
  • fbp deve começar com "fb."
  • Registro dual: log_browser=true cria entrada "browser" + "server"

16.4 Checklist Pós-Migração
  □ Verificar domínio app.panttera.com.br no Meta Business
  □ Confirmar categoria do Dataset como "E-commerce/Varejo"
  □ Remover domínios antigos da allowlist do Meta
  □ Atualizar script de tracking para novo domínio
  □ Rodar Varredura Completa (/admin/tracking) → confirmar DUAL ✓
  □ Monitorar EMQ score por 7 dias

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
17. ROTEIRO DE MIGRAÇÃO DE DOMÍNIO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

17.1 Status Atual
  ✅ FASE 1: Domínio panttera.com.br registrado no Registro.br
  ✅ FASE 2: Cloudflare configurado, nameservers apontados
  🔄 FASE 3: Registros DNS no Cloudflare (em andamento)
  ⬜ FASE 4: Conectar app.panttera.com.br na Lovable (Settings → Domains)
  ⬜ FASE 5: Remixar projeto e separar landing do app
  ⬜ FASE 6: Remover landing deste projeto, redirecionar / → /login

17.2 Fases Detalhadas

  FASE 3 — DNS no Cloudflare:
  1. Adicionar registro A: nome "app", valor 185.158.133.1, Proxy OFF
  2. Adicionar CNAME: nome "@", valor panttera.pages.dev, Proxy ON
  3. Adicionar CNAME: nome "www", valor panttera.pages.dev, Proxy ON

  FASE 4 — Lovable:
  1. Ir em Settings → Domains → Connect Domain
  2. Digitar: app.panttera.com.br
  3. Copiar o valor TXT gerado
  4. Adicionar no Cloudflare: TXT _lovable.app com o valor copiado
  5. Aguardar verificação e SSL automático

  FASE 5 — Separação:
  1. Remixar este projeto (Settings → Remix)
  2. Remix = landing page → conectar panttera.com.br
  3. Este projeto = app → manter app.panttera.com.br

  FASE 6 — Limpeza:
  1. Remover componentes de landing deste projeto
  2. Redirecionar rota / para /login
  3. Atualizar capacitor.config.ts com novo domínio

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
18. HOOKS CUSTOMIZADOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌──────────────────────────┬────────────────────────────────────────┐
│ Hook                     │ Propósito                              │
├──────────────────────────┼────────────────────────────────────────┤
│ useAuth                  │ Autenticação (user, signOut, loading,  │
│                          │ isSuperAdmin)                          │
│ useAbandonedCart          │ Registrar carrinho abandonado          │
│ useCheckoutPresence      │ Visitantes ao vivo via Realtime        │
│ useFacebookPixel         │ Disparar eventos Pixel no browser      │
│ useMetaAds               │ Consultar dados Meta Ads               │
│ useTheme                 │ Controle de tema (dark/light)          │
│ use-mobile               │ Detectar viewport mobile               │
│ use-toast                │ Sistema de toasts                      │
└──────────────────────────┴────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
19. DEPENDÊNCIAS PRINCIPAIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Frontend:
  • react 18 + react-dom + react-router-dom 6
  • @tanstack/react-query 5 — Cache e sincronização de dados
  • @supabase/supabase-js 2 — Cliente Supabase
  • tailwindcss 3 + tailwindcss-animate — Estilos
  • shadcn/ui (radix-ui) — Componentes base
  • recharts 2 — Gráficos
  • framer-motion 12 — Animações
  • lucide-react — Ícones
  • sonner — Toasts
  • zod — Validação de schemas
  • react-hook-form — Formulários
  • @dnd-kit — Drag and drop
  • date-fns — Manipulação de datas
  • cmdk — Command palette
  • vaul — Drawers
  • embla-carousel-react — Carrosséis

Build:
  • vite + @vitejs/plugin-react-swc
  • vite-plugin-pwa — PWA
  • typescript 5
  • vitest — Testes
  • playwright — E2E tests

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
20. CONSIDERAÇÕES FINAIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

20.1 Pontos Fortes
  • Multi-tenant com isolamento completo via RLS
  • Multi-gateway (4 provedores) com configuração por produtor
  • Rastreamento avançado (Pixel + CAPI + EMQ)
  • Auto-promoção de produtores (zero fricção)
  • Billing automatizado com tiers de crédito
  • PWA com push notifications
  • Checkout Builder visual drag-and-drop
  • One-click upsell pós-compra
  • Landing page institucional integrada
  • Gamificação de vendas no dashboard

20.2 Pontos de Atenção
   • Recuperação de senha não implementada (reset password flow)
   • Rate limiting não implementado nas Edge Functions
   • Busca de clientes limitada a 1000 registros (limite Supabase)
   • Checkout Builder sem preview mobile

20.3 Preparação para Escala
  • Arquitetura serverless (Edge Functions escalam automaticamente)
  • Banco PostgreSQL com RLS otimizado
  • Realtime para features live
  • Capacitor config pronta para mobile nativo

20.4 Roadmap Técnico
  • Migração de domínio para panttera.com.br (em andamento)
  • Separação landing page ↔ app (FASE 5)
  • Recuperação WhatsApp (automação de carrinhos abandonados)
  • Pixels Google Ads e GA4
  • Sistema de afiliados (links de indicação + comissões)
  • Domínios customizados por produtor

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
21. INTEGRAÇÃO DE PARCEIROS (MARKETPLACE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

21.1 Visão Geral
  A PanteraPay permite que apps de terceiros (ex: GatFlow) se integuem 
  oficialmente via OAuth2 e SSO para oferecer recursos aos lojistas.

21.2 Credenciais de Marketplace (GatFlow)
  • URLs Base (Produção): https://app.panttera.com.br
  • Token Endpoint: /api/oauth/token (POST)
  • User Info: /api/v1/user (GET)
  • Webhook Endpoint: (Configurável no painel do parceiro)

21.3 Fluxo SSO (JWT HS256)
  O lojista é redirecionado para o parceiro com um token assinado:
  https://parceiro.com/auth/sso?token={JWT}
  
  O JWT deve ser validado usando o PANTTERA_SHARED_SECRET.
  Payload padrão:
  {
    "shop_id": "ID_DO_LOJISTA",
    "admin_email": "loja@exemplo.com",
    "exp": TIMESTAMP_EXPIRACAO
  }

21.4 Webhooks de Parceiro
  Notificações de billing e ciclo de vida são enviadas para o parceiro.
  As assinaturas são enviadas no header x-panttera-signature e validadas
  usando o PANTTERA_WEBHOOK_SECRET via HMAC SHA-256.

═══════════════════════════════════════════════════════════════
  FIM DO MANUAL TÉCNICO
  PanteraPay — Checkout as a Service
  Documento gerado automaticamente em ${new Date().toLocaleDateString("pt-BR")}
═══════════════════════════════════════════════════════════════
`}</pre>
      </div>
    </div>
  );
};

export default TechnicalManual;
