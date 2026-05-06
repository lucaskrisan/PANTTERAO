import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { processOrderPaid } from '../_shared/process-order-paid.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Verify MercadoPago webhook signature.
 */
async function verifyMpSignature(
  signatureHeader: string | null,
  requestId: string | null,
  dataId: string | null,
  secret: string
): Promise<boolean> {
  if (!signatureHeader || !requestId || !dataId) return false;
  const parts = signatureHeader.split(',').reduce<Record<string, string>>((acc, part) => {
    const [k, v] = part.split('=').map((s) => s.trim());
    if (k && v) acc[k] = v;
    return acc;
  }, {});
  const ts = parts['ts'];
  const v1 = parts['v1'];
  if (!ts || !v1) return false;
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest));
  const computed = Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  if (computed.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    console.log('[mp-webhook] Received:', JSON.stringify(body).slice(0, 500));

    const action = body.action || '';
    const topic = body.topic || '';
    const dataId = body.data?.id || body.id;

    const MP_WEBHOOK_SECRET = Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET');
    const sigHeader = req.headers.get('x-signature');
    const reqIdHeader = req.headers.get('x-request-id');

    if (MP_WEBHOOK_SECRET) {
      const valid = await verifyMpSignature(sigHeader, reqIdHeader, dataId ? String(dataId) : null, MP_WEBHOOK_SECRET);
      if (!valid) {
        console.error('[mp-webhook] BLOCKED: invalid signature');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401, headers: corsHeaders });
      }
    }

    if (!action.startsWith('payment.') && topic !== 'payment') {
      return new Response(JSON.stringify({ received: true }), { headers: corsHeaders });
    }

    if (!dataId) return new Response(JSON.stringify({ received: true }), { headers: corsHeaders });

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    
    // Resolve producer token
    let producerToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    const { data: orderLookup } = await supabase.from('orders').select('user_id').eq('external_id', String(dataId)).maybeSingle();
    if (orderLookup?.user_id) {
      const { data: gw } = await supabase.from('payment_gateways').select('config').eq('user_id', orderLookup.user_id).eq('provider', 'mercadopago').eq('active', true).maybeSingle();
      if (gw?.config && (gw.config as any).api_key) producerToken = (gw.config as any).api_key;
    }

    if (!producerToken) return new Response(JSON.stringify({ error: 'No token' }), { status: 500, headers: corsHeaders });

    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
      headers: { 'Authorization': `Bearer ${producerToken}` },
    });
    if (!mpResponse.ok) return new Response(JSON.stringify({ error: 'MP API error' }), { status: 502, headers: corsHeaders });

    const payment = await mpResponse.json();
    const mpStatus = payment.status;
    const paymentId = String(payment.id);
    const orderId = payment.external_reference;

    let status = 'pending';
    if (mpStatus === 'approved') status = 'paid';
    else if (mpStatus === 'rejected') status = 'failed';
    else if (mpStatus === 'cancelled') status = 'cancelled';
    else if (mpStatus === 'refunded') status = 'refunded';

    let orderUpdate;
    if (orderId) {
      orderUpdate = await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', orderId).select('id, amount, payment_method, product_id, customer_id, user_id, metadata').maybeSingle();
    }
    if (!orderUpdate?.data) {
      orderUpdate = await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('external_id', paymentId).select('id, amount, payment_method, product_id, customer_id, user_id, metadata').maybeSingle();
    }

    const { data: orderData } = orderUpdate;
    if (!orderData) return new Response(JSON.stringify({ received: true }), { headers: corsHeaders });

    // Fire legacy webhooks (via shared processor or manual if needed)
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
        externalId: paymentId,
        source: 'mercadopago-webhook',
        currency: 'BRL',
      });
    } else if (orderData.user_id) {
      // For non-paid statuses, still fire webhooks
      const evt = status === 'refunded' ? 'order.refunded' : status === 'cancelled' ? 'order.cancelled' : null;
      if (evt) {
        fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/fire-webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
          body: JSON.stringify({ event: evt, order_id: orderData.id, user_id: orderData.user_id }),
        }).catch(() => {});
      }
    }

    return new Response(JSON.stringify({ received: true, status }), { headers: corsHeaders });
  } catch (error) {
    console.error('[mp-webhook] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: corsHeaders });
  }
});