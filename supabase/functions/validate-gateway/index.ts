import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Authentication: require JWT ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // --- End Authentication ---

    const { provider, api_key, environment } = await req.json();

    if (!provider || !api_key) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Provider e API Key são obrigatórios.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Detect environment mismatch
    let envWarning: string | null = null;

    if (provider === 'pagarme') {
      if (environment === 'production' && api_key.startsWith('sk_test_')) {
        envWarning = 'Chave de SANDBOX detectada, mas o ambiente está configurado como Produção.';
      } else if (environment === 'sandbox' && api_key.startsWith('sk_live_')) {
        envWarning = 'Chave de PRODUÇÃO detectada, mas o ambiente está configurado como Sandbox.';
      }

      const res = await fetch('https://api.pagar.me/core/v5/customers?size=1', {
        headers: {
          'Authorization': `Basic ${btoa(api_key + ':')}`,
        },
      });

      if (res.status === 401 || res.status === 403) {
        return new Response(
          JSON.stringify({ valid: false, error: 'Chave API inválida ou sem permissão. Verifique no painel do Pagar.me.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!res.ok) {
        return new Response(
          JSON.stringify({ valid: false, error: `Erro ao validar chave (HTTP ${res.status}). Tente novamente.` }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ valid: true, warning: envWarning }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (provider === 'asaas') {
      const baseUrl = environment === 'production'
        ? 'https://api.asaas.com/v3'
        : 'https://sandbox.asaas.com/api/v3';

      const res = await fetch(`${baseUrl}/customers?limit=1`, {
        headers: { 'access_token': api_key },
      });

      if (res.status === 401 || res.status === 403) {
        return new Response(
          JSON.stringify({ valid: false, error: 'Chave API inválida ou sem permissão. Verifique no painel do Asaas.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!res.ok) {
        return new Response(
          JSON.stringify({ valid: false, error: `Erro ao validar chave (HTTP ${res.status}). Tente novamente.` }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ valid: true, warning: envWarning }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (provider === 'mercadopago') {
      const isTestToken = api_key.startsWith('TEST-');
      const isSandbox = environment === 'sandbox';
      if (isTestToken && !isSandbox) {
        envWarning = 'Você está usando um token de TESTE em ambiente de Produção. Pagamentos reais vão falhar. Use um token APP_USR-... para produção.';
      } else if (!isTestToken && isSandbox) {
        envWarning = 'Você está usando um token de Produção em ambiente Sandbox. Use um token TEST-... para testes.';
      }

      const res = await fetch('https://api.mercadopago.com/v1/payment_methods', {
        headers: { 'Authorization': `Bearer ${api_key}` },
      });

      if (res.status === 401 || res.status === 403) {
        return new Response(
          JSON.stringify({ valid: false, error: 'Access Token inválido ou sem permissão. Verifique no painel do Mercado Pago.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!res.ok) {
        return new Response(
          JSON.stringify({ valid: false, error: `Erro ao validar chave (HTTP ${res.status}). Tente novamente.` }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ valid: true, warning: envWarning }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (provider === 'stripe') {
      if (environment === 'production' && api_key.startsWith('sk_test_')) {
        envWarning = 'Chave de TESTE detectada, mas o ambiente está configurado como Produção.';
      } else if (environment === 'sandbox' && api_key.startsWith('sk_live_')) {
        envWarning = 'Chave de PRODUÇÃO detectada, mas o ambiente está configurado como Sandbox.';
      }

      const res = await fetch('https://api.stripe.com/v1/customers?limit=1', {
        headers: { 'Authorization': `Bearer ${api_key}` },
      });

      if (res.status === 401 || res.status === 403) {
        return new Response(
          JSON.stringify({ valid: false, error: 'Chave API inválida ou sem permissão. Verifique no painel do Stripe.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!res.ok) {
        return new Response(
          JSON.stringify({ valid: false, error: `Erro ao validar chave (HTTP ${res.status}). Tente novamente.` }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ valid: true, warning: envWarning }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ valid: false, error: `Provider "${provider}" não suportado para validação.` }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[validate-gateway] Error:', err);
    return new Response(
      JSON.stringify({ valid: false, error: 'Erro interno ao validar chave.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
