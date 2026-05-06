import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function sendPushNotification(title: string, message: string, targetUserId?: string, url?: string) {
  const appId = Deno.env.get('ONESIGNAL_APP_ID');
  const apiKey = Deno.env.get('ONESIGNAL_REST_API_KEY');
  if (!appId || !apiKey) return;
  try {
    const payload: Record<string, unknown> = {
      app_id: appId,
      target_channel: 'push',
      headings: { en: title },
      contents: { en: message },
      chrome_web_icon: 'https://app.panttera.com.br/pwa-192x192.png',
    };
    if (targetUserId) {
      payload.filters = [{ field: 'tag', key: 'user_id', relation: '=', value: targetUserId }];
    } else {
      payload.included_segments = ['Total Subscriptions'];
    }
    if (url) payload.url = url;
    await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: { 'Authorization': `Key ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('[create-pagarme-card-payment] OneSignal error:', err);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Rate Limiting ---
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('cf-connecting-ip') || 'unknown';

    let PAGARME_API_KEY: string | null = null;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: rlData } = await supabaseAdmin.rpc('check_rate_limit', {
      p_identifier: clientIp,
      p_action: 'create-pagarme-card-payment',
      p_max_hits: 5,
      p_window_seconds: 300,
    });

    if (rlData === true) {
      console.warn(`[create-pagarme-card-payment] Rate limited IP: ${clientIp}`);
      return new Response(
        JSON.stringify({ error: 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const body = await req.json();
    if (body?.health_check === true) {
      return new Response(JSON.stringify({ ok: true, health_check: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const {
      customer, product_id, installments, is_subscription, billing_cycle,
      coupon_id, config_id, bump_product_ids, checkout_url, utms,
      ds_transaction_id,
    } = body;
    const amount = Math.round(Number(body.amount) * 100) / 100;

    if (Array.isArray(bump_product_ids) && bump_product_ids.length > 50) {
      return new Response(
        JSON.stringify({ error: 'Too many bump products (max 50)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!amount || !customer?.name || !customer?.email || !customer?.cpf) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: nome, email, CPF e valor.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate card data
    const card = customer.creditCard;
    if (!card?.number || !card?.holderName || !card?.expMonth || !card?.expYear || !card?.cvv) {
      return new Response(
        JSON.stringify({ error: 'Preencha todos os dados do cartão.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Email validation
    const emailStr = String(customer.email).trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(emailStr)) {
      return new Response(
        JSON.stringify({ error: 'E-mail inválido. Verifique o endereço digitado.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    customer.email = emailStr;

    const cleanCpf = customer.cpf.replace(/\D/g, '');
    const cleanPhone = customer.phone?.replace(/\D/g, '') || '';
    const postalCode = customer.postalCode?.replace(/\D/g, '') || '00000000';

    // Get product info and validate price server-side
    let productOwnerId: string | null = null;
    let productName = 'Produto';
    let serverPrice = amount;
    if (product_id) {
      const { data: prod } = await supabaseAdmin
        .from('products')
        .select('name, user_id, price, show_coupon')
        .eq('id', product_id)
        .maybeSingle();
      if (prod) {
        productName = prod.name;
        productOwnerId = prod.user_id;
        serverPrice = prod.price;

        if (config_id) {
          const { data: config } = await supabaseAdmin
            .from('checkout_builder_configs')
            .select('price')
            .eq('id', config_id)
            .eq('product_id', product_id)
            .maybeSingle();
          if (config?.price != null && config.price > 0) {
            serverPrice = config.price;
          }
        }

        // Apply coupon
        let couponDiscount = 0;
        if (coupon_id && prod.show_coupon !== false) {
          const { data: couponData } = await supabaseAdmin
            .from('coupons')
            .select('discount_type, discount_value, active, max_uses, used_count')
            .eq('id', coupon_id)
            .eq('active', true)
            .maybeSingle();
          if (couponData) {
            if (couponData.max_uses != null && couponData.used_count >= couponData.max_uses) {
              return new Response(
                JSON.stringify({ error: 'Cupom atingiu o limite de usos.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
            couponDiscount = couponData.discount_type === 'percent'
              ? serverPrice * (couponData.discount_value / 100)
              : couponData.discount_value;
          }
        }

        // Bump total
        let bumpTotal = 0;
        if (bump_product_ids && Array.isArray(bump_product_ids) && bump_product_ids.length > 0) {
          const { data: bumpProducts } = await supabaseAdmin
            .from('products')
            .select('price')
            .in('id', bump_product_ids)
            .eq('active', true);
          if (bumpProducts) {
            bumpTotal = bumpProducts.reduce((sum: number, bp: any) => sum + Number(bp.price), 0);
          }
        }

        const validatedAmount = Math.round((Math.max(serverPrice - couponDiscount, 0) + bumpTotal) * 100) / 100;
        if (Math.abs(amount - validatedAmount) > 0.02) {
          console.warn(`[create-pagarme-card-payment] Price mismatch: client=${amount}, server=${validatedAmount}`);
          return new Response(
            JSON.stringify({ error: 'Valor inválido. Recarregue a página e tente novamente.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Anti-fraud: blacklist
    {
      const checks = [];
      if (customer.email) checks.push(supabaseAdmin.from('fraud_blacklist').select('id').eq('type', 'email').eq('value', customer.email.toLowerCase()).maybeSingle());
      if (cleanCpf) checks.push(supabaseAdmin.from('fraud_blacklist').select('id').eq('type', 'cpf').eq('value', cleanCpf).maybeSingle());
      const results = await Promise.all(checks);
      if (results.some(r => r.data)) {
        return new Response(
          JSON.stringify({ error: 'Não foi possível processar este pagamento. Entre em contato com o suporte.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Anti-fraud: duplicate purchase
    if (product_id && customer.email) {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: recentOrder } = await supabaseAdmin
        .from('orders')
        .select('id, status, customer_id')
        .eq('product_id', product_id)
        .in('status', ['pending', 'paid', 'approved'])
        .gte('created_at', fiveMinAgo)
        .limit(1);
      if (recentOrder && recentOrder.length > 0) {
        const { data: recentCustomer } = await supabaseAdmin
          .from('customers')
          .select('email')
          .eq('id', recentOrder[0].customer_id)
          .maybeSingle();
        if (recentCustomer?.email?.toLowerCase() === customer.email.toLowerCase()) {
          return new Response(
            JSON.stringify({ error: 'Compra já em processamento. Aguarde alguns minutos.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Check producer blocked
    if (productOwnerId) {
      const { data: billingAccount } = await supabaseAdmin
        .from('billing_accounts')
        .select('blocked')
        .eq('user_id', productOwnerId)
        .maybeSingle();
      if (billingAccount?.blocked) {
        return new Response(
          JSON.stringify({ error: 'Checkout temporariamente indisponível.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Resolve Pagar.me API key
    if (productOwnerId) {
      const { data: gw } = await supabaseAdmin
        .from('payment_gateways')
        .select('config')
        .eq('user_id', productOwnerId)
        .eq('provider', 'pagarme')
        .eq('active', true)
        .maybeSingle();
      if (gw?.config && typeof gw.config === 'object' && (gw.config as any).api_key) {
        PAGARME_API_KEY = (gw.config as any).api_key;
      }
    }
    // Fallback to global env key ONLY for super_admin producers
    if (!PAGARME_API_KEY && productOwnerId) {
      const { data: ownerRoles } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', productOwnerId)
        .eq('role', 'super_admin')
        .maybeSingle();
      if (ownerRoles) {
        PAGARME_API_KEY = Deno.env.get('PAGARME_API_KEY') || null;
      }
    }
    if (!PAGARME_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Gateway não configurado. Configure o Pagar.me.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upsert customer in our DB
    const { data: existingCustomer } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('email', customer.email)
      .maybeSingle();

    let customerId: string;
    if (existingCustomer) {
      customerId = existingCustomer.id;
      await supabaseAdmin
        .from('customers')
        .update({ name: customer.name, phone: customer.phone, cpf: cleanCpf })
        .eq('id', customerId);
    } else {
      const { data: newCustomer } = await supabaseAdmin
        .from('customers')
        .insert({ name: customer.name, email: customer.email, phone: customer.phone, cpf: cleanCpf, user_id: productOwnerId })
        .select('id')
        .single();
      customerId = newCustomer!.id;
    }

    // Build Pagar.me credit card payment
    const installmentCount = parseInt(installments) || 1;
    const amountCents = Math.round(amount * 100);

    const creditCardPayment: any = {
      card: {
        number: card.number.replace(/\s/g, ''),
        holder_name: card.holderName,
        exp_month: parseInt(card.expMonth),
        exp_year: parseInt(card.expYear),
        cvv: card.cvv,
        billing_address: {
          country: 'BR',
          state: 'SP',
          city: 'São Paulo',
          zip_code: postalCode,
          line_1: '1, Rua Principal, Centro',
          line_2: '',
        },
      },
      installments: installmentCount,
    };

    const paymentObj: any = {
      payment_method: 'credit_card',
      credit_card: creditCardPayment,
      amount: amountCents,
    };

    // Add 3DS authentication if available
    if (ds_transaction_id) {
      paymentObj.authentication = {
        type: 'threed_secure',
        threed_secure: {
          ds_transaction_id,
        },
      };
    }

    const orderPayload: any = {
      items: [{
        amount: amountCents,
        description: productName,
        quantity: 1,
        code: product_id || 'card-payment',
      }],
      customer: {
        name: customer.name,
        email: customer.email,
        document: cleanCpf,
        document_type: 'CPF',
        type: 'individual',
        phones: cleanPhone ? {
          mobile_phone: {
            country_code: '55',
            area_code: cleanPhone.slice(0, 2),
            number: cleanPhone.slice(2),
          },
        } : undefined,
      },
      payments: [paymentObj],
    };

    console.log('[create-pagarme-card-payment] Creating order...');

    const response = await fetch('https://api.pagar.me/core/v5/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${btoa(PAGARME_API_KEY + ':')}`,
      },
      body: JSON.stringify(orderPayload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[create-pagarme-card-payment] Pagar.me error:', JSON.stringify(data));
      const gatewayMsg = data?.errors?.[0]?.message || data?.message || '';
      let userMessage = 'Pagamento recusado. Verifique os dados do cartão.';
      if (/cpf|document/i.test(gatewayMsg)) userMessage = 'CPF inválido. Verifique o número.';
      else if (/card|cartão|number/i.test(gatewayMsg)) userMessage = 'Dados do cartão inválidos. Verifique e tente novamente.';
      else if (/insufficient|saldo/i.test(gatewayMsg)) userMessage = 'Saldo insuficiente. Tente outro cartão.';
      return new Response(
        JSON.stringify({ error: userMessage }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if order failed
    if (data.status === 'failed') {
      console.error('[create-pagarme-card-payment] Order failed:', JSON.stringify(data));
      const rawReason = data.charges?.[0]?.last_transaction?.gateway_response?.errors?.[0]?.message
        || data.charges?.[0]?.last_transaction?.acquirer_message || '';
      let userMessage = 'Pagamento recusado. Verifique os dados do cartão e tente novamente.';
      if (/fraud|antifraude/i.test(rawReason)) userMessage = 'Pagamento não autorizado. Tente outro cartão.';
      else if (/insufficient|saldo/i.test(rawReason)) userMessage = 'Saldo insuficiente.';
      else if (/expired|vencido/i.test(rawReason)) userMessage = 'Cartão expirado. Use outro cartão.';
      else if (/refused|recusad|denied|negad/i.test(rawReason)) userMessage = 'Pagamento recusado pelo emissor. Tente outro cartão.';
      return new Response(
        JSON.stringify({ error: userMessage }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Map status
    const statusMap: Record<string, string> = {
      paid: 'approved',
      pending: 'pending',
      failed: 'failed',
      canceled: 'refunded',
    };
    const orderStatus = statusMap[data.status] || 'pending';

    // Platform fee
    const { data: platformSettings } = await supabaseAdmin
      .from('platform_settings')
      .select('platform_fee_percent')
      .limit(1)
      .maybeSingle();
    const feePercent = Number(platformSettings?.platform_fee_percent || 0);
    const feeAmount = Math.round(amount * feePercent) / 100;

    // Save order
    const { data: orderRecord, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        amount,
        payment_method: 'credit_card',
        status: orderStatus,
        product_id: product_id || null,
        customer_id: customerId,
        user_id: productOwnerId,
        external_id: data.id,
        platform_fee_percent: feePercent,
        platform_fee_amount: feeAmount,
        metadata: {
          gateway: 'pagarme',
          coupon_id: coupon_id || null,
          installments: String(installmentCount),
          checkout_url: checkout_url || null,
          bump_product_ids: (bump_product_ids && bump_product_ids.length > 0) ? bump_product_ids : null,
          has_3ds: !!ds_transaction_id,
          ...(utms || {}),
        },
      })
      .select('id')
      .single();

    if (orderError) {
      console.error('[create-pagarme-card-payment] Order save error:', orderError);
    } else {
      console.log('[create-pagarme-card-payment] Order saved:', orderRecord.id);
    }

    // Increment coupon usage atomically
    if (coupon_id) {
      await supabaseAdmin.rpc('increment_coupon_usage', { p_coupon_id: coupon_id });
    }

    // Push notification is handled by the webhook (pagarme-webhook) to avoid duplicates

    return new Response(
      JSON.stringify({
        payment_id: data.id,
        status: data.status,
        order_id: orderRecord?.id || null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[create-pagarme-card-payment] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao processar pagamento. Tente novamente.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
