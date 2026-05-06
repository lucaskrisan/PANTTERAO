import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { order_id, upsell_product_id, customer_email } = await req.json();

    if (!order_id || !upsell_product_id) {
      return new Response(
        JSON.stringify({ error: 'Missing order_id or upsell_product_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- Authentication: JWT or customer_email verification ---
    let callerVerified = false;

    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const supabaseAuth = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await supabaseAuth.auth.getUser();
      if (user) {
        callerVerified = true;
        console.log('[process-upsell] Authenticated via JWT:', user.id);
      }
    }

    // Get original order (need it for both auth check and processing)
    const { data: originalOrder, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('id, customer_id, user_id, product_id, external_id, payment_method, metadata, status')
      .eq('id', order_id)
      .single();

    if (orderErr || !originalOrder) {
      return new Response(
        JSON.stringify({ error: 'Pedido original não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If not JWT-authenticated, verify customer_email matches order's customer
    if (!callerVerified) {
      if (!customer_email) {
        return new Response(
          JSON.stringify({ error: 'Autenticação necessária. Forneça customer_email ou faça login.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: customer } = await supabaseAdmin
        .from('customers')
        .select('email')
        .eq('id', originalOrder.customer_id)
        .single();

      if (!customer || customer.email.toLowerCase() !== customer_email.toLowerCase()) {
        console.warn('[process-upsell] Email mismatch for order:', order_id);
        return new Response(
          JSON.stringify({ error: 'Não autorizado' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      callerVerified = true;
      console.log('[process-upsell] Verified via customer_email:', customer_email);
    }

    // --- Business validation ---
    if (originalOrder.status !== 'paid' && originalOrder.status !== 'approved') {
      return new Response(
        JSON.stringify({ error: 'Pedido original não está aprovado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (originalOrder.payment_method !== 'credit_card') {
      return new Response(
        JSON.stringify({ error: 'Upsell one-click disponível apenas para pagamentos com cartão' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const metadata = originalOrder.metadata as Record<string, any> || {};
    const asaasCustomerId = metadata.asaas_customer_id;
    const creditCardToken = metadata.credit_card_token;

    if (!asaasCustomerId || !creditCardToken) {
      return new Response(
        JSON.stringify({ error: 'Dados do cartão não disponíveis para compra com 1 clique. Por favor, realize uma nova compra.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get upsell product
    const { data: upsellProduct } = await supabaseAdmin
      .from('products')
      .select('id, name, price, user_id')
      .eq('id', upsell_product_id)
      .eq('active', true)
      .single();

    if (!upsellProduct) {
      return new Response(
        JSON.stringify({ error: 'Produto de upsell não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for upsell discount
    const { data: upsellOffer } = await supabaseAdmin
      .from('upsell_offers')
      .select('discount_percent')
      .eq('product_id', originalOrder.product_id)
      .eq('upsell_product_id', upsell_product_id)
      .eq('active', true)
      .maybeSingle();

    const discountPercent = upsellOffer?.discount_percent || 0;
    const originalPrice = upsellProduct.price;
    const finalPrice = Math.round(originalPrice * (1 - discountPercent / 100) * 100) / 100;

    // Resolve Asaas API key from the PRODUCER's gateway config
    let ASAAS_API_KEY: string | null = null;
    let environment = 'sandbox';

    if (originalOrder.user_id) {
      const { data: gw } = await supabaseAdmin
        .from('payment_gateways')
        .select('config, environment')
        .eq('user_id', originalOrder.user_id)
        .eq('provider', 'asaas')
        .eq('active', true)
        .maybeSingle();
      if (gw?.environment) {
        environment = gw.environment;
      }
      if (gw?.config && typeof gw.config === 'object' && (gw.config as any).api_key) {
        ASAAS_API_KEY = (gw.config as any).api_key;
      }
    }

    // Fallback to global env key ONLY for super_admin producers
    if (!ASAAS_API_KEY && originalOrder.user_id) {
      const { data: ownerRoles } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', originalOrder.user_id)
        .eq('role', 'super_admin')
        .maybeSingle();
      if (ownerRoles) {
        ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY') || null;
        environment = Deno.env.get('ASAAS_ENV') || environment;
      }
    }

    if (!ASAAS_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Gateway de pagamento não configurado para este produtor.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const baseUrl = environment === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';

    // Create payment using stored card token
    const paymentPayload = {
      customer: asaasCustomerId,
      billingType: 'CREDIT_CARD',
      value: finalPrice,
      dueDate: new Date().toISOString().split('T')[0],
      description: `Upsell: ${upsellProduct.name}`,
      creditCardToken: creditCardToken,
    };

    console.log('[process-upsell] Creating Asaas payment for upsell:', {
      customer: asaasCustomerId,
      value: finalPrice,
      product: upsellProduct.name,
    });

    const paymentRes = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
      body: JSON.stringify(paymentPayload),
    });

    const paymentData = await paymentRes.json();

    if (!paymentRes.ok) {
      console.error('[process-upsell] Asaas payment error:', JSON.stringify(paymentData));
      return new Response(
        JSON.stringify({ error: 'Falha ao processar pagamento do upsell' }),
        { status: paymentRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const statusMap: Record<string, string> = {
      CONFIRMED: 'approved',
      RECEIVED: 'approved',
      PENDING: 'pending',
    };
    const orderStatus = statusMap[paymentData.status] || 'pending';

    // Platform fee
    const { data: platformSettings } = await supabaseAdmin
      .from('platform_settings')
      .select('platform_fee_percent')
      .limit(1)
      .maybeSingle();
    const feePercent = Number(platformSettings?.platform_fee_percent || 0);
    const feeAmount = Math.round(finalPrice * feePercent) / 100;

    // Save upsell order
    const { data: upsellOrder, error: upsellOrderErr } = await supabaseAdmin
      .from('orders')
      .insert({
        amount: finalPrice,
        payment_method: 'credit_card',
        status: orderStatus,
        product_id: upsellProduct.id,
        customer_id: originalOrder.customer_id,
        user_id: originalOrder.user_id,
        external_id: paymentData.id,
        platform_fee_percent: feePercent,
        platform_fee_amount: feeAmount,
        metadata: {
          gateway: 'asaas',
          upsell: true,
          original_order_id: originalOrder.id,
          asaas_customer_id: asaasCustomerId,
        },
      })
      .select('id')
      .single();

    if (upsellOrderErr) {
      console.error('[process-upsell] Order save error:', upsellOrderErr);
    }

    console.log('[process-upsell] Upsell order created:', {
      orderId: upsellOrder?.id,
      status: orderStatus,
      amount: finalPrice,
    });

    // CAPI Purchase for upsell (non-blocking)
    if (orderStatus === 'approved' && upsellOrder?.id) {
      try {
        const { data: custData } = await supabaseAdmin
          .from('customers')
          .select('name, email, phone, cpf')
          .eq('id', originalOrder.customer_id)
          .single();

        if (custData) {
          await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/facebook-capi`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({
                product_id: upsell_product_id,
                event_name: 'Purchase',
                event_id: String(paymentData.id),
                event_source_url: `https://app.panttera.com.br/checkout/sucesso`,
                customer: {
                  name: custData.name,
                  email: custData.email,
                  phone: custData.phone,
                  cpf: custData.cpf,
                },
                custom_data: {
                  value: finalPrice,
                  currency: 'BRL',
                  content_type: 'product',
                  content_ids: [upsell_product_id],
                  num_items: 1,
                  order_id: upsellOrder.id,
                  payment_method: 'credit_card',
                },
                payment_method: 'credit_card',
                log_browser: false,
              }),
            }
          ).catch(err => console.error('[process-upsell] CAPI error:', err));

          console.log('[process-upsell] CAPI Purchase fired for upsell order', upsellOrder.id);
        }
      } catch (capiErr) {
        console.error('[process-upsell] CAPI fallback error (non-blocking):', capiErr);
      }
    }

    // Fire webhooks (non-blocking)
    if (upsellOrder?.id && originalOrder.user_id && orderStatus === 'approved') {
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/fire-webhooks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ event: 'order.paid', order_id: upsellOrder.id, user_id: originalOrder.user_id }),
      }).catch(err => console.error('[process-upsell] fire-webhooks error:', err));
    }

    return new Response(
      JSON.stringify({
        success: true,
        order_id: upsellOrder?.id,
        payment_id: paymentData.id,
        status: orderStatus,
        amount: finalPrice,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[process-upsell] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao processar upsell' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
