import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Retry delays in seconds: 5s, 30s, 2min
const RETRY_DELAYS = [5, 30, 120];
const TIMEOUT_MS = 5000;

// Payment success events that REQUIRE confirmed order status
const PAYMENT_SUCCESS_EVENTS = [
  'payment.approved',
  'payment.confirmed',
  'order.paid',
  'order.approved',
  'subscription.activated',
  'subscription.renewed',
];

// Order statuses that represent confirmed payment
const CONFIRMED_STATUSES = ['paid', 'approved', 'confirmed', 'completed'];

async function createHmacSignature(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function deliverWebhook(
  url: string,
  secret: string,
  payload: Record<string, unknown>,
  event: string,
): Promise<{ status: number; body: string; success: boolean }> {
  const bodyStr = JSON.stringify(payload);
  const signature = await createHmacSignature(secret, bodyStr);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-panttera-signature': signature,
        'x-panttera-event': event,
        'User-Agent': 'Panttera-Webhooks/1.0',
      },
      body: bodyStr,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    let respBody = '';
    try { respBody = await resp.text(); } catch { respBody = ''; }

    return { status: resp.status, body: respBody.substring(0, 2000), success: resp.ok };
  } catch (err) {
    clearTimeout(timeout);
    const msg = (err as Error).message || 'Unknown error';
    return { status: 0, body: msg, success: false };
  }
}

