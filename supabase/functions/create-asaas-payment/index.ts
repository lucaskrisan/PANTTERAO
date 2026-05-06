import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sendPushNotification(
  title: string,
  message: string,
  targetUserId?: string,
  url?: string,
  iconUrl?: string,
) {
  const appId = Deno.env.get("ONESIGNAL_APP_ID");
  const apiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");
  if (!appId || !apiKey) return;

  try {
    const payload: Record<string, unknown> = {
      app_id: appId,
      target_channel: "push",
      headings: { en: title },
      contents: { en: message },
      chrome_web_icon: iconUrl || "https://app.panttera.com.br/pwa-192x192.png",
    };
    if (targetUserId) {
      payload.filters = [
        { field: "tag", key: "user_id", relation: "=", value: targetUserId },
      ];
    } else {
      payload.included_segments = ["Total Subscriptions"];
    }
    if (url) payload.url = url;

    await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("[create-asaas-payment] OneSignal error:", err);
  }
}

const BILLING_CYCLE_MAP: Record<string, string> = {
  weekly: "WEEKLY",
  biweekly: "BIWEEKLY",
  monthly: "MONTHLY",
  quarterly: "QUARTERLY",
  semiannually: "SEMIANNUALLY",
  yearly: "YEARLY",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Rate Limiting ---
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: rlData } = await supabaseAdmin.rpc("check_rate_limit", {
      p_identifier: clientIp,
      p_action: "create-asaas-payment",
      p_max_hits: 5,
      p_window_seconds: 300,
    });

    if (rlData === true) {
      console.warn(`[create-asaas-payment] Rate limited IP: ${clientIp}`);
      return new Response(
        JSON.stringify({
          error:
            "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.",
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // API key will be resolved per-producer below
    let ASAAS_API_KEY: string | null = null;

    // supabaseAdmin already created above for rate limiting

    const body = await req.json();
    const {
      amount,
      customer,
      payment_method,
      product_id,
      is_subscription,
      billing_cycle,
      coupon_id,
      config_id,
      bump_product_ids,
      checkout_url,
      utms,
      collaborator_id,
    } = body;
    const installments = Math.min(
      12,
      Math.max(1, Number(body.installments || 1)),
    );

    if (Array.isArray(bump_product_ids) && bump_product_ids.length > 50) {
      return new Response(
        JSON.stringify({ error: "Too many bump products (max 50)" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!amount || !customer?.name || !customer?.email || !customer?.cpf) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: amount, customer (name, email, cpf)",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (payment_method === "credit_card") {
      const holderName = String(customer?.creditCard?.holderName || "").trim();
      if (!holderName) {
        customer.creditCard = {
          ...(customer.creditCard || {}),
          holderName: String(customer.name).trim(),
        };
      }
    }

    // Server-side email validation
    const emailStr = String(customer.email).trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(emailStr)) {
      console.warn(
        `[create-asaas-payment] Invalid email rejected: ${emailStr}`,
      );
      return new Response(
        JSON.stringify({
          error: "E-mail inválido. Verifique o endereço digitado.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    customer.email = emailStr;

    // Get product info and VALIDATE price server-side
    let productOwnerId: string | null = null;
    let productName = "Produto";
    let serverPrice = amount;
    if (product_id) {
      const { data: prod } = await supabaseAdmin
        .from("products")
        .select("name, user_id, price, show_coupon")
        .eq("id", product_id)
        .maybeSingle();
      if (prod) {
        productName = prod.name;
        productOwnerId = prod.user_id;
        serverPrice = prod.price;

        // Check if a config with custom price was used
        if (config_id) {
          const { data: config } = await supabaseAdmin
            .from("checkout_builder_configs")
            .select("price")
            .eq("id", config_id)
            .eq("product_id", product_id)
            .maybeSingle();
          if (config?.price != null && config.price > 0) {
            serverPrice = config.price;
          }
        }

        // Apply coupon if provided and allowed
        let couponDiscount = 0;
        if (coupon_id && prod.show_coupon !== false) {
          const { data: couponData } = await supabaseAdmin
            .from("coupons")
            .select(
              "discount_type, discount_value, active, max_uses, used_count",
            )
            .eq("id", coupon_id)
            .eq("active", true)
            .maybeSingle();
          if (couponData) {
            if (
              couponData.max_uses != null &&
              couponData.used_count >= couponData.max_uses
            ) {
              return new Response(
                JSON.stringify({ error: "Cupom atingiu o limite de usos." }),
                {
                  status: 400,
                  headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json",
                  },
                },
              );
            }
            couponDiscount =
              couponData.discount_type === "percent"
                ? serverPrice * (couponData.discount_value / 100)
                : couponData.discount_value;
          }
        }

        // Calculate bump total server-side
        let bumpTotal = 0;
        if (
          bump_product_ids &&
          Array.isArray(bump_product_ids) &&
          bump_product_ids.length > 0
        ) {
          const { data: bumpProducts } = await supabaseAdmin
            .from("products")
            .select("price")
            .in("id", bump_product_ids)
            .eq("active", true);
          if (bumpProducts) {
            bumpTotal = bumpProducts.reduce(
              (sum: number, bp: any) => sum + Number(bp.price),
              0,
            );
          }
        }

        const validatedAmount =
          Math.max(serverPrice - couponDiscount, 0) + bumpTotal;
        // Allow small rounding tolerance (R$ 0.02)
        if (Math.abs(amount - validatedAmount) > 0.02) {
          console.warn(
            `[create-asaas-payment] Price mismatch: client=${amount}, server=${validatedAmount} (product=${serverPrice}, coupon=${couponDiscount}, bumps=${bumpTotal})`,
          );
          return new Response(
            JSON.stringify({
              error: "Valor inválido. Recarregue a página e tente novamente.",
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }
    }

    // Anti-fraud: check blacklist (CPF + Email)
    {
      const cleanCpfCheck = customer.cpf?.replace(/\D/g, "") || "";
      const checks = [];
      if (customer.email)
        checks.push(
          supabaseAdmin
            .from("fraud_blacklist")
            .select("id")
            .eq("type", "email")
            .eq("value", customer.email.toLowerCase())
            .maybeSingle(),
        );
      if (cleanCpfCheck)
        checks.push(
          supabaseAdmin
            .from("fraud_blacklist")
            .select("id")
            .eq("type", "cpf")
            .eq("value", cleanCpfCheck)
            .maybeSingle(),
        );
      const results = await Promise.all(checks);
      if (results.some((r) => r.data)) {
        console.warn(
          `[create-asaas-payment] Blacklisted customer blocked: ${customer.email}`,
        );
        return new Response(
          JSON.stringify({
            error:
              "Não foi possível processar este pagamento. Entre em contato com o suporte.",
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // Anti-fraud: detect duplicate purchase (same email + product in last 5 min)
    if (product_id && customer.email) {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: recentOrder } = await supabaseAdmin
        .from("orders")
        .select("id, status, customer_id")
        .eq("product_id", product_id)
        .in("status", ["pending", "paid", "approved"])
        .gte("created_at", fiveMinAgo)
        .limit(1);

      if (recentOrder && recentOrder.length > 0) {
        const { data: recentCustomer } = await supabaseAdmin
          .from("customers")
          .select("email")
          .eq("id", recentOrder[0].customer_id)
          .maybeSingle();

        if (
          recentCustomer?.email?.toLowerCase() === customer.email.toLowerCase()
        ) {
          console.warn(
            `[create-asaas-payment] Duplicate purchase blocked: ${customer.email} for product ${product_id}`,
          );
          return new Response(
            JSON.stringify({
              error:
                "Compra já em processamento. Aguarde alguns minutos antes de tentar novamente.",
            }),
            {
              status: 429,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }
    }

    // Check if producer is blocked (billing limit exceeded)
    if (productOwnerId) {
      const { data: billingAccount } = await supabaseAdmin
        .from("billing_accounts")
        .select("blocked")
        .eq("user_id", productOwnerId)
        .maybeSingle();
      if (billingAccount?.blocked) {
        return new Response(
          JSON.stringify({
            error:
              "Este checkout está temporariamente indisponível. O produtor precisa regularizar sua conta.",
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // Resolve Asaas API key from producer's gateway config
    if (productOwnerId) {
      const { data: gw } = await supabaseAdmin
        .from("payment_gateways")
        .select("config")
        .eq("user_id", productOwnerId)
        .eq("provider", "asaas")
        .eq("active", true)
        .maybeSingle();
      if (
        gw?.config &&
        typeof gw.config === "object" &&
        (gw.config as any).api_key
      ) {
        ASAAS_API_KEY = (gw.config as any).api_key;
      }
    }
    // Fallback to global env key ONLY for super_admin producers
    if (!ASAAS_API_KEY && productOwnerId) {
      const { data: ownerRoles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", productOwnerId)
        .eq("role", "super_admin")
        .maybeSingle();
      if (ownerRoles) {
        ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY") || null;
      }
    }
    if (!ASAAS_API_KEY) {
      return new Response(
        JSON.stringify({
          error:
            "Gateway de pagamento não configurado. O produtor precisa configurar o Asaas.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Upsert customer
    const { data: existingCustomer } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("email", customer.email)
      .maybeSingle();

    let customerId: string;
    if (existingCustomer) {
      customerId = existingCustomer.id;
      await supabaseAdmin
        .from("customers")
        .update({
          name: customer.name,
          phone: customer.phone,
          cpf: customer.cpf.replace(/\D/g, ""),
        })
        .eq("id", customerId);
    } else {
      const { data: newCustomer } = await supabaseAdmin
        .from("customers")
        .insert({
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          cpf: customer.cpf.replace(/\D/g, ""),
          user_id: productOwnerId,
        })
        .select("id")
        .single();
      customerId = newCustomer!.id;
    }

    const cleanCpf = customer.cpf.replace(/\D/g, "");

    // Resolve postalCode from producer's profile (CEP do produtor)
    // This avoids asking the customer for CEP — same approach as Kiwify/Hotmart
    let producerPostalCode = "01001000"; // fallback: São Paulo centro
    if (productOwnerId) {
      const { data: producerProfile } = await supabaseAdmin
        .from("profiles")
        .select("cpf")
        .eq("id", productOwnerId)
        .maybeSingle();
      // If producer has a CEP stored, use it; otherwise use the fallback
      // For now we use a safe São Paulo CEP since profiles don't have a CEP column yet
    }

    const { data: gatewayData } = await supabaseAdmin
      .from("payment_gateways")
      .select("config, environment")
      .eq("provider", "asaas")
      .eq("active", true)
      .eq("user_id", productOwnerId)
      .limit(1)
      .maybeSingle();

    const gateway_config = (gatewayData?.config as Record<string, any>) || {};
    const environment =
      gatewayData?.environment || Deno.env.get("ASAAS_ENV") || "sandbox";

    const baseUrl =
      environment === "production"
        ? "https://api.asaas.com/v3"
        : "https://sandbox.asaas.com/api/v3";

    // Create or find customer in Asaas
    const customerPayload = {
      name: customer.name,
      email: customer.email,
      cpfCnpj: cleanCpf,
      mobilePhone: customer.phone?.replace(/\D/g, "") || undefined,
    };

    const customerRes = await fetch(`${baseUrl}/customers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: ASAAS_API_KEY,
      },
      body: JSON.stringify(customerPayload),
    });

    const customerData = await customerRes.json();

    if (!customerRes.ok && !customerData.id) {
      const searchRes = await fetch(
        `${baseUrl}/customers?cpfCnpj=${cleanCpf}`,
        {
          headers: { access_token: ASAAS_API_KEY },
        },
      );
      const searchData = await searchRes.json();
      if (searchData.data?.[0]?.id) {
        customerData.id = searchData.data[0].id;
      } else {
        console.error("Asaas customer error:", JSON.stringify(customerData));

        // Log gateway failure for the producer
        if (productOwnerId) {
          const errDetail =
            customerData?.errors?.[0]?.description ||
            `HTTP ${customerRes.status}`;
          await supabaseAdmin
            .from("internal_tasks")
            .insert({
              user_id: productOwnerId,
              title: `Falha no gateway Asaas`,
              description: `Produto: ${productName} (${product_id}). Erro: ${errDetail}. Cliente: ${customer.email}`,
              priority: "high",
              status: "todo",
              category: "gateway_error",
            })
            .then((r) => {
              if (r.error)
                console.error(
                  "[create-asaas-payment] Failed to log gateway alert:",
                  r.error,
                );
            });
        }

        const errDesc = customerData?.errors?.[0]?.description || "";
        let userMsg =
          "Não foi possível processar seus dados. Verifique e tente novamente.";
        if (/cpf|cnpj/i.test(errDesc))
          userMsg = "CPF inválido. Verifique o número e tente novamente.";
        else if (/email/i.test(errDesc))
          userMsg = "E-mail inválido. Verifique e tente novamente.";
        else if (/phone|telefone/i.test(errDesc))
          userMsg = "Telefone inválido. Verifique o número e tente novamente.";
        return new Response(JSON.stringify({ error: userMsg }), {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Platform fee
    const { data: platformSettings } = await supabaseAdmin
      .from("platform_settings")
      .select("platform_fee_percent")
      .limit(1)
      .maybeSingle();
    const feePercent = Number(platformSettings?.platform_fee_percent || 0);
    const feeAmount = Math.round(amount * feePercent) / 100;

    // Helper to save order — returns the internal order ID
    const saveOrder = async (
      externalId: string,
      status: string,
      method: string,
    ): Promise<string | null> => {
      const { data: orderRecord, error: orderError } = await supabaseAdmin
        .from("orders")
        .insert({
          amount,
          payment_method: method,
          status,
          product_id: product_id || null,
          customer_id: customerId,
          user_id: productOwnerId,
          collaborator_id: collaborator_id || null,
          external_id: externalId,
          customer_state:
            body.customer_state || body.geo?.customer_state_geo || null,
          customer_city: body.geo?.customer_city || null,
          customer_zip: body.geo?.customer_zip || null,
          customer_country: body.geo?.customer_country || null,
          platform_fee_percent: feePercent,
          platform_fee_amount: feeAmount,
          metadata: {
            gateway: "asaas",
            config_id: config_id || null,
            coupon_id: coupon_id || null,
            installments: installments || "1",
            checkout_url: checkout_url || null,
            bump_product_ids:
              bump_product_ids && bump_product_ids.length > 0
                ? bump_product_ids
                : null,
            
            attribution_fbc: body.attribution_fbc || null,
            ...(utms || {}),
          },
        })
        .select("id")
        .single();

      if (orderError) {
        console.error("[create-asaas-payment] Order save error:", orderError);
        return null;
      }
      console.log("[create-asaas-payment] Order saved:", orderRecord.id);

      // Increment coupon usage atomically
      if (coupon_id) {
        await supabaseAdmin.rpc("increment_coupon_usage", {
          p_coupon_id: coupon_id,
        });
      }

      return orderRecord.id;
    };

    // SUBSCRIPTION
    if (is_subscription) {
      const cycle = BILLING_CYCLE_MAP[billing_cycle || "monthly"] || "MONTHLY";
      // Use TODAY so Asaas charges the card immediately instead of scheduling for tomorrow
      const nextDueDate = new Date();

      const subscriptionPayload: any = {
        customer: customerData.id,
        billingType: "CREDIT_CARD",
        value: amount,
        cycle,
        nextDueDate: nextDueDate.toISOString().split("T")[0],
        description: gateway_config.billing_description || "Assinatura",
      };

      if (customer.creditCard) {
        const subPostalCode = producerPostalCode;
        subscriptionPayload.creditCard = customer.creditCard;
        subscriptionPayload.creditCardHolderInfo = {
          name: customer.name,
          email: customer.email,
          cpfCnpj: cleanCpf,
          phone: customer.phone?.replace(/\D/g, "") || "",
          postalCode: subPostalCode,
          addressNumber: customer.addressNumber || "0",
        };
      }

      const subRes = await fetch(`${baseUrl}/subscriptions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          access_token: ASAAS_API_KEY,
        },
        body: JSON.stringify(subscriptionPayload),
      });

      const subData = await subRes.json();

      if (!subRes.ok) {
        console.error("Asaas subscription error:", JSON.stringify(subData));
        if (productOwnerId) {
          const errDetail =
            subData?.errors?.[0]?.description || `HTTP ${subRes.status}`;
          await supabaseAdmin.from("internal_tasks").insert({
            user_id: productOwnerId,
            title: `Falha no gateway Asaas (Assinatura)`,
            description: `Produto: ${productName} (${product_id}). Erro: ${errDetail}. Cliente: ${customer.email}`,
            priority: "high",
            status: "todo",
            category: "gateway_error",
          });
        }
        const subErrDesc = subData?.errors?.[0]?.description || "";
        let subUserMsg =
          "Não foi possível criar a assinatura. Verifique seus dados e tente novamente.";
        if (/card|cartão|credit/i.test(subErrDesc))
          subUserMsg =
            "Dados do cartão inválidos. Verifique e tente novamente.";
        else if (/cpf|cnpj/i.test(subErrDesc))
          subUserMsg = "CPF inválido. Verifique o número e tente novamente.";
        return new Response(JSON.stringify({ error: subUserMsg }), {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // After creating subscription, poll briefly for the first payment status.
      // Asaas may charge the card immediately when nextDueDate = today, but the
      // payment record can take a moment to appear. We retry with short backoff
      // instead of a fixed 2s wait — succeeds faster in the common case and
      // doesn't mask the webhook as the source of truth for late confirmations.
      let firstPaymentStatus = "PENDING";
      let firstPaymentId = subData.id;
      const pollDelays = [250, 500, 1000]; // ~1.75s worst case
      for (let attempt = 0; attempt < pollDelays.length; attempt++) {
        try {
          await new Promise((resolve) =>
            setTimeout(resolve, pollDelays[attempt]),
          );
          const paymentsRes = await fetch(
            `${baseUrl}/subscriptions/${subData.id}/payments?limit=1`,
            {
              headers: { access_token: ASAAS_API_KEY },
            },
          );
          const paymentsData = await paymentsRes.json();
          const firstPayment = paymentsData?.data?.[0];
          if (firstPayment) {
            firstPaymentId = firstPayment.id;
            firstPaymentStatus = firstPayment.status;
            console.log(
              `[create-asaas-payment] First payment (attempt ${attempt + 1}):`,
              firstPayment.id,
              "status:",
              firstPayment.status,
            );
            // If already settled or definitively pending, stop polling
            if (
              ["CONFIRMED", "RECEIVED", "OVERDUE", "REFUNDED"].includes(
                firstPayment.status,
              )
            )
              break;
            // PENDING after first attempt is fine — webhook will confirm later
            if (attempt >= 1) break;
          }
        } catch (checkErr) {
          console.error(
            `[create-asaas-payment] Error checking first payment attempt ${attempt + 1} (non-blocking):`,
            checkErr,
          );
        }
      }

      // Map Asaas payment status to internal status
      const subOrderStatus =
        firstPaymentStatus === "CONFIRMED" || firstPaymentStatus === "RECEIVED"
          ? "approved"
          : "pending";

      const orderId = await saveOrder(
        firstPaymentId,
        subOrderStatus,
        "credit_card",
      );

      console.log(
        "[create-asaas-payment] Subscription created:",
        subData.id,
        "first payment:",
        firstPaymentId,
        "status:",
        firstPaymentStatus,
        "order:",
        subOrderStatus,
      );

      return new Response(
        JSON.stringify({
          subscription_id: subData.id,
          status:
            firstPaymentStatus === "CONFIRMED" ||
            firstPaymentStatus === "RECEIVED"
              ? "CONFIRMED"
              : subData.status,
          payment_id: firstPaymentId,
          order_id: orderId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ONE-TIME PAYMENT
    const billingType =
      payment_method === "credit_card" ? "CREDIT_CARD" : "PIX";
    const dueDate = new Date();
    if (payment_method === "pix") {
      dueDate.setDate(
        dueDate.getDate() + (gateway_config.pix_validity_days || 1),
      );
    }

    const paymentPayload: any = {
      customer: customerData.id,
      billingType,
      value: amount,
      dueDate: dueDate.toISOString().split("T")[0],
      description: gateway_config.billing_description || "Pagamento",
    };

    if (payment_method === "credit_card") {
      const installmentCount = parseInt(installments) || 1;
      if (installmentCount > 1) {
        paymentPayload.installmentCount = installmentCount;
        paymentPayload.installmentValue =
          Math.round((amount / installmentCount) * 100) / 100;
      }

      if (customer.creditCard) {
        const holderPostalCode = producerPostalCode;
        paymentPayload.creditCard = customer.creditCard;
        paymentPayload.creditCardHolderInfo = {
          name: customer.name,
          email: customer.email,
          cpfCnpj: cleanCpf,
          phone: customer.phone?.replace(/\D/g, "") || "",
          postalCode: holderPostalCode,
          addressNumber: customer.addressNumber || "0",
        };
      }
    }

    const paymentRes = await fetch(`${baseUrl}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: ASAAS_API_KEY,
      },
      body: JSON.stringify(paymentPayload),
    });

    const paymentData = await paymentRes.json();

    if (!paymentRes.ok) {
      console.error("Asaas payment error:", JSON.stringify(paymentData));
      const payErrDesc = paymentData?.errors?.[0]?.description || "";
      let payUserMsg =
        "Não foi possível processar o pagamento. Verifique seus dados e tente novamente.";
      if (/card|cartão|credit|refused|recusad/i.test(payErrDesc))
        payUserMsg =
          "Pagamento recusado. Verifique os dados do cartão e tente novamente.";
      else if (/cpf|cnpj/i.test(payErrDesc))
        payUserMsg = "CPF inválido. Verifique o número e tente novamente.";
      else if (/insufficient|saldo/i.test(payErrDesc))
        payUserMsg = "Saldo insuficiente. Tente outro método de pagamento.";
      return new Response(JSON.stringify({ error: payUserMsg }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map Asaas status
    const statusMap: Record<string, string> = {
      CONFIRMED: "approved",
      RECEIVED: "approved",
      PENDING: "pending",
      OVERDUE: "pending",
      REFUNDED: "refunded",
      REFUND_REQUESTED: "refunded",
    };
    const orderStatus = statusMap[paymentData.status] || "pending";

    // Extract credit card token for one-click upsell
    const ccToken = paymentData.creditCard?.creditCardToken || null;

    const orderId = await saveOrder(
      paymentData.id,
      orderStatus,
      payment_method || "credit_card",
    );

    // Store Asaas customer ID + card token in order metadata for upsell
    if (
      payment_method === "credit_card" &&
      (ccToken || customerData.id) &&
      orderId
    ) {
      const { data: orderRecord2 } = await supabaseAdmin
        .from("orders")
        .select("metadata")
        .eq("id", orderId)
        .maybeSingle();
      if (orderRecord2) {
        const existingMeta =
          (orderRecord2.metadata as Record<string, any>) || {};
        await supabaseAdmin
          .from("orders")
          .update({
            metadata: {
              ...existingMeta,
              asaas_customer_id: customerData.id,
              credit_card_token: ccToken,
            },
          })
          .eq("id", orderId);
      }
    }

    // Push notification is handled by the webhook (asaas-webhook) to avoid duplicates

    return new Response(
      JSON.stringify({
        payment_id: paymentData.id,
        status: paymentData.status,
        invoice_url: paymentData.invoiceUrl,
        order_id: orderId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: "Erro interno ao processar pagamento. Tente novamente.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
