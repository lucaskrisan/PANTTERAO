/**
 * Shared post-revocation processor.
 * Centralizes side effects when an order is refunded or charged back:
 *   1. Revoke member access
 *   2. Notify producer/customer (optional)
 */

interface OrderData {
  id: string;
  product_id: string | null;
  customer_id: string | null;
  user_id: string | null;
}

interface ProcessOrderRevokedParams {
  supabase: any;
  orderData: OrderData;
  source: string;        // 'pagarme-webhook' | 'asaas-webhook' | 'stripe-webhook' | 'reconcile-orders'
  reason: 'refunded' | 'chargedback';
}

export async function processOrderRevoked(params: ProcessOrderRevokedParams): Promise<void> {
  const { supabase, orderData, source, reason } = params;
  if (!orderData.customer_id) return;

  console.log(`[${source}] Processing order revocation (${reason}) for order:`, orderData.id);

  try {
    // 1. Revoke member access
    // We remove all access entries linked to this specific order
    const { error: revokeErr, count } = await supabase
      .from('member_access')
      .delete()
      .eq('order_id', orderData.id);

    if (revokeErr) {
      console.error(`[${source}] Error revoking member access:`, revokeErr);
    } else {
      console.log(`[${source}] Revoked ${count || 0} access entries for order:`, orderData.id);
    }

    // 2. Fire webhooks
    if (orderData.user_id) {
      const event = reason === 'chargedback' ? 'payment.disputed' : 'payment.refunded';
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/fire-webhooks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          event,
          order_id: orderData.id,
          user_id: orderData.user_id,
        }),
      }).catch(err => console.error(`[${source}] Fire webhooks error:`, err));
    }

  } catch (err) {
    console.error(`[${source}] processOrderRevoked error:`, err);
  }
}
