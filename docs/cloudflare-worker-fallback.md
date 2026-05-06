# Cloudflare Worker — `worker-fallback` (origem do fallback de domínios customizados)

> Este Worker é o **coração** do sistema de domínios customizados de checkout
> da Panttera. Ele recebe qualquer hostname customizado roteado pelo
> Cloudflare for SaaS e encaminha o request para a origem canônica
> (`https://app.panttera.com.br`), reescrevendo o `Host` para que o servidor
> de origem aceite a requisição.
>
> **Sem este Worker, o checkout do produtor retorna 522 / 403.**

---

## 0. Glossário (LEIA ANTES DE MEXER EM QUALQUER COISA)

A arquitetura usa **dois nomes parecidos** que fazem coisas diferentes. Confundir
os dois é o erro operacional mais comum:

| Hostname | Camada | Quem cria/edita | O que é |
|----------|--------|-----------------|---------|
| `fallback.panttera.com.br` | **Alias público** | Infra Panttera (uma vez) | É o destino que **o produtor** aponta no CNAME do checkout dele. Resolve no Worker. |
| `worker-fallback.panttera.com.br` | **Origem interna do Worker** | Infra Panttera (uma vez) | É o **Fallback Origin** registrado em `SSL/TLS → Custom Hostnames` da zona Cloudflare. Está vinculado ao Worker e **NÃO PODE SER APAGADO** sem desligar todos os checkouts customizados. |

Regra de ouro:
- **Produtor** mexe **só** em `fallback.panttera.com.br` (como valor de CNAME).
- **`worker-fallback.panttera.com.br` é intocável**. Se aparecer um aviso da
  Cloudflare dizendo "este registro está em uso como Fallback Origin", é
  isso mesmo — não delete.

---

## 1. Arquitetura

```
[ navegador do cliente ]
       │
       ▼
checkout.paolasemfiltro.com           ← domínio do produtor (CNAME → fallback.panttera.com.br)
       │
       ▼
Cloudflare for SaaS (Custom Hostname)
       │
       ▼
fallback.panttera.com.br              ← alias público
       │
       ▼
worker-fallback.panttera.com.br       ← Fallback Origin interno (registro CNAME bloqueado)
       │
       ▼
Cloudflare Worker  worker-fallback    ← reescreve Host
       │
       ▼
https://app.panttera.com.br           ← origem canônica da SPA
```

---

## 2. Onde colocar este código

1. Acesse `Cloudflare Dashboard → Workers & Pages → Create → Worker`.
2. Nome sugerido: `panttera-checkout-fallback` (qualquer nome serve).
3. Cole o conteúdo da seção [3. Código do Worker](#3-código-do-worker).
4. Em `Settings → Domains & Routes`, adicione **como Custom Domain** (não como Route):
   `worker-fallback.panttera.com.br`.
5. No `SSL/TLS → Custom Hostnames → Fallback Origin` da zona `panttera.com.br`,
   confirme que o Fallback Origin é `worker-fallback.panttera.com.br`.
6. Garanta que `fallback.panttera.com.br` (o CNAME público) é apenas um alias
   que entrega o tráfego no mesmo Worker (proxy 🟠 ligado).

> ⚠️ **Não tente** adicionar `worker-fallback.panttera.com.br` como Custom
> Domain do Worker se já existir um registro DNS com esse mesmo nome **e** ele
> estiver registrado como Fallback Origin. A ordem correta é: 1) registrar
> como Custom Domain do Worker → 2) Cloudflare cria o CNAME automaticamente
> → 3) usar esse hostname como Fallback Origin.
>
> Se você já tem o registro como CNAME manual e Fallback Origin apontando
> para ele, o Worker continua funcionando — não precisa migrar. Não delete.

---

## 3. Código do Worker

