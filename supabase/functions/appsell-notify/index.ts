import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const APPSELL_ENDPOINT = 'https://appsell-software.com/api/1.1/wf/panttera';

// Map internal statuses to AppSell event types
function mapEvent(internalEvent: string): string | null {
  const mapping: Record<string, string> = {
    'payment.approved': 'approved',
    'order.paid': 'approved',
    'payment.refunded': 'refunded',
    'order.refunded': 'refunded',
    'payment.chargedback': 'chargedback',
    'subscription.reactivated': 'subscription_reactivated',
    'subscription.cancelled': 'subscription_cancelled',
    'subscription.canceled': 'subscription_cancelled',
  };
  return mapping[internalEvent] || null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { event, order_id, user_id } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'Missing user_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- Test connection mode ---
    if (event === 'test_connection') {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      const { data: integration } = await supabase
        .from('appsell_integrations')
        .select('token, active')
        .eq('user_id', user_id)
        .maybeSingle();

      if (!integration?.token) {
        return new Response(JSON.stringify({ error: 'Token não configurado' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const testPayload = {
        id: crypto.randomUUID(),
        event: 'approved',
        customer: { name: 'Teste PayCheckout', email: 'teste@paycheckout.com', phone: '11999999999', doc: '00000000000' },
        products: [{ id: 'test-product', name: 'Produto Teste', price_in_cents: 100, type: 'one_time' }],
        tracking: {},
        currency: 'BRL',
        test: true,
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      try {
        const res = await fetch(APPSELL_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'api-token': integration.token.trim() },
          body: JSON.stringify(testPayload),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const body = await res.text();

        return new Response(JSON.stringify({ success: res.ok, status: res.status, body: body.substring(0, 500) }), {
          status: res.ok ? 200 : 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        clearTimeout(timeout);
        return new Response(JSON.stringify({ error: 'Timeout ou falha de conexão com AppSell' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // --- Normal event mode ---
    if (!event || !order_id) {
      return new Response(JSON.stringify({ error: 'Missing event or order_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const appsellEvent = mapEvent(event);
    if (!appsellEvent) {
      console.log(`[appsell-notify] Event "${event}" not mapped, skipping`);
      return new Response(JSON.stringify({ skipped: true, reason: 'unmapped_event' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Check if user has active AppSell integration
    const { data: integration } = await supabase
      .from('appsell_integrations')
      .select('token, active')
      .eq('user_id', user_id)
      .maybeSingle();

    if (!integration?.active || !integration?.token) {
      console.log('[appsell-notify] No active AppSell integration for user', user_id);
      return new Response(JSON.stringify({ skipped: true, reason: 'no_integration' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch order with customer and product data
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, amount, payment_method, status, external_id, metadata, product_id, customer_id, created_at')
      .eq('id', order_id)
      .maybeSingle();

    if (orderError || !order) {
      console.error('[appsell-notify] Order not found:', orderError);
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch customer
    let customer: Record<string, string> = { name: '', email: '' };
    if (order.customer_id) {
      const { data: cust } = await supabase
        .from('customers')
        .select('name, email, phone, cpf')
        .eq('id', order.customer_id)
        .maybeSingle();
      if (cust) {
        customer = {
          name: cust.name || '',
          email: cust.email || '',
          phone: cust.phone || '',
          doc: cust.cpf || '',
        };
      }
    }

    // Fetch product
    const products: Array<Record<string, unknown>> = [];
    let productCurrency = 'BRL';
    if (order.product_id) {
      const { data: prod } = await supabase
        .from('products')
        .select('id, name, price, currency')
        .eq('id', order.product_id)
        .maybeSingle();
      if (prod) {
        productCurrency = (prod as any).currency || 'BRL';
        products.push({
          id: prod.id,
          name: prod.name,
          price_in_cents: Math.round((prod.price || 0) * 100),
          type: 'main',
        });
      }
    }

    // Build tracking from order metadata
    const meta = (order.metadata as Record<string, unknown>) || {};
    const tracking: Record<string, string> = {};
    if (meta.checkout_url) tracking.url = String(meta.checkout_url);
    if (meta.utm_source) tracking.utm_source = String(meta.utm_source);
    if (meta.utm_medium) tracking.utm_medium = String(meta.utm_medium);
    if (meta.utm_campaign) tracking.utm_campaign = String(meta.utm_campaign);
    if (meta.utm_content) tracking.utm_content = String(meta.utm_content);
    if (meta.utm_term) tracking.utm_term = String(meta.utm_term);
    if (meta.src) tracking.src = String(meta.src);

    // Build the AppSell payload
    const payload = {
      id: order.external_id || order.id,
      event: appsellEvent,
      customer,
      products,
      tracking,
      currency: productCurrency,
    };

    console.log('[appsell-notify] Sending to AppSell:', JSON.stringify({ event: appsellEvent, orderId: order.id }));

    // Send to AppSell with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(APPSELL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-token': integration.token.trim(),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const resBody = await res.text();

    console.log('[appsell-notify] AppSell response:', { status: res.status, body: resBody.substring(0, 500) });

    return new Response(JSON.stringify({
      success: res.ok,
      status: res.status,
      appsell_response: resBody.substring(0, 500),
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[appsell-notify] Error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
