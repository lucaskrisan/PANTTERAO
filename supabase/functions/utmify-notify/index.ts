import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const UTMIFY_ENDPOINT = 'https://api.utmify.com.br/api-credentials/orders';

// Map internal events to UTMify statuses
function mapStatus(internalEvent: string): string | null {
  const mapping: Record<string, string> = {
    'payment.approved': 'paid',
    'order.paid': 'paid',
    'payment.pending': 'waiting_payment',
    'order.pending': 'waiting_payment',
    'payment.refunded': 'refunded',
    'order.refunded': 'refunded',
    'payment.chargedback': 'chargedback',
    'payment.refused': 'refused',
  };
  return mapping[internalEvent] || null;
}

// Map internal payment method to UTMify format
function mapPaymentMethod(method: string): string {
  const mapping: Record<string, string> = {
    pix: 'pix',
    credit_card: 'credit_card',
    boleto: 'boleto',
    card: 'credit_card',
  };
  return mapping[method] || 'credit_card';
}

// Format date to UTMify format: 'YYYY-MM-DD HH:MM:SS' (UTC)
function formatUtmifyDate(isoDate: string | null): string | null {
  if (!isoDate) return null;
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().replace('T', ' ').substring(0, 19);
  } catch {
    return null;
  }
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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // --- Test connection mode ---
    if (event === 'test_connection') {
      const { data: integration } = await supabase
        .from('utmify_integrations')
        .select('token, active')
        .eq('user_id', user_id)
        .single();

      if (!integration?.token) {
        return new Response(JSON.stringify({ error: 'Token não configurado' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const now = formatUtmifyDate(new Date().toISOString())!;
      const testPayload = {
        orderId: `test_${crypto.randomUUID().substring(0, 8)}`,
        platform: 'Panttera',
        paymentMethod: 'pix',
        status: 'paid',
        createdAt: now,
        approvedDate: now,
        refundedAt: null,
        customer: {
          name: 'Teste Panttera',
          email: 'teste@panttera.com.br',
          phone: '11999999999',
          document: '00000000000',
          country: 'BR',
        },
        products: [{
          id: 'test-product',
          name: 'Produto Teste',
          planId: null,
          planName: null,
          quantity: 1,
          priceInCents: 100,
        }],
        trackingParameters: {
          src: null, sck: null,
          utm_source: null, utm_campaign: null,
          utm_medium: null, utm_content: null, utm_term: null,
        },
        commission: {
          totalPriceInCents: 100,
          gatewayFeeInCents: 0,
          userCommissionInCents: 100,
        },
        isTest: true,
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      try {
        const res = await fetch(UTMIFY_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-token': integration.token.trim(),
          },
          body: JSON.stringify(testPayload),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const body = await res.text();

        return new Response(JSON.stringify({ success: res.ok, status: res.status, body: body.substring(0, 500) }), {
          status: res.ok ? 200 : 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (_e) {
        clearTimeout(timeout);
        return new Response(JSON.stringify({ error: 'Timeout ou falha de conexão com UTMify' }), {
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

    const utmifyStatus = mapStatus(event);
    if (!utmifyStatus) {
      console.log(`[utmify-notify] Event "${event}" not mapped, skipping`);
      return new Response(JSON.stringify({ skipped: true, reason: 'unmapped_event' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user has active UTMify integration
    const { data: integration } = await supabase
      .from('utmify_integrations')
      .select('token, active')
      .eq('user_id', user_id)
      .single();

    if (!integration?.active || !integration?.token) {
      console.log('[utmify-notify] No active UTMify integration for user', user_id);
      return new Response(JSON.stringify({ skipped: true, reason: 'no_integration' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, amount, payment_method, status, external_id, metadata, product_id, customer_id, created_at, updated_at, platform_fee_amount')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      console.error('[utmify-notify] Order not found:', orderError);
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch customer
    let customer = { name: '', email: '', phone: null as string | null, document: null as string | null, country: 'BR' };
    if (order.customer_id) {
      const { data: cust } = await supabase
        .from('customers')
        .select('name, email, phone, cpf')
        .eq('id', order.customer_id)
        .single();
      if (cust) {
        customer = {
          name: cust.name || '',
          email: cust.email || '',
          phone: cust.phone || null,
          document: cust.cpf || null,
          country: 'BR',
        };
      }
    }

    // Fetch product (incl. currency for multi-currency support)
    const products: Array<Record<string, unknown>> = [];
    let productCurrency = 'BRL';
    if (order.product_id) {
      const { data: prod } = await supabase
        .from('products')
        .select('id, name, price, currency')
        .eq('id', order.product_id)
        .single();
      if (prod) {
        if (prod.currency) productCurrency = String(prod.currency).toUpperCase();
        products.push({
          id: prod.id,
          name: prod.name,
          planId: null,
          planName: null,
          quantity: 1,
          priceInCents: Math.round((prod.price || 0) * 100),
        });
      }
    }

    // Build tracking parameters from order metadata
    const meta = (order.metadata as Record<string, unknown>) || {};
    const trackingParameters = {
      src: meta.src ? String(meta.src) : null,
      sck: meta.sck ? String(meta.sck) : null,
      utm_source: meta.utm_source ? String(meta.utm_source) : null,
      utm_campaign: meta.utm_campaign ? String(meta.utm_campaign) : null,
      utm_medium: meta.utm_medium ? String(meta.utm_medium) : null,
      utm_content: meta.utm_content ? String(meta.utm_content) : null,
      utm_term: meta.utm_term ? String(meta.utm_term) : null,
    };

    // Build commission
    const totalCents = Math.round((order.amount || 0) * 100);
    const feeCents = Math.round((order.platform_fee_amount || 0) * 100);
    const commission = {
      totalPriceInCents: totalCents,
      gatewayFeeInCents: feeCents,
      userCommissionInCents: totalCents - feeCents,
    };

    // Determine dates
    const createdAt = formatUtmifyDate(order.created_at)!;
    let approvedDate: string | null = null;
    let refundedAt: string | null = null;

    if (utmifyStatus === 'paid') {
      approvedDate = formatUtmifyDate(order.updated_at) || createdAt;
    }
    if (utmifyStatus === 'refunded' || utmifyStatus === 'chargedback') {
      refundedAt = formatUtmifyDate(order.updated_at) || createdAt;
      // Set approvedDate to created_at for refunds (order was originally approved)
      approvedDate = createdAt;
    }

    // Build UTMify payload per their API docs
    const payload = {
      orderId: order.external_id || order.id,
      platform: 'Panttera',
      paymentMethod: mapPaymentMethod(order.payment_method),
      status: utmifyStatus,
      currency: productCurrency,
      createdAt,
      approvedDate,
      refundedAt,
      customer,
      products,
      trackingParameters,
      commission,
    };

    console.log('[utmify-notify] Sending to UTMify:', JSON.stringify({ status: utmifyStatus, currency: productCurrency, orderId: order.id }));

    // Send to UTMify with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(UTMIFY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-token': integration.token.trim(),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const resBody = await res.text();

    console.log('[utmify-notify] UTMify response:', { status: res.status, body: resBody.substring(0, 500) });

    return new Response(JSON.stringify({
      success: res.ok,
      status: res.status,
      utmify_response: resBody.substring(0, 500),
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[utmify-notify] Error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
