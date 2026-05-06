## Entendi o plano — e vou ser cirúrgico

Você está 100% certa. Eu escondi demais e o ponto crítico — **o link único que garante a comissão** — não estava em lugar nenhum visível. Vou reconstruir a área do colaborador em torno de **três pilares**:

1. **Marketplace cheio de oportunidades visíveis** (não só PIX/Carrinho — qualquer lead "frio" recuperável)
2. **Link de recuperação rastreado** (toda venda feita por esse link credita o colaborador automaticamente)
3. **Workspace útil, não estéril** (Produtos, Clientes, WhatsApp próprio, Carrinhos, Cupons)

---

## 1. Por que o Marketplace está vazio agora

A view `unclaimed_opportunities` filtra apenas:
- Carrinhos abandonados com `recovered = false`
- Pedidos PIX com `status = 'pending'`

Se a produtora não tem nada nesses dois estados **agora**, o colaborador vê zero. Vou ampliar a fonte de leads e dar visibilidade.

### Mudanças na view
- Incluir **PIX expirados nas últimas 72h** (lead quentíssimo)
- Incluir **carrinhos abandonados dos últimos 7 dias**
- Mostrar **quantas vezes o cliente já comprou**
- Ordenar por **valor + recência** (alto e fresco primeiro)
- Badge "🔥 Quente" para leads &lt; 1h

### Filtros e busca no Marketplace
- Filtro por produto, valor mínimo, tipo (PIX vs Carrinho)
- Busca por nome/telefone do cliente

---

## 2. Link único de recuperação (o coração da comissão)

Esse é **o ponto que você reforçou** e que eu ignorei. Sistema dedicado.

### Como vai funcionar
Card do lead pego mostra em **destaque máximo**:

```
https://ck.panttera.com.br/go/r/{recovery_id}
```

Esse link:
- Resolve para o checkout original com **`?col={collaborator_id}` + cookie `_pcol`** por 30 dias
- Toda venda concluída com esse cookie credita comissão ao colaborador (mesmo dias depois)
- Botão **"Copiar link de recuperação"** gigante + aviso "Use SOMENTE este link — sem ele você não recebe comissão"
- Botão **"Abrir no WhatsApp com mensagem pronta"** já injetando o link

### Backend
- Edge function `go-recovery` (`/go/r/:id`) → seta cookie + 302 para checkout/PIX
- `recovery_opportunities` ganha `tracking_token` (gerado no claim via trigger)
- `process-order-paid.ts` lê cookie/query `col` e cria `commissions` row + marca recovery como `recovered`

---

## 3. Card do lead reorganizado

```
┌─────────────────────────────────────────────┐
│ [Em negociação]   Pego há 5min  [↩ Devolver]│
│                                             │
│ 📦 Curso de Tráfego — R$ 497,00             │
│ 👤 Maria Silva    📞 (11) 99999-9999        │
│ ✉️  maria@email.com                          │
│                                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 🔗 SEU LINK DE RECUPERAÇÃO (use só este)    │
│ ┌─────────────────────────────────────────┐ │
│ │ ck.panttera.com.br/go/r/abc123  [📋]   │ │
│ └─────────────────────────────────────────┘ │
│ ⚠️ Vendas fora deste link não dão comissão  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                             │
│ [💬 WhatsApp c/ msg pronta] [📋 Copiar link]│
│ [✓ Marcar contato]  [📊 Prestar contas]    │
└─────────────────────────────────────────────┘
```

### ↩ Devolver lead ao Marketplace (NOVO — sua sugestão)
- Botão discreto no topo do card (`Devolver`)
- Abre dialog de confirmação: *"Tem certeza? O lead volta para o Marketplace e qualquer colaborador pode pegar."*
- Opcional: campo "Motivo" (cliente errado, sem perfil, peguei sem querer)
- Backend: `DELETE` do recovery + log em `recovery_release_log` (auditoria — para a produtora ver quem devolveu o quê e quantas vezes)
- **Limite anti-abuso**: máximo 3 devoluções por colaborador por dia (RPC `release_recovery` faz a checagem). Acima disso, bloqueia com toast educado.

---

## 4. Sidebar do colaborador — equilibrada

```
GINCANA DE VENDAS
  • Marketplace
  • Meus Leads (em aberto + histórico)
  • Minhas Comissões

OPERAÇÃO
  • Produtos       ← READ-ONLY
  • Clientes       ← consulta
  • Carrinhos      ← visão geral
  • Cupons         ← se permissão liberada

MEU CANAL
  • WhatsApp       ← número PRÓPRIO dele
  • Minha Conta
```

**Removidos**: Dashboard financeira, Gateways, Domínios, Webhooks, Pixels, A/B, Apps, Roadmap, Manual, tudo de Super Admin.

---

## 5. WhatsApp próprio do colaborador

- `/admin/whatsapp` para colaborador mostra **só** "Conectar meu WhatsApp" (Evolution API instance separada por `user_id`)
- Sem automações/fluxos/templates da produtora
- Botão "WhatsApp" no card usa instância dele se conectada (senão `wa.me` normal)
- Mensagens logadas em `collaborator_whatsapp_log` para a produtora auditar

---

## 6. Acesso a Produtos (read-only)

- Lista produtos ativos: nome, preço, descrição curta, link público
- Botão "Copiar link de afiliado" → também passa por `/go/r/...` (pseudo-recovery do tipo `outbound`)
- **Sem** editar/criar/excluir/configurar pixel

---

## Detalhes técnicos

### Migration
- `recovery_opportunities`: adiciona `tracking_token TEXT UNIQUE`, `released_at TIMESTAMP`, `released_reason TEXT`
- Trigger `BEFORE INSERT`: gera token aleatório
- View `unclaimed_opportunities` v2: janelas ampliadas, campos `is_hot`, `customer_purchases_count`
- Nova tabela `recovery_release_log` (recovery_id, collaborator_id, reason, released_at)
- Nova tabela `collaborator_whatsapp_instances` (user_id, evolution_instance_id, phone, status)
- RPC `release_recovery(recovery_id, reason)` com checagem de limite diário

### Edge function
- `go-recovery/index.ts`: lê `:id` ou token, seta cookie `_pcol` (30d), 302 para checkout
- `process-order-paid.ts`: ao confirmar, se `col` presente, cria `commissions` + marca recovery `recovered`

### Frontend
- `Marketplace.tsx`: filtros, busca, badge quente, link destacado, botão devolver
- `collaboratorPermissions.ts`: adiciona `products` e `whatsapp_personal` sempre liberados
- `AdminSidebar.tsx`: nova hierarquia (GINCANA / OPERAÇÃO / MEU CANAL)
- Nova `MyLeads.tsx` consolidada
- `Products.tsx` + `WhatsApp.tsx`: detectam `isPureCollaborator` e renderizam versão simplificada

---

## Ordem de entrega

1. Migration: tracking_token + view ampliada + release_log + whatsapp instances
2. Edge function `go-recovery` + ajustes em `process-order-paid`
3. Refatorar `Marketplace.tsx` (filtros, link destacado, botão devolver, msg WhatsApp pronta)
4. Refatorar `AdminSidebar.tsx`
5. Versão colaborador de `Products.tsx` (read-only)
6. Versão colaborador de `WhatsApp.tsx` (só conexão pessoal)
7. Página `MyLeads.tsx`

Faz sentido assim? Posso começar.
