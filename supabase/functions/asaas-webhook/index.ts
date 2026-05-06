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

    // --- Webhook signature verification (MANDATORY) ---
    const ASAAS_WEBHOOK_TOKEN = Deno.env.get('ASAAS_WEBHOOK_TOKEN')?.trim();
    if (!ASAAS_WEBHOOK_TOKEN) {
      console.error('[asaas-webhook] ASAAS_WEBHOOK_TOKEN not configured — rejecting request');
      return new Response(JSON.stringify({ error: 'Webhook verification not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const receivedToken = (
      req.headers.get('asaas-access-token') ||
      req.headers.get('access_token') ||
      ''
    ).trim();

    if (!receivedToken || receivedToken !== ASAAS_WEBHOOK_TOKEN) {
      console.error('[asaas-webhook] Invalid webhook token', {
        has_token: Boolean(receivedToken),
        token_length: receivedToken.length,
      });
      return new Response(JSON.stringify({ error: 'Invalid webhook token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;
    const payment = payload.payment;

    console.log('[asaas-webhook] event:', event, 'payment:', payment?.id);

    if (!payment?.id) {
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // --- Idempotency: deduplicate webhook events ---
    const isConfirmEvent = event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED';
    const dedupKey = isConfirmEvent
      ? `asaas_${payment.id}_paid`
      : `asaas_${payment.id}_${event}`;
    const { data: inserted, error: dedupErr } = await supabase
      .from('webhook_events')
      .upsert({ id: dedupKey, gateway: 'asaas' }, { onConflict: 'id', ignoreDuplicates: true })
      .select('id')
      .maybeSingle();

    if (!inserted && !dedupErr) {
      console.log('[asaas-webhook] Duplicate event, skipping:', dedupKey);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============================================================
    // CRITICAL: Only PAYMENT_CONFIRMED and PAYMENT_RECEIVED mean actual settlement.
    // Events like PAYMENT_AUTHORIZED, PAYMENT_APPROVED_BY_RISK_ANALYSIS, PAYMENT_CREATED
    // are pre-settlement and must NEVER trigger paid status or access liberation.
    // ============================================================
    let status = 'pending';
    if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
      const gatewayStatus = payment.status?.toUpperCase?.() || '';
      if (gatewayStatus && !['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(gatewayStatus)) {
        console.warn(`[asaas-webhook] ⚠️ Event ${event} received but payment.status is "${payment.status}" — NOT confirming as paid. Keeping pending.`);
        status = 'pending';
      } else {
        status = 'paid';
      }
    } else if (event === 'PAYMENT_OVERDUE') {
      status = 'overdue';
    } else if (event === 'PAYMENT_REFUNDED') {
      status = 'refunded';
    } else if (event === 'PAYMENT_CHARGEBACK_REQUESTED' || event === 'PAYMENT_CHARGEBACK_DISPUTE') {
      status = 'chargedback';
    } else if (event === 'PAYMENT_DELETED' || event === 'PAYMENT_RESTORED') {
      status = event === 'PAYMENT_DELETED' ? 'cancelled' : 'pending';
    } else if (event === 'PAYMENT_AUTHORIZED' || event === 'PAYMENT_APPROVED_BY_RISK_ANALYSIS' || event === 'PAYMENT_CREATED') {
      console.log(`[asaas-webhook] ℹ️ Pre-settlement event "${event}" — order stays pending. No access will be granted.`);
      status = 'pending';
    }

    // --- Status transition guard ---
    const statusPriority: Record<string, number> = {
      pending: 1, overdue: 2, paid: 3, refunded: 4, cancelled: 4, chargedback: 5,
    };


    let { data: orderData, error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('external_id', payment.id)
      .not('status', 'in', `(${['paid', 'refunded', 'chargedback'].filter(s => statusPriority[s] >= statusPriority[status]).join(',')})`)
      .select('id, amount, payment_method, product_id, customer_id, user_id, metadata')
      .maybeSingle();

    // Fallback: try subscription ID
    if (!orderData && !error && payment.subscription) {
      console.log('[asaas-webhook] No order found by payment.id, trying subscription:', payment.subscription);
      const subResult = await supabase
        .from('orders')
        .update({ status, external_id: payment.id, updated_at: new Date().toISOString() })
        .eq('external_id', payment.subscription)
        .not('status', 'in', `(${['paid', 'refunded'].filter(s => statusPriority[s] >= statusPriority[status]).join(',')})`)
        .select('id, amount, payment_method, product_id, customer_id, user_id, metadata')
        .maybeSingle();
      orderData = subResult.data;
      error = subResult.error;
    }

    if (error) {
      console.error('[asaas-webhook] Error updating order:', error);
    }

    // Fire user webhooks (non-blocking) — dispatch BOTH modern and legacy event names
    if (orderData?.id && orderData?.user_id) {
      const eventPairs: string[][] = [];
      if (status === 'paid') eventPairs.push(['payment.approved', 'order.paid']);
      else if (status === 'cancelled') eventPairs.push(['payment.failed', 'order.cancelled']);

      // Detect subscription events
      if (isConfirmEvent && orderData.product_id) {
        const { data: subProduct } = await supabase
          .from('products')
          .select('is_subscription')
          .eq('id', orderData.product_id)
          .maybeSingle();
        if (subProduct?.is_subscription) {
          eventPairs.push(['subscription.created']);
        }
      }

      for (const events of eventPairs) {
        for (const evt of events) {
          fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/fire-webhooks`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({ event: evt, order_id: orderData.id, user_id: orderData.user_id }),
          }).catch(err => console.error('[asaas-webhook] fire-webhooks error:', err));
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // On confirmed payment → delegate ALL side effects to shared processor
    // ═══════════════════════════════════════════════════════════════════════
    if (isConfirmEvent && status === 'paid' && orderData?.product_id && orderData?.customer_id) {
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
        externalId: payment.id,
        source: 'asaas-webhook',
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
        source: 'asaas-webhook',
        reason: status === 'chargedback' ? 'chargedback' : 'refunded',
      });
    }

    // --- Billing recharge confirmation (Asaas) ---
    // This is gateway-specific and stays in the webhook handler
    if (
      isConfirmEvent &&
      typeof payment.externalReference === 'string' &&
      payment.externalReference.startsWith('recharge_')
    ) {
      try {
        const { data: recharge } = await supabase
          .from('billing_recharges')
          .update({
            status: 'confirmed',
            confirmed_at: new Date().toISOString(),
          })
          .eq('external_id', payment.id)
          .eq('status', 'pending')
          .select('id, user_id, amount')
          .maybeSingle();

        if (recharge) {
          await supabase.rpc('add_billing_credit', {
            p_user_id: recharge.user_id,
            p_amount: recharge.amount,
            p_description: `Recarga confirmada — R$${Number(recharge.amount).toFixed(2).replace('.', ',')}`,
          });
          console.log(`[asaas-webhook] Recharge confirmed: R$${recharge.amount} for user ${recharge.user_id}`);
        } else {
          console.log('[asaas-webhook] Recharge already confirmed or not found, skipping credit');
        }
      } catch (rechargeErr) {
        console.error('[asaas-webhook] Recharge error (non-blocking):', rechargeErr);
      }
    }

    return new Response(JSON.stringify({ received: true, status }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[asaas-webhook] Webhook error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
