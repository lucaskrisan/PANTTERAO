import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { processOrderPaid } from '../_shared/process-order-paid.ts';
import { processOrderRevoked } from '../_shared/process-order-revoked.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// deno-lint-ignore no-explicit-any
async function resolvePagarmeApiKey(supabase: any, userId: string | null) {
  if (!userId) {
    return Deno.env.get('PAGARME_API_KEY') || null;
  }

  const { data: gateway } = await supabase
    .from('payment_gateways')
    .select('config')
    .eq('user_id', userId)
    .eq('provider', 'pagarme')
    .eq('active', true)
    .maybeSingle();

  if (gateway?.config && typeof gateway.config === 'object' && 'api_key' in gateway.config) {
    const apiKey = (gateway.config as any).api_key;
    if (typeof apiKey === 'string' && apiKey.length > 0) {
      return apiKey;
    }
  }

  const { data: ownerRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'super_admin')
    .maybeSingle();

  if (ownerRole) {
    return Deno.env.get('PAGARME_API_KEY') || null;
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let requestBody: Record<string, unknown> = {};
    if (req.method === 'POST') {
      try {
        const parsedBody = await req.json();
        if (parsedBody && typeof parsedBody === 'object') {
          requestBody = parsedBody as Record<string, unknown>;
        }
      } catch {
        // Ignore invalid/empty body and keep defaults
      }
    }

    // Auth: verify caller is authenticated (admin user, service-role, or registered cron caller)
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Allow service-role key (used by cron jobs) to bypass user check
    const isServiceRole = token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const requestSource = typeof requestBody.source === 'string' ? requestBody.source : '';
    const isCronRequest = token.length > 100 && ['cron', 'pg_cron'].includes(requestSource);
    
    if (!isServiceRole && !isCronRequest) {
      const supabaseUser = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user: authUser }, error: authError } = await supabaseUser.auth.getUser();
      if (authError || !authUser) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Get all pending orders with external_id (Pagar.me orders)
    // Default window: 30 days; can be overridden with body.hours_back (max 90 days)
    let hoursBack = 24 * 30;
    const inputHours = Number(requestBody.hours_back);
    if (Number.isFinite(inputHours) && inputHours > 0 && inputHours <= 24 * 90) {
      hoursBack = inputHours;
    }

    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
    // Only fetch Pagar.me orders. Stripe (pi_*) and other providers are reconciled
    // by their own webhooks / mark-stripe-order-failed. Querying Pagar.me with a
    // Stripe payment_intent id always returns 404 and pollutes the logs.
    const { data: pendingOrders, error: fetchErr } = await supabase
      .from('orders')
      .select('id, external_id, amount, product_id, customer_id, user_id, metadata, payment_method')
      .in('status', ['pending', 'paid'])
      .gte('created_at', since)
      .not('external_id', 'is', null);

    if (fetchErr) {
      console.error('[reconcile] Error fetching pending orders:', fetchErr);
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!pendingOrders || pendingOrders.length === 0) {
      return new Response(JSON.stringify({ reconciled: 0, window_hours: hoursBack, message: 'No pending orders to reconcile' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[reconcile] Checking ${pendingOrders.length} pending orders against Pagar.me`);

    const results: { order_id: string; external_id: string; pagarme_status: string; action: string; customer?: string }[] = [];

    for (const order of pendingOrders) {
      if (!order.external_id) continue;

      try {
        const pagarmeApiKey = await resolvePagarmeApiKey(supabase, order.user_id);
        if (!pagarmeApiKey) {
          console.warn(`[reconcile] No Pagar.me API key found for user ${order.user_id} (order ${order.id})`);
          results.push({ order_id: order.id, external_id: order.external_id, pagarme_status: 'missing_gateway', action: 'skipped' });
          continue;
        }

        // Query Pagar.me API for order status
        const pagarmeRes = await fetch(`https://api.pagar.me/core/v5/orders/${order.external_id}`, {
          headers: {
            'Authorization': `Basic ${btoa(pagarmeApiKey + ':')}`,
            'Content-Type': 'application/json',
          },
        });

        if (!pagarmeRes.ok) {
          console.log(`[reconcile] Pagar.me API error for ${order.external_id}: ${pagarmeRes.status}`);
          results.push({ order_id: order.id, external_id: order.external_id, pagarme_status: 'api_error', action: 'skipped' });
          continue;
        }

        const pagarmeOrder = await pagarmeRes.json();
        const pagarmeStatus = pagarmeOrder.status;

        console.log(`[reconcile] ${order.external_id}: Pagar.me=${pagarmeStatus}, PanteraPay=${order.status}`);

        // Get customer name for logging
        let customerName = '';
        if (order.customer_id) {
          const { data: cust } = await supabase
            .from('customers')
            .select('name')
            .eq('id', order.customer_id)
            .single();
          if (cust) customerName = cust.name;
        }

        if (pagarmeStatus === 'paid' && order.status === 'pending') {
          // This order was paid but webhook missed it - update!
          const { error: updateErr } = await supabase
            .from('orders')
            .update({ status: 'paid', updated_at: new Date().toISOString() })
            .eq('id', order.id);


          if (updateErr) {
            console.error(`[reconcile] Failed to update ${order.id}:`, updateErr);
            results.push({ order_id: order.id, external_id: order.external_id, pagarme_status: 'paid', action: 'update_failed', customer: customerName });
          } else {
            console.log(`[reconcile] ✅ Updated ${order.id} to PAID (${customerName})`);
            results.push({ order_id: order.id, external_id: order.external_id, pagarme_status: 'paid', action: 'updated_to_paid', customer: customerName });

            // ═══════════════════════════════════════════════════════════════
            // CRITICAL: Delegate ALL side effects to shared processor
            // (member access, emails, CAPI, push, WhatsApp)
            // ═══════════════════════════════════════════════════════════════
            try {
              await processOrderPaid({
                supabase,
                orderData: {
                  id: order.id,
                  amount: order.amount,
                  payment_method: order.payment_method,
                  product_id: order.product_id,
                  customer_id: order.customer_id,
                  user_id: order.user_id,
                  metadata: order.metadata as Record<string, unknown> | null,
                },
                externalId: order.external_id,
                source: 'reconcile-orders',
                currency: 'BRL',
              });
            } catch (popErr) {
              console.error(`[reconcile] processOrderPaid error for ${order.id}:`, popErr);
            }

            // Fire user webhooks (non-blocking)
            try {
              await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/fire-webhooks`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                },
                body: JSON.stringify({ event: 'payment.approved', order_id: order.id, user_id: order.user_id }),
              });
            } catch (whErr) {
              console.error('[reconcile] Webhook fire error:', whErr);
            }
          }
        } else if (pagarmeStatus === 'refunded' || pagarmeStatus === 'under_dispute' || pagarmeStatus === 'dispute_succeeded') {
          const newStatus = pagarmeStatus === 'refunded' ? 'refunded' : 'chargedback';
          if (order.status !== newStatus) {
            await supabase
              .from('orders')
              .update({ status: newStatus, updated_at: new Date().toISOString() })
              .eq('id', order.id);
            
            await processOrderRevoked({
              supabase,
              orderData: {
                id: order.id,
                product_id: order.product_id,
                customer_id: order.customer_id,
                user_id: order.user_id,
              },
              source: 'reconcile-orders',
              reason: newStatus === 'chargedback' ? 'chargedback' : 'refunded',
            });
            results.push({ order_id: order.id, external_id: order.external_id, pagarme_status: pagarmeStatus, action: `updated_to_${newStatus}`, customer: customerName });
          }
        } else if ((pagarmeStatus === 'canceled' || pagarmeStatus === 'failed') && order.status === 'pending') {
          // Update to reflect actual status
          const mappedStatus = pagarmeStatus === 'canceled' ? 'cancelled' : 'failed';
          await supabase
            .from('orders')
            .update({ status: mappedStatus, updated_at: new Date().toISOString() })
            .eq('id', order.id);
          results.push({ order_id: order.id, external_id: order.external_id, pagarme_status: pagarmeStatus, action: `updated_to_${mappedStatus}`, customer: customerName });
        } else {

          results.push({ order_id: order.id, external_id: order.external_id, pagarme_status: pagarmeStatus, action: 'no_change', customer: customerName });
        }

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 200));
      } catch (apiErr) {
        console.error(`[reconcile] Error checking ${order.external_id}:`, apiErr);
        results.push({ order_id: order.id, external_id: order.external_id, pagarme_status: 'error', action: 'error' });
      }
    }

    const reconciled = results.filter(r => r.action === 'updated_to_paid').length;
    console.log(`[reconcile] Done. Reconciled: ${reconciled}/${pendingOrders.length}`);

    const responsePayload = isCronRequest
      ? { window_hours: hoursBack, total_checked: pendingOrders.length, reconciled }
      : { 
      window_hours: hoursBack,
      total_checked: pendingOrders.length, 
      reconciled, 
      results 
    };

    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[reconcile] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