```javascript
// ────────────────────────────────────────────────────────────
// worker-fallback
// Encaminha qualquer hostname customizado para app.panttera.com.br
// preservando path, query, método, body e headers úteis.
// ────────────────────────────────────────────────────────────

const ORIGIN_HOST = "app.panttera.com.br";

export default {
  async fetch(request) {
    const incomingUrl = new URL(request.url);
    const originalHost = incomingUrl.hostname;

    // Constrói a URL final apontando para a origem canônica
    const upstreamUrl = new URL(incomingUrl.toString());
    upstreamUrl.hostname = ORIGIN_HOST;
    upstreamUrl.port = "";
    upstreamUrl.protocol = "https:";

    // Clona headers e força o Host correto
    const upstreamHeaders = new Headers(request.headers);
    upstreamHeaders.set("Host", ORIGIN_HOST);
    upstreamHeaders.set("x-forwarded-host", originalHost);
    upstreamHeaders.set("x-original-host", originalHost);
    upstreamHeaders.set("x-forwarded-proto", "https");

    // Remove headers que podem confundir o upstream
    upstreamHeaders.delete("cf-connecting-ip");
    upstreamHeaders.delete("cf-ipcountry");
    upstreamHeaders.delete("cf-ray");
    upstreamHeaders.delete("cf-visitor");

    const upstreamRequest = new Request(upstreamUrl.toString(), {
      method: request.method,
      headers: upstreamHeaders,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "manual",
    });

    let response;
    try {
      response = await fetch(upstreamRequest);
    } catch (err) {
      return new Response(
        `Fallback origin error: ${err && err.message ? err.message : String(err)}`,
        { status: 502, headers: { "content-type": "text/plain; charset=utf-8" } },
      );
    }

    // Reescreve possíveis Location absolutos pra manter o usuário no domínio do produtor
    const newHeaders = new Headers(response.headers);
    const location = newHeaders.get("location");
    if (location) {
      try {
        const locUrl = new URL(location, upstreamUrl);
        if (locUrl.hostname === ORIGIN_HOST) {
          locUrl.hostname = originalHost;
          newHeaders.set("location", locUrl.toString());
        }
      } catch {
        /* ignore */
      }
    }

    newHeaders.set("x-served-by", "panttera-fallback-worker");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  },
};
```

---

## 4. O que o produtor faz (única coisa)

No painel DNS do **domínio dele** (Registro.br, GoDaddy, Cloudflare do
cliente, etc.), criar **um único registro**:

| Campo | Valor |
|-------|-------|
| Tipo  | `CNAME` |
| Nome  | subdomínio dedicado (ex: `pay`, `checkout`, `comprar`) |
| Valor | `fallback.panttera.com.br` |
| Proxy | DNS only (sem nuvenzinha laranja) |
| TTL   | Auto / 3600 |

Depois disso, ele adiciona o hostname completo (ex: `pay.cliente.com`) em
`/admin/domains` na Panttera. A plataforma cuida do resto via
`cloudflare-add-hostname`.

**O produtor nunca precisa criar, editar ou apagar nada relacionado a
`worker-fallback.panttera.com.br`.**

---

## 5. Validação rápida (curl)

Após colocar o Worker em produção, valide assim:

```bash
# 1) A origem canônica está saudável
curl -I https://app.panttera.com.br/ | head -n 1
# esperado: HTTP/2 200

# 2) O Worker direto responde (Custom Domain do Worker)
curl -I https://worker-fallback.panttera.com.br/ | head -n 1
# esperado: HTTP/2 200

# 3) O Worker aceita o Host customizado (simulando o cenário real)
curl -I https://worker-fallback.panttera.com.br/ \
  -H "Host: checkout.paolasemfiltro.com" | head -n 1
# esperado: HTTP/2 200

# 4) O domínio do produtor responde a SPA
curl -I https://checkout.paolasemfiltro.com/checkout/qualquer-id | head -n 1
# esperado: HTTP/2 200
```

Se o passo (3) retornar 403, o Worker **não está reescrevendo o Host** —
provavelmente foi colocado um redirect ou um Pages no lugar do Worker real.

---

## 6. Rotas que precisam funcionar via fallback

- `GET /checkout/:productId`
- `GET /checkout/:productId?config=...`
- `GET /checkout/sucesso`
- `GET /recibo/:orderId`
- Assets da SPA (`/assets/*.js`, `/assets/*.css`, fontes, imagens)

Tudo isso é só path pass-through — o Worker não precisa saber de rotas.
A SPA da Panttera resolve sozinha quando recebe o request com `Host: app.panttera.com.br`.

---

## 7. O que NÃO deve passar pelo fallback

- Login / signup → permanecem em `https://app.panttera.com.br`
  (o front já força isso via `getAuthOrigin()` em `src/lib/getAuthOrigin.ts`).
- Painel admin → `https://app.panttera.com.br/admin/*`.
- Webhooks → `https://app.panttera.com.br/...` ou Edge Functions diretas.

O Worker tecnicamente proxia tudo, mas a aplicação só **gera links** de
checkout no domínio do produtor — então nada além disso vaza pra ele.

---

## 8. Diagnóstico: como o painel interpreta erros

A função `domain-health-check` classifica erros em 5 camadas:

| Layer | O que significa | De quem é o problema |
|-------|-----------------|----------------------|
| `dns` | CNAME do produtor não resolve | **Produtor** |
| `ssl` | Certificado ainda não emitido / handshake falhou | Cloudflare (esperar) |
| `fallback_origin` | Worker fallback não respondeu (522/523/524/530) | **Panttera (interno)** |
| `worker_host` | Worker respondeu mas rejeitou o Host (403) | **Panttera (interno)** |
| `app` | Chegou na SPA mas houve erro de rota/aplicação | Panttera (app) |

Isso é o que permite o painel `/admin/domains` dizer com clareza
"seu DNS está certo, o problema é interno" em vez de mandar o produtor sair
mexendo no DNS sem necessidade.
