import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { product_id } = await req.json();

    let PAGARME_API_KEY: string | null = null;
    let environment = 'sandbox';

    // Resolve API key and environment from producer's gateway
    if (product_id) {
      const { data: prod } = await supabaseAdmin
        .from('products')
        .select('user_id')
        .eq('id', product_id)
        .maybeSingle();

      if (prod?.user_id) {
        const { data: gw } = await supabaseAdmin
          .from('payment_gateways')
          .select('config, environment')
          .eq('user_id', prod.user_id)
          .eq('provider', 'pagarme')
          .eq('active', true)
          .maybeSingle();

        if (gw?.config && typeof gw.config === 'object' && (gw.config as any).api_key) {
          PAGARME_API_KEY = (gw.config as any).api_key;
        }
        if (gw?.environment) {
          environment = gw.environment;
        }
      }
    }

    if (!PAGARME_API_KEY) {
      PAGARME_API_KEY = Deno.env.get('PAGARME_API_KEY') || null;
    }
    if (!PAGARME_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Gateway não configurado.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3DS token endpoint
    const tdsBaseUrl = environment === 'production'
      ? 'https://3ds.stone.com.br/v2'
      : 'https://3ds-sdx.stone.com.br/v2';

    const tokenRes = await fetch(`${tdsBaseUrl}/tds-token`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${btoa(PAGARME_API_KEY + ':')}`,
      },
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.tds_token) {
      console.error('[generate-3ds-token] Error:', JSON.stringify(tokenData));
      return new Response(
        JSON.stringify({ error: 'Erro ao gerar token 3DS.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        token: tokenData.tds_token,
        environment,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[generate-3ds-token] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao gerar token 3DS.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
