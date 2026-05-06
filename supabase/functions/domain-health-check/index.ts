import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * domain-health-check
 *
 * Faz uma checagem REAL de disponibilidade do domínio customizado do produtor.
 *
 * Arquitetura esperada:
 *   checkout.cliente.com         → CNAME → fallback.panttera.com.br   (alias público)
 *   fallback.panttera.com.br     → entrega no Worker
 *   worker-fallback.panttera.com.br → fallback origin INTERNO do Worker (não mexer)
 *   Worker                       → reescreve Host para app.panttera.com.br
 *   app.panttera.com.br          → origem canônica da SPA
 *
 * O diagnóstico tenta separar erros do produtor (DNS) de erros internos da
 * Panttera (Worker / fallback origin / SSL), pra evitar que o usuário fique
 * tentando "consertar" coisas que não estão na conta DNS dele.
 */

interface HealthResult {
  ok: boolean;
  hostname: string;
  status_code: number | null;
  latency_ms: number | null;
  served_by_panttera: boolean;
  diagnosis: string;
  hint: string | null;
  layer: 'dns' | 'ssl' | 'fallback_origin' | 'worker_host' | 'app' | 'unknown';
  checked_at: string;
}

function diagnose(
  statusCode: number | null,
  error: string | null,
  servedByPanttera: boolean,
): { diagnosis: string; hint: string | null; layer: HealthResult['layer'] } {
  if (error) {
    if (/ENOTFOUND|getaddrinfo|dns/i.test(error)) {
      return {
        diagnosis: 'DNS do seu domínio não resolve',
        hint: 'O CNAME do seu subdomínio ainda não aponta para fallback.panttera.com.br ou ainda está propagando (até 30 min). Verifique no painel do seu provedor de DNS.',
        layer: 'dns',
      };
    }
    if (/timeout|timed out/i.test(error)) {
      return {
        diagnosis: 'Timeout ao conectar',
        hint: 'A origem não respondeu a tempo. Pode ser propagação de DNS ou instabilidade momentânea da Cloudflare.',
        layer: 'fallback_origin',
      };
    }
    if (/certificate|ssl|tls/i.test(error)) {
      return {
        diagnosis: 'Falha de SSL/TLS',
        hint: 'O certificado SSL ainda não foi emitido pela Cloudflare. Aguarde 5–30 min e teste novamente.',
        layer: 'ssl',
      };
    }
    return { diagnosis: 'Erro de rede', hint: error, layer: 'unknown' };
  }

  if (statusCode === null) {
    return { diagnosis: 'Sem resposta', hint: 'Não foi possível conectar ao domínio.', layer: 'unknown' };
  }
  if (statusCode === 200 && servedByPanttera) {
    return { diagnosis: 'OK', hint: null, layer: 'app' };
  }
  if (statusCode === 200 && !servedByPanttera) {
    return {
      diagnosis: 'Respondeu, mas não é a Panttera',
      hint: 'A página respondeu 200, mas o conteúdo não é o checkout da Panttera. Verifique se o CNAME do seu subdomínio aponta para fallback.panttera.com.br (e não para outro serviço).',
      layer: 'worker_host',
    };
  }
  if (statusCode === 403) {
    return {
      diagnosis: 'Host rejeitado pelo fallback (403)',
      hint: 'Seu DNS chegou no Worker da Panttera, mas ele está rejeitando o seu hostname. Isso é um problema interno da plataforma (configuração do Worker fallback), não do seu DNS. Avise o suporte.',
      layer: 'worker_host',
    };
  }
  if (statusCode === 404) {
    return {
      diagnosis: 'Rota não encontrada (404)',
      hint: 'O fallback respondeu, mas a rota não foi encontrada. Tente acessar diretamente um link de checkout (/checkout/ID).',
      layer: 'app',
    };
  }
  if (statusCode === 522 || statusCode === 523 || statusCode === 524) {
    return {
      diagnosis: `Origem inacessível (${statusCode})`,
      hint: 'O Custom Hostname está ativo na Cloudflare, mas a origem interna (Worker fallback da Panttera) não respondeu. Isso é interno da plataforma — seu DNS está correto. Avise o suporte.',
      layer: 'fallback_origin',
    };
  }
  if (statusCode === 525 || statusCode === 526) {
    return {
      diagnosis: `Falha de handshake SSL (${statusCode})`,
      hint: 'A Cloudflare não conseguiu negociar SSL com a origem do fallback. Isso é interno da Panttera.',
      layer: 'ssl',
    };
  }
  if (statusCode === 530) {
    return {
      diagnosis: 'Erro 1016 (DNS interno)',
      hint: 'O fallback interno (worker-fallback.panttera.com.br) não está resolvendo. Isso é da infraestrutura da Panttera, não do seu domínio.',
      layer: 'fallback_origin',
    };
  }
  if (statusCode >= 500) {
    return { diagnosis: `Erro do servidor (${statusCode})`, hint: 'Origem retornou erro 5xx.', layer: 'app' };
  }
  if (statusCode >= 400) {
    return { diagnosis: `Erro do cliente (${statusCode})`, hint: null, layer: 'app' };
  }
  return { diagnosis: `HTTP ${statusCode}`, hint: null, layer: 'unknown' };
}

async function probeHostname(hostname: string): Promise<HealthResult> {
  const url = `https://${hostname}/`;
  const startedAt = Date.now();
  let statusCode: number | null = null;
  let bodySnippet = '';
  let errorMsg: string | null = null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'PantteraDomainHealthCheck/1.0',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timeoutId);
    statusCode = res.status;
    try {
      const text = await res.text();
      bodySnippet = text.slice(0, 4000).toLowerCase();
    } catch {
      // ignore body read errors
    }
  } catch (err: any) {
    errorMsg = err?.message || String(err);
  }

  const latency = Date.now() - startedAt;

  // Marcadores que indicam que a SPA da Panttera está sendo servida
  const servedByPanttera =
    bodySnippet.includes('panttera') ||
    bodySnippet.includes('paycheckout') ||
    bodySnippet.includes('id="root"') ||
    bodySnippet.includes('vite');

  const { diagnosis, hint, layer } = diagnose(statusCode, errorMsg, servedByPanttera);

  return {
    ok: statusCode === 200 && servedByPanttera,
    hostname,
    status_code: statusCode,
    latency_ms: latency,
    served_by_panttera: servedByPanttera,
    diagnosis,
    hint,
    layer,
    checked_at: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const id: string | undefined = body?.id;
    let hostnameInput: string | undefined = body?.hostname;

    if (!id && !hostnameInput) {
      return new Response(JSON.stringify({ error: 'id or hostname is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (id) {
      const { data: domain, error: fetchError } = await supabase
        .from('custom_domains')
        .select('hostname,user_id')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();
      if (fetchError || !domain) {
        return new Response(JSON.stringify({ error: 'Domínio não encontrado' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      hostnameInput = domain.hostname as string;
    }

    const cleanHost = String(hostnameInput)
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .toLowerCase()
      .trim();

    if (!/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(cleanHost)) {
      return new Response(JSON.stringify({ error: 'hostname inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await probeHostname(cleanHost);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[domain-health-check] Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
