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
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Validate user
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader || '' } } }
    );
    const { data: { user }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { endpoint_id, event_type } = await req.json();
    if (!endpoint_id) {
      return new Response(JSON.stringify({ error: 'endpoint_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get endpoint
    const { data: ep } = await supabase
      .from('webhook_endpoints')
      .select('*')
      .eq('id', endpoint_id)
      .eq('user_id', user.id)
      .single();

    if (!ep) {
      return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const testEvent = event_type || 'payment.approved';
    const eventId = `evt_test_${crypto.randomUUID().replace(/-/g, '').substring(0, 20)}`;

    const payload = {
      id: eventId,
      type: testEvent,
      created_at: new Date().toISOString(),
      test: true,
      data: {
        order_id: 'ord_test_000000000000',
        external_id: null,
        status: testEvent.includes('approved') ? 'paid' : testEvent.includes('refund') ? 'refunded' : 'cancelled',
        payment: {
          amount: 97.00,
          currency: 'BRL',
          method: 'pix',
        },
        customer: {
          name: 'Cliente Teste',
          email: 'teste@email.com',
          phone: '11999999999',
          cpf: '000.000.000-00',
        },
        product: {
          id: 'prod_test_000000000000',
          name: 'Produto de Teste',
          price: 97.00,
        },
        metadata: {},
        created_at: new Date().toISOString(),
      },
    };

    // Sign payload
    const bodyStr = JSON.stringify(payload);
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(ep.secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(bodyStr));
    const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');

    // Send
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    let respStatus = 0;
    let respBody = '';
    let success = false;

    try {
      const resp = await fetch(ep.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-panttera-signature': sigHex,
          'x-panttera-event': testEvent,
          'User-Agent': 'Panttera-Webhooks/1.0 (Test)',
        },
        body: bodyStr,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      respStatus = resp.status;
      try { respBody = (await resp.text()).substring(0, 2000); } catch { respBody = ''; }
      success = resp.ok;
    } catch (err) {
      clearTimeout(timeout);
      respBody = (err as Error).message;
    }

    // Log test delivery
    await supabase.from('webhook_deliveries').insert({
      endpoint_id: ep.id,
      user_id: user.id,
      event_type: testEvent,
      event_id: eventId,
      payload,
      status: success ? 'success' : 'failed',
      attempt: 1,
      max_attempts: 1,
      last_response_status: respStatus,
      last_response_body: respBody,
      completed_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({
      success,
      event_id: eventId,
      status: respStatus,
      response: respBody.substring(0, 500),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[webhook-test] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
