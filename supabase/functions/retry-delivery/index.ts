import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { order_id } = await req.json();
    if (!order_id) throw new Error('Missing order_id');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch order data
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, products(delivery_method, user_id)')
      .eq('id', order_id)
      .single();

    if (orderError || !order) throw new Error('Order not found');

    const deliveryMethod = order.products?.delivery_method || 'appsell';
    const userId = order.products?.user_id;

    console.log(`[retry-delivery] Retrying for order ${order_id}, method: ${deliveryMethod}`);

    let result: any = { success: true };

    if (deliveryMethod === 'appsell') {
      // Direct call to appsell-notify
      const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/appsell-notify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          event: 'order.paid',
          order_id: order.id,
          user_id: userId,
        }),
      });
      result = await res.json();
    } else {
      // For Panttera, we might want to re-run the whole process-order-paid logic
      // But for now, let's just trigger a custom event or reuse the shared logic if we had a dedicated function.
      // Since process-order-paid is a shared file, we'd need to invoke it from a function.
      // Let's use asaas-webhook as a proxy or just re-trigger the reconcile-orders for this specific ID.
      
      // Better: Invoke the newly updated shared logic via a tiny wrapper function if it existed.
      // Or just call the reconcile-orders with a filter.
      await supabase.functions.invoke('reconcile-orders', {
        body: { order_id: order.id }
      });
    }

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
