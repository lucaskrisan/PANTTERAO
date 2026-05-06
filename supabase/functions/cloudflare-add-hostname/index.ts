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

    const { hostname } = await req.json();
    if (!hostname) {
      return new Response(JSON.stringify({ error: 'hostname is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const zoneId = Deno.env.get('CLOUDFLARE_ZONE_ID');
    const apiToken = Deno.env.get('CLOUDFLARE_API_TOKEN');

    if (!zoneId || !apiToken) {
      console.error('[cloudflare-add-hostname] Missing CLOUDFLARE_ZONE_ID or CLOUDFLARE_API_TOKEN');
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert record as pending first
    const { data: domainRecord, error: insertError } = await supabase
      .from('custom_domains')
      .insert({ hostname, user_id: user.id, status: 'pending' })
      .select()
      .single();

    if (insertError) {
      const msg = insertError.code === '23505'
        ? 'Este domínio já está cadastrado'
        : 'Erro ao salvar domínio';
      return new Response(JSON.stringify({ error: msg }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call Cloudflare API to provision custom hostname
    const cfRes = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          hostname,
          ssl: {
            method: 'http',
            type: 'dv',
            settings: {
              http2: 'on',
              min_tls_version: '1.2',
              tls_1_3: 'on',
            },
          },
        }),
      }
    );

    const cfData = await cfRes.json();

    if (!cfData.success) {
      console.error('[cloudflare-add-hostname] Cloudflare error:', JSON.stringify(cfData.errors));
      // Remove the pending record if Cloudflare rejected it
      await supabase.from('custom_domains').delete().eq('id', domainRecord.id);
      const cfMsg = cfData.errors?.[0]?.message ?? 'Erro na Cloudflare';
      return new Response(JSON.stringify({ error: cfMsg }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update record with Cloudflare hostname ID and status
    await supabase
      .from('custom_domains')
      .update({
        cloudflare_hostname_id: cfData.result.id,
        status: cfData.result.status ?? 'pending',
        ssl_status: cfData.result.ssl?.status ?? null,
      })
      .eq('id', domainRecord.id);

    return new Response(
      JSON.stringify({ success: true, id: domainRecord.id, cloudflare_id: cfData.result.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[cloudflare-add-hostname] Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
