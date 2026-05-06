import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { processOrderPaid } from '../_shared/process-order-paid.ts';
import { processOrderRevoked } from '../_shared/process-order-revoked.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function verifyStripeSignature(body: string, sigHeader: string, secret: string): Promise<boolean> {
  const parts = sigHeader.split(',').reduce((acc: Record<string, string>, part: string) => {
    const [key, val] = part.split('=');
    acc[key] = val;
    return acc;
  }, {} as Record<string, string>);

  const timestamp = parts['t'];
  const expectedSig = parts['v1'];

  if (!timestamp || !expectedSig) return false;

  // Reject if older than 5 minutes
  const ts = parseInt(timestamp, 10);
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const signedPayload = `${timestamp}.${body}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');

  return computed === expectedSig;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.text();
    const sigHeader = req.headers.get('stripe-signature');

    const event = JSON.parse(body);
    console.log('[stripe-webhook] Event type:', event.type, 'ID:', event.id);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // --- Resolve the webhook secret from the producer's gateway config ---
    const obj = event.data?.object;
    let resolvedWebhookSecret: string | null = null;
    let producerUserId: string | null = null;

    const metaProductId = obj?.metadata?.product_id;
    if (metaProductId) {
      const { data: prod } = await supabase
        .from('products')
        .select('user_id')
        .eq('id', metaProductId)
        .maybeSingle();
      if (prod?.user_id) producerUserId = prod.user_id;
    }

    if (!producerUserId) {
      const exId = event.type === 'checkout.session.completed' ? obj?.id : (obj?.payment_intent || obj?.id);
      if (exId) {
        const { data: order } = await supabase
          .from('orders')
          .select('user_id')
          .eq('external_id', exId)
          .maybeSingle();
        if (order?.user_id) producerUserId = order.user_id;
      }
    }

    if (producerUserId) {
      const { data: gw } = await supabase
        .from('payment_gateways')
        .select('config')
        .eq('user_id', producerUserId)
        .eq('provider', 'stripe')
        .eq('active', true)
        .maybeSingle();
      if (gw?.config && typeof gw.config === 'object' && (gw.config as any).webhook_secret) {
        resolvedWebhookSecret = (gw.config as any).webhook_secret;
      }
    }

    // Fallback: global secret (super_admin only)
    if (!resolvedWebhookSecret && producerUserId) {
      const { data: ownerRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', producerUserId)
        .eq('role', 'super_admin')
        .maybeSingle();
      if (ownerRole) {
        resolvedWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || null;
      }
    }

    // Verify signature when the producer configured a webhook secret.
    // Legacy producers without a secret must not have real paid sales rejected.
    if (resolvedWebhookSecret) {
      if (!sigHeader) {
        console.warn('[stripe-webhook] No stripe-signature header present');
        return new Response('Missing signature', { status: 400, headers: corsHeaders });
      }
      const valid = await verifyStripeSignature(body, sigHeader, resolvedWebhookSecret);
      if (!valid) {
        console.error('[stripe-webhook] Signature mismatch');
        return new Response('Invalid signature', { status: 400, headers: corsHeaders });
      }
      console.log('[stripe-webhook] Signature verified ✅');
    } else {
      console.warn('[stripe-webhook] No webhook secret found — allowing legacy event instead of blocking sales');
    }

    // --- Idempotency ---
    const dedupKey = `stripe_${event.id}`;
    const { data: inserted } = await supabase
      .from('webhook_events')
      .upsert({ id: dedupKey, gateway: 'stripe' }, { onConflict: 'id', ignoreDuplicates: true })
      .select('id')
      .maybeSingle();

    if (!inserted) {
      console.log('[stripe-webhook] Duplicate event, skipping:', dedupKey);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Map Stripe event types to order statuses
    let status: string | null = null;

    switch (event.type) {
      case 'checkout.session.completed':
        if (obj?.payment_status === 'paid') status = 'paid';
        break;
      case 'invoice.payment_succeeded':
        status = 'paid';
        break;
      case 'payment_intent.succeeded':
        // If it's part of an invoice, we handle it via invoice.payment_succeeded
        if (obj?.invoice) return new Response(JSON.stringify({ received: true, skip: 'handled_by_invoice' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
        status = 'paid';
        break;
      case 'payment_intent.payment_failed':
        status = 'failed';
        break;
      case 'charge.refunded':
        status = 'refunded';
        break;
      case 'payment_intent.canceled':
        status = 'cancelled';
        break;
      case 'charge.dispute.created':
        status = 'chargedback';
        break;

      default:
        console.log('[stripe-webhook] Unhandled event type:', event.type);
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    if (!status || !obj) {
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- Resolve external_id ---
    let externalId: string;
    if (event.type === 'checkout.session.completed') {
      externalId = obj.id;
    } else if (event.type === 'invoice.payment_succeeded' && obj.subscription) {
      externalId = obj.subscription;
    } else {
      externalId = obj.payment_intent || obj.id;
    }

    // --- Status transition guard ---
    let { data: orderData, error: updateErr } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('external_id', externalId)
      .not('status', 'in', `(${['paid', 'refunded', 'chargedback'].filter(s => {
        const p: Record<string, number> = { pending: 1, failed: 2, paid: 3, refunded: 4, cancelled: 4, chargedback: 5 };
        return (p[s] || 0) >= (p[status!] || 0);
      }).join(',')})`)
      .select('id, amount, payment_method, product_id, customer_id, user_id, metadata')
      .maybeSingle();

    if (updateErr) {
      console.error('[stripe-webhook] Error updating order:', updateErr);
    }

    // Fallback: checkout.session.completed → try payment_intent
    if (!orderData && event.type === 'checkout.session.completed' && obj.payment_intent) {
      const { data: fallbackOrder } = await supabase
        .from('orders')
        .update({ status, updated_at: new Date().toISOString(), external_id: obj.id })
        .eq('external_id', obj.payment_intent)
        .not('status', 'in', '(paid,refunded)')
        .select('id, amount, payment_method, product_id, customer_id, user_id, metadata')
        .maybeSingle();
      if (fallbackOrder) {
        console.log('[stripe-webhook] Found order via payment_intent fallback');
        orderData = fallbackOrder;
      }
    }

    console.log('[stripe-webhook] Order update:', { externalId, status, found: !!orderData });

    if (!orderData) {
      return new Response(JSON.stringify({ received: true, status }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine product currency
    let productCurrency = 'BRL';
    if (orderData.product_id) {
      const { data: prodInfo } = await supabase
        .from('products')
        .select('currency')
        .eq('id', orderData.product_id)
        .maybeSingle();
      if (prodInfo?.currency) productCurrency = prodInfo.currency;
    }

    // Fire user webhooks (non-blocking)
    if (orderData.user_id) {
      const evtMap: Record<string, string[]> = {
        paid: ['payment.approved', 'order.paid'],
        failed: ['payment.failed'],
        cancelled: ['payment.failed', 'order.cancelled'],
      };

      for (const evt of (evtMap[status] || [])) {
        fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/fire-webhooks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({ event: evt, order_id: orderData.id, user_id: orderData.user_id }),
        }).catch(err => console.error('[stripe-webhook] fire-webhooks error:', err));
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // On confirmed payment → delegate ALL side effects to shared processor
    // ═══════════════════════════════════════════════════════════════════════
    if (status === 'paid' && orderData.product_id && orderData.customer_id) {
      await processOrderPaid({
        supabase,
        orderData: {
          id: orderData.id,
          amount: orderData.amount,
          payment_method: orderData.payment_method,
          product_id: orderData.product_id,
          customer_id: orderData.customer_id,
          user_id: orderData.user_id,
          metadata: orderData.metadata as Record<string, unknown> | null,
        },
        externalId,
        source: 'stripe-webhook',
        currency: productCurrency,
      });
    }
    if ((status === 'refunded' || status === 'chargedback') && orderData) {
      await processOrderRevoked({
        supabase,
        orderData: {
          id: orderData.id,
          product_id: orderData.product_id,
          customer_id: orderData.customer_id,
          user_id: orderData.user_id,
        },
        source: 'stripe-webhook',
        reason: status === 'chargedback' ? 'chargedback' : 'refunded',
      });
    }

    return new Response(JSON.stringify({ received: true, status }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[stripe-webhook] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
