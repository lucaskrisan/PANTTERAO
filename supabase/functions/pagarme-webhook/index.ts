import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { processOrderPaid } from '../_shared/process-order-paid.ts';
import { processOrderRevoked } from '../_shared/process-order-revoked.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();

    // Webhook signature verification — verify only when both secret and signature are present.
    // Never block when signature is absent — Pagar.me may not send it depending on configuration.
    const PAGARME_WEBHOOK_SECRET = Deno.env.get('PAGARME_WEBHOOK_SECRET');
    const receivedSig = req.headers.get('x-hub-signature');

    if (receivedSig && PAGARME_WEBHOOK_SECRET) {
      const expectedPrefix = 'sha1=';
      const sigHex = receivedSig.startsWith(expectedPrefix) ? receivedSig.slice(expectedPrefix.length) : receivedSig;

      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(PAGARME_WEBHOOK_SECRET),
        { name: 'HMAC', hash: 'SHA-1' },
        false,
        ['sign']
      );
      const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
      const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');

      if (computed !== sigHex) {
        console.error('[pagarme-webhook] Invalid webhook signature');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.log('[pagarme-webhook] Signature verified ✅');
    } else {
      console.log('[pagarme-webhook] Accepting webhook (no signature verification)');
    }

    const payload = JSON.parse(rawBody);
    console.log('[pagarme-webhook] received event type:', payload.type);

    const eventType = payload.type;
    const order = payload.data;

    if (!order?.id) {
      console.log('[pagarme-webhook] No order id in payload, skipping');
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // --- Idempotency: deduplicate webhook events ---
    const dedupKey = `pagarme_${order.id}_${eventType}`;
    const { data: inserted } = await supabase
      .from('webhook_events')
      .upsert({ id: dedupKey, gateway: 'pagarme' }, { onConflict: 'id', ignoreDuplicates: true })
      .select('id')
      .maybeSingle();

    if (!inserted) {
      console.log('[pagarme-webhook] Duplicate event, skipping:', dedupKey);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let status = 'pending';
    if (eventType === 'order.paid') {
      status = 'paid';
    } else if (eventType === 'order.payment_failed') {
      status = 'failed';
    } else if (eventType === 'order.canceled') {
      status = 'cancelled';
    } else if (eventType === 'charge.paid') {
      status = 'paid';
    } else if (eventType === 'charge.refunded') {
      status = 'refunded';
    } else if (eventType === 'charge.under_dispute') {
      status = 'chargedback';
    }

    // --- Status transition guard ---
    const externalId = order.id;
    const { data: orderData, error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('external_id', externalId)
      .not('status', 'in', `(${['paid', 'refunded', 'chargedback'].filter(s => {
        const p: Record<string, number> = { pending: 1, failed: 2, paid: 3, refunded: 4, cancelled: 4, chargedback: 5 };
        return (p[s] || 0) >= (p[status] || 0);
      }).join(',')})`)
      .select('id, amount, payment_method, product_id, customer_id, user_id, metadata')
      .maybeSingle();

    if (error) {
      console.error('[pagarme-webhook] Error updating order:', error);
    }

    console.log('[pagarme-webhook] Order updated:', { externalId, status, found: !!orderData });

    // Fire user webhooks (non-blocking) — dispatch BOTH modern and legacy event names
    if (orderData?.id && orderData?.user_id) {
      const eventPairs: string[][] = [];
      if (status === 'paid') eventPairs.push(['payment.approved', 'order.paid']);
      else if (status === 'cancelled') eventPairs.push(['payment.failed', 'order.cancelled']);
      else if (status === 'failed') eventPairs.push(['payment.failed']);

      for (const events of eventPairs) {
        for (const evt of events) {
          fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/fire-webhooks`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({ event: evt, order_id: orderData.id, user_id: orderData.user_id }),
          }).catch(err => console.error('[pagarme-webhook] fire-webhooks error:', err));
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // On confirmed payment → delegate ALL side effects to shared processor
    // ═══════════════════════════════════════════════════════════════════════
    if (status === 'paid' && orderData?.product_id && orderData?.customer_id) {
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
        source: 'pagarme-webhook',
        currency: 'BRL',
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
        source: 'pagarme-webhook',
        reason: status === 'chargedback' ? 'chargedback' : 'refunded',
      });
    }

    // --- Billing recharge confirmation (Pagar.me PIX) ---
    // This is gateway-specific and stays in the webhook handler
    if ((eventType === 'order.paid' || eventType === 'charge.paid') && status === 'paid') {
      try {
        const { data: recharge } = await supabase
          .from('billing_recharges')
          .update({
            status: 'confirmed',
            confirmed_at: new Date().toISOString(),
          })
          .eq('external_id', externalId)
          .eq('status', 'pending')
          .select('id, user_id, amount')
          .maybeSingle();
        if (recharge) {
          await supabase.rpc('add_billing_credit', {
            p_user_id: recharge.user_id,
            p_amount: recharge.amount,
            p_description: `Recarga via PIX (Pagar.me) — R$${Number(recharge.amount).toFixed(2).replace('.', ',')}`,
          });
          console.log(`[pagarme-webhook] Recharge confirmed: R$${recharge.amount} for user ${recharge.user_id}`);
        } else {
          console.log('[pagarme-webhook] Recharge already confirmed or not found, skipping credit');
        }
      } catch (rechargeErr) {
        console.error('[pagarme-webhook] Recharge error (non-blocking):', rechargeErr);
      }
    }

    return new Response(JSON.stringify({ received: true, status }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[pagarme-webhook] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
