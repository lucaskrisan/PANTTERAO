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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { id } = await req.json();
    if (!id) {
      return new Response(JSON.stringify({ error: 'id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: domain, error: fetchError } = await supabase
      .from('custom_domains')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !domain) {
      return new Response(JSON.stringify({ error: 'Domínio não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!domain.cloudflare_hostname_id) {
      return new Response(
        JSON.stringify({ status: domain.status, ssl_status: domain.ssl_status }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const zoneId = Deno.env.get('CLOUDFLARE_ZONE_ID');
    const apiToken = Deno.env.get('CLOUDFLARE_API_TOKEN');

    if (!zoneId || !apiToken) {
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cfRes = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames/${domain.cloudflare_hostname_id}`,
      { headers: { 'Authorization': `Bearer ${apiToken}` } }
    );

    const cfData = await cfRes.json();

    if (!cfData.success) {
      console.error('[cloudflare-check-status] CF error:', JSON.stringify(cfData.errors));
      return new Response(
        JSON.stringify({ status: domain.status, ssl_status: domain.ssl_status }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newStatus = cfData.result.status ?? domain.status;
    const newSslStatus = cfData.result.ssl?.status ?? domain.ssl_status;

    await supabase
      .from('custom_domains')
      .update({ status: newStatus, ssl_status: newSslStatus, updated_at: new Date().toISOString() })
      .eq('id', id);

    // When domain transitions to active: trigger Stripe Apple Pay domain registration (non-blocking)
    const wasAlreadyActive = domain.status === 'active';
    if (newStatus === 'active' && !wasAlreadyActive) {
      console.log(`[cloudflare-check-status] Domain ${domain.hostname} became active — triggering Stripe PMD registration`);
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/stripe-register-domain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ domain_id: id }),
      }).catch(e => console.error('[cloudflare-check-status] stripe-register-domain error:', e));
    }

    return new Response(
      JSON.stringify({
        status: newStatus,
        ssl_status: newSslStatus,
        verification_errors: cfData.result.verification_errors ?? [],
        ssl: cfData.result.ssl ?? {},
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[cloudflare-check-status] Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