function buildPayload(event: string, order: Record<string, unknown>, eventId: string) {
  const customers = order.customers as Record<string, unknown> | null;
  const products = order.products as Record<string, unknown> | null;
  const productCurrency = (products?.currency as string | undefined)?.toUpperCase() || 'BRL';

  return {
    id: eventId,
    type: event,
    created_at: new Date().toISOString(),
    data: {
      order_id: order.id,
      external_id: order.external_id || null,
      status: order.status,
      payment: {
        amount: order.amount,
        currency: productCurrency,
        method: order.payment_method,
      },
      customer: customers ? {
        name: customers.name,
        email: customers.email,
        phone: customers.phone,
        cpf: customers.cpf,
      } : null,
      product: products ? {
        id: products.id,
        name: products.name,
        price: products.price,
        currency: productCurrency,
      } : null,
      metadata: order.metadata || {},
      created_at: order.created_at,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

  // Collect audit metadata
  const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';

  try {
    const body = await req.json();
    const { event, order_id, user_id, environment: reqEnvironment } = body;

    if (!event || !order_id || !user_id) {
      return new Response(
        JSON.stringify({ error: 'event, order_id, and user_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- AUTH: Only allow service_role or the actual order owner ---
    const authHeader = req.headers.get('Authorization');
    const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;
    let callerUserId: string | null = null;
    let callerType = 'unknown';

    if (isServiceRole) {
      callerType = 'service_role';
      callerUserId = user_id;
    } else {
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const userClient = createClient(
        supabaseUrl,
        Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: { user }, error: authErr } = await userClient.auth.getUser();
      if (authErr || !user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      callerUserId = user.id;
      callerType = 'user_jwt';

      // Caller must be the order owner
      if (user.id !== user_id) {
        return new Response(
          JSON.stringify({ error: 'Forbidden' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ============================================================
    // SECURITY: Determine environment — reject test calls with real order IDs
    // ============================================================
    const environment = reqEnvironment || 'production';

    // Get full order data FIRST to validate status
    const { data: order } = await supabase
      .from('orders')
      .select('*, customers(id, name, email, phone, cpf), products(id, name, price, currency, delivery_method)')
      .eq('id', order_id)
      .single();

    if (!order) {
      // Log blocked attempt
      await supabase.from('webhook_audit_log').insert({
        caller_user_id: callerUserId,
        caller_type: callerType,
        event_type: event,
        order_id,
        order_status_at_fire: null,
        environment,
        blocked: true,
        block_reason: 'Order not found',
        payload: body,
        ip_address: clientIp,
        user_agent: userAgent,
      });

      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================================
    // CRITICAL SECURITY: Block payment success events if order is NOT confirmed
    // ============================================================
    const isPaymentSuccessEvent = PAYMENT_SUCCESS_EVENTS.includes(event);
    const orderStatusConfirmed = CONFIRMED_STATUSES.includes(order.status);

    if (isPaymentSuccessEvent && !orderStatusConfirmed) {
      const blockReason = `BLOCKED: Attempted to fire "${event}" but order status is "${order.status}". ` +
        `Payment success events require order status to be one of: ${CONFIRMED_STATUSES.join(', ')}`;

      console.error(`[fire-webhooks] 🚫 ${blockReason}`);

      // Log the blocked attempt for audit
      await supabase.from('webhook_audit_log').insert({
        caller_user_id: callerUserId,
        caller_type: callerType,
        event_type: event,
        order_id,
        order_status_at_fire: order.status,
        environment,
        blocked: true,
        block_reason: blockReason,
        payload: body,
        ip_address: clientIp,
        user_agent: userAgent,
      });

      return new Response(
        JSON.stringify({
          error: 'Forbidden: cannot fire payment success event for unconfirmed order',
          order_status: order.status,
          required_statuses: CONFIRMED_STATUSES,
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================================
    // SECURITY: Block test environment from using real orders
    // ============================================================
    if (environment === 'test' || environment === 'sandbox') {
      const blockReason = `BLOCKED: Test/sandbox environment attempted to use real order_id ${order_id}`;
      console.error(`[fire-webhooks] 🚫 ${blockReason}`);

      await supabase.from('webhook_audit_log').insert({
        caller_user_id: callerUserId,
        caller_type: callerType,
        event_type: event,
        order_id,
        order_status_at_fire: order.status,
        environment,
        blocked: true,
        block_reason: blockReason,
        payload: body,
        ip_address: clientIp,
        user_agent: userAgent,
      });

      return new Response(
        JSON.stringify({ error: 'Test/sandbox environment cannot use real order IDs' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get active webhook endpoints for this user and event
    const { data: endpoints } = await supabase
      .from('webhook_endpoints')
      .select('id, url, secret, events, product_id')
      .eq('user_id', user_id)
      .eq('active', true);

    if (!endpoints || endpoints.length === 0) {
      // Log successful (no-op) call
      await supabase.from('webhook_audit_log').insert({
        caller_user_id: callerUserId,
        caller_type: callerType,
        event_type: event,
        order_id,
        order_status_at_fire: order.status,
        environment,
        blocked: false,
        block_reason: null,
        payload: body,
        ip_address: clientIp,
        user_agent: userAgent,
        deliveries_count: 0,
      });

      return new Response(
        JSON.stringify({ success: true, message: 'No webhooks configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter endpoints that listen to this event
    const matching = endpoints.filter((ep: any) =>
      ep.events && Array.isArray(ep.events) && ep.events.includes(event)
    );

    if (matching.length === 0) {
      await supabase.from('webhook_audit_log').insert({
        caller_user_id: callerUserId,
        caller_type: callerType,
        event_type: event,
        order_id,
        order_status_at_fire: order.status,
        environment,
        blocked: false,
        payload: body,
        ip_address: clientIp,
        user_agent: userAgent,
        deliveries_count: 0,
      });

      return new Response(
        JSON.stringify({ success: true, message: 'No endpoints for this event' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- AppSell integration (non-blocking) — only if product uses appsell delivery ---
    const deliveryMethod = (order as any).products?.delivery_method || 'appsell';
    if (deliveryMethod === 'appsell') {
      try {
        fetch(`${supabaseUrl}/functions/v1/appsell-notify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ event, order_id, user_id }),
        }).catch(err => console.error('[fire-webhooks] appsell-notify error:', err));
      } catch (e) {
        console.error('[fire-webhooks] appsell-notify dispatch error:', e);
      }
    } else {
      console.log(`[fire-webhooks] Skipping appsell-notify — delivery_method is "${deliveryMethod}"`);
    }

    // --- UTMify integration (non-blocking) — always attempt, function checks if active ---
    try {
      fetch(`${supabaseUrl}/functions/v1/utmify-notify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ event, order_id, user_id }),
      }).catch(err => console.error('[fire-webhooks] utmify-notify error:', err));
    } catch (e) {
      console.error('[fire-webhooks] utmify-notify dispatch error:', e);
    }

    // Filter by product_id if set on endpoint
    const filteredEndpoints = matching.filter((ep: any) =>
      !ep.product_id || ep.product_id === order.product_id
    );

    const results: any[] = [];

    for (const ep of filteredEndpoints) {
      const eventId = `evt_${crypto.randomUUID().replace(/-/g, '').substring(0, 24)}`;
      const payload = buildPayload(event, order, eventId);

      const { data: delivery } = await supabase
        .from('webhook_deliveries')
        .insert({
          endpoint_id: ep.id,
          user_id,
          event_type: event,
          event_id: eventId,
          order_id,
          payload,
          status: 'pending',
          attempt: 1,
          max_attempts: 3,
        })
        .select('id')
        .single();

      const result = await deliverWebhook(ep.url, ep.secret, payload, event);

      if (result.success) {
        await supabase
          .from('webhook_deliveries')
          .update({
            status: 'success',
            last_response_status: result.status,
            last_response_body: result.body,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', delivery?.id);

        console.log(`[fire-webhooks] ✅ ${event} → ${ep.url}: ${result.status}`);
      } else {
        const nextDelay = RETRY_DELAYS[0];
        const nextRetry = new Date(Date.now() + nextDelay * 1000).toISOString();

        await supabase
          .from('webhook_deliveries')
          .update({
            status: 'retrying',
            last_response_status: result.status,
            last_response_body: result.body,
            last_error: result.body,
            next_retry_at: nextRetry,
            updated_at: new Date().toISOString(),
          })
          .eq('id', delivery?.id);

        console.log(`[fire-webhooks] ⚠️ ${event} → ${ep.url}: failed (${result.status}), retry at ${nextRetry}`);
      }

      results.push({
        endpoint_id: ep.id,
        delivery_id: delivery?.id,
        event_id: eventId,
        status: result.status,
        success: result.success,
      });
    }

    // ============================================================
    // AUDIT LOG: Record successful fire
    // ============================================================
    await supabase.from('webhook_audit_log').insert({
      caller_user_id: callerUserId,
      caller_type: callerType,
      event_type: event,
      order_id,
      order_status_at_fire: order.status,
      environment,
      blocked: false,
      payload: body,
      ip_address: clientIp,
      user_agent: userAgent,
      deliveries_count: filteredEndpoints.length,
    });

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[fire-webhooks] Error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
