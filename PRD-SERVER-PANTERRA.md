# PRD Técnico: Ecossistema de Servidor PanteraPay
**Versão:** 2.5 (Atualizado em 29 de Abril de 2026)
**Proprietário:** CEO / PanteraPay
**Arquitetura:** Edge Computing (Deno Runtime) + Supabase Real-time Database

---

## 1. Visão Geral do Sistema
O servidor da PanteraPay opera como um orquestrador de eventos distribuído. Ele não é um servidor centralizado único, mas uma rede de **Edge Functions** que executam lógica de negócio instantaneamente em servidores próximos ao usuário final, garantindo latência próxima de zero.

## 2. Módulos de Operação (Core Functions)

### 2.1. Módulo de Rastreamento (Tracking & Attribution)
**Função:** `facebook-capi`
*   **Entrada:** Eventos de PageView, ViewContent, InitiateCheckout, AddToCart, Purchase.
*   **Lógica de Processamento:**
    *   **Identificação Híbrida:** Cruza o `visitor_id` (browser) com o `customer_id` (database).
    *   **Normalização SHA256:** Aplica criptografia nos campos PII (E-mail, Telefone, CPF, Nome) conforme exigência do Meta.
    *   **Deduplicação via Event ID:** Atribui um ID único a cada ação para evitar contagem dupla entre Pixel e CAPI.
    *   **Bot Filtering:** Compara o `User-Agent` contra uma lista negra de robôs. Se detectado, o evento é logado mas **não enviado** ao Meta para preservar a saúde do algoritmo.
    *   **External ID:** Utiliza o CPF/CNPJ como chave de correspondência primária, elevando o Match Quality.

### 2.2. Módulo de Pagamentos (Financial Webhooks)
**Funções:** `stripe-webhook`, `asaas-webhook`, `pagarme-webhook`, `mercadopago-webhook`
*   **Entrada:** Payloads JSON enviados pelos gateways de pagamento.
*   **Segurança:** Validação de assinaturas (Signatures) para garantir que o comando de "pago" veio realmente do gateway.
*   **Lógica de Negócio:**
    *   Conversão de moedas (USD -> BRL) para fins de log.
    *   Identificação de `Product Bump` (vendas adicionais no mesmo checkout).
    *   Invocação do orquestrador `process-order-paid`.

### 2.3. Módulo de Entrega e Ciclo de Vida (Lifecycle Orchestrator)
**Função:** `process-order-paid`
*   **Orquestração de Sucesso:**
    1.  **Member Access:** Cria tokens de acesso na tabela `member_access`.
    2.  **Access Email:** Dispara e-mail via Resend com link mágico de login.
    3.  **CAPI Fallback:** Garante que o evento de compra chegue ao Meta mesmo se o checkout falhar no disparo via browser.
    4.  **Cart Recovery:** Interrompe qualquer automação de recuperação de carrinho para o comprador.
    5.  **Subscription Management:** Para assinaturas, aplica um *Grace Period* de 3 dias no cálculo da data de expiração.

### 2.4. Módulo de Autenticação de Alunos (Member Access)
**Funções:** `recover-member-access`, `send-access-link`
*   **Fluxo de Login:** Remove a necessidade de senhas para alunos.
*   **Lógica:** O sistema gera um JWT (JSON Web Token) de curta duração que identifica o comprador e libera o acesso à área de membros específica vinculada ao e-mail dele.

## 3. Estrutura de Dados (Database Schema)

### 3.1. Tabela `pixel_events`
*   **Finalidade:** Log de auditoria de todo o tráfego.
*   **Campos Chave:** `event_name`, `source` (server/browser), `event_id`, `event_value`, `is_bot`, `customer_country`.

### 3.2. Tabela `member_access`
*   **Finalidade:** Controle de permissões.
*   **Campos Chave:** `customer_id`, `course_id`, `access_token`, `expires_at`.

## 4. Recuperação de Vendas (Recovery Logic)
**Função:** `abandoned-cart-email-recovery-cron`
*   **Frequência:** Execução a cada 1 hora.
*   **Filtros:**
    *   **Janela de tempo:** 30 minutos (ajustável por produtor) até 24 horas após o abandono.
    *   **Status:** `recovered = false`.
    *   **Regra de Exclusão (Deduplicação):** A recuperação só é abortada se o cliente já tiver comprado **EXATAMENTE** o mesmo produto do carrinho abandonado (validado via tabela `pixel_events`). Compras de outros produtos não bloqueiam a recuperação.
    *   **Segurança:** Emails em lista negra (`suppressed_emails`) são automaticamente ignorados.

## 5. Manutenção e Monitoramento
*   **Logging:** Todas as Edge Functions escrevem logs em tempo real que podem ser consultados por erro de execução ou latência.
*   **Domain Health:** Funções `domain-health-check` monitoram o status do SSL e DNS dos checkouts personalizados (disparo manual sob demanda).

---
**Documento gerado automaticamente pelo Sistema de Inteligência PanteraPay.**
