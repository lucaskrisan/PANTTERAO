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

    const response = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const raw = await response.text();
    console.log("[create-pix-payment] OneSignal response:", {
      status: response.status,
      body: raw,
    });
  } catch (err) {
    console.error("[create-pix-payment] OneSignal error:", err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[create-pix-payment] request received");

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
      p_action: "create-pix-payment",
      p_max_hits: 5,
      p_window_seconds: 300,
    });

    if (rlData === true) {
      console.warn(`[create-pix-payment] Rate limited IP: ${clientIp}`);
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
    let PAGARME_API_KEY: string | null = null;

    // supabaseAdmin already created above for rate limiting

    const body = await req.json();
    if (body?.health_check === true) {
      return new Response(JSON.stringify({ ok: true, health_check: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const {
      customer,
      product_id,
      coupon_id,
      config_id,
      bump_product_ids,
      checkout_url,
      utms,
      collaborator_id,
    } = body;
    // Round amount to 2 decimal places to prevent floating point issues
    const amount = Math.round(Number(body.amount) * 100) / 100;

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

    // Server-side email validation — prevents corrupted emails (e.g. CPF digits leaking into email)
    const emailStr = String(customer.email).trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(emailStr)) {
      console.warn(`[create-pix-payment] Invalid email rejected: ${emailStr}`);
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
    // Sanitize email for downstream use
    customer.email = emailStr;

    const cleanCpf = customer.cpf.replace(/\D/g, "");
    const cleanPhone = customer.phone?.replace(/\D/g, "") || "";

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

        // Apply PIX discount (5%) with proper rounding
        const pixDiscount = Math.round(serverPrice * 0.05 * 100) / 100;
        const pixPrice = serverPrice - pixDiscount;

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
          Math.round(
            (Math.max(pixPrice - couponDiscount, 0) + bumpTotal) * 100,
          ) / 100;
        // Allow small rounding tolerance (R$ 0.02)
        if (Math.abs(amount - validatedAmount) > 0.02) {
          console.warn(
            `[create-pix-payment] Price mismatch: client=${amount}, server=${validatedAmount} (product=${pixPrice}, coupon=${couponDiscount}, bumps=${bumpTotal})`,
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
          `[create-pix-payment] Blacklisted customer blocked: ${customer.email}`,
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
            `[create-pix-payment] Duplicate purchase blocked: ${customer.email} for product ${product_id}`,
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

    // Resolve Pagar.me API key from producer's gateway config
    if (productOwnerId) {
      const { data: gw } = await supabaseAdmin
        .from("payment_gateways")
        .select("config")
        .eq("user_id", productOwnerId)
        .eq("provider", "pagarme")
        .eq("active", true)
        .maybeSingle();
      if (
        gw?.config &&
        typeof gw.config === "object" &&
        (gw.config as any).api_key
      ) {
        PAGARME_API_KEY = (gw.config as any).api_key;
      }
    }
    // Fallback to global env key ONLY for super_admin producers
    if (!PAGARME_API_KEY && productOwnerId) {
      const { data: ownerRoles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", productOwnerId)
        .eq("role", "super_admin")
        .maybeSingle();
      if (ownerRoles) {
        PAGARME_API_KEY = Deno.env.get("PAGARME_API_KEY") || null;
      }
    }
    if (!PAGARME_API_KEY) {
      return new Response(
        JSON.stringify({
          error:
            "Gateway de pagamento não configurado. O produtor precisa configurar o Pagar.me.",
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
        .update({ name: customer.name, phone: customer.phone, cpf: cleanCpf })
        .eq("id", customerId);
    } else {
      const { data: newCustomer } = await supabaseAdmin
        .from("customers")
        .insert({
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          cpf: cleanCpf,
          user_id: productOwnerId,
        })
        .select("id")
        .single();
      customerId = newCustomer!.id;
    }

    // 1. Save order to database FIRST (as pending) to ensure we don't lose the record
    const { data: platformSettings } = await supabaseAdmin
      .from("platform_settings")
      .select("platform_fee_percent")
      .limit(1)
      .maybeSingle();
    const feePercent = Number(platformSettings?.platform_fee_percent || 0);
    const feeAmount = Math.round(amount * feePercent) / 100;

    const { data: orderRecord, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        amount,
        payment_method: "pix",
        status: "pending",
        product_id: product_id || null,
        customer_id: customerId,
        user_id: productOwnerId,
        collaborator_id: collaborator_id || null,
        customer_state:
          body.customer_state || body.geo?.customer_state_geo || null,
        customer_city: body.geo?.customer_city || null,
        customer_zip: body.geo?.customer_zip || null,
        customer_country: body.geo?.customer_country || null,
        platform_fee_percent: feePercent,
        platform_fee_amount: feeAmount,
        metadata: {
          gateway: "pagarme",
          config_id: config_id || null,
          coupon_id: coupon_id || null,
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
      console.error("[create-pix-payment] Database error:", orderError);
      return new Response(
        JSON.stringify({ error: "Erro ao processar pedido. Tente novamente." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 2. Call Pagar.me API
    const orderPayload = {
      items: [
        {
          amount: Math.round(amount * 100),
          description: "Pagamento via PIX",
          quantity: 1,
          code: "pix-payment",
        },
      ],
      customer: {
        name: customer.name,
        email: customer.email,
        document: cleanCpf,
        document_type: "CPF",
        type: "individual",
        phones: cleanPhone
          ? {
              mobile_phone: {
                country_code: "55",
                area_code: cleanPhone.slice(0, 2),
                number: cleanPhone.slice(2),
              },
            }
          : undefined,
      },
      payments: [
        {
          payment_method: "pix",
          pix: { expires_in: 1800 },
        },
      ],
      metadata: {
        order_id: orderRecord.id,
      },
    };

    const response = await fetch("https://api.pagar.me/core/v5/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(PAGARME_API_KEY + ":")}`,
      },
      body: JSON.stringify(orderPayload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "[create-pix-payment] Pagar.me error:",
        JSON.stringify(data),
      );

      // Update order status to failed
      await supabaseAdmin
        .from("orders")
        .update({ status: "failed" })
        .eq("id", orderRecord.id);

      // Log gateway failure for the producer
      if (productOwnerId) {
        const gatewayErrDetail =
          data?.errors?.[0]?.message ||
          data?.message ||
          `HTTP ${response.status}`;
        await supabaseAdmin
          .from("internal_tasks")
          .insert({
            user_id: productOwnerId,
            title: `Falha no gateway Pagar.me (PIX)`,
            description: `Produto: ${productName} (${product_id}). Erro: ${gatewayErrDetail}. Cliente: ${customer.email}`,
            priority: "high",
            status: "todo",
            category: "gateway_error",
          })
          .then((r) => {
            if (r.error)
              console.error(
                "[create-pix-payment] Failed to log gateway alert:",
                r.error,
              );
          });
      }

      // Map known gateway errors to user-friendly messages
      const gatewayMsg = data?.errors?.[0]?.message || data?.message || "";
      let userMessage =
        "Não foi possível gerar o PIX. Verifique seus dados e tente novamente.";
      if (/cpf|document/i.test(gatewayMsg))
        userMessage = "CPF inválido. Verifique o número e tente novamente.";
      else if (/phone|telefone/i.test(gatewayMsg))
        userMessage =
          "Telefone inválido. Verifique o número e tente novamente.";
      else if (/email/i.test(gatewayMsg))
        userMessage = "E-mail inválido. Verifique e tente novamente.";
      return new Response(JSON.stringify({ error: userMessage }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Update order with external_id
    await supabaseAdmin
      .from("orders")
      .update({ external_id: data.id })
      .eq("id", orderRecord.id);

    // Check if Pagar.me order failed (e.g. invalid CPF, fraud check)
    if (data.status === "failed") {
      console.error(
        "[create-pix-payment] Pagar.me order failed:",
        JSON.stringify(data),
      );
      // Sanitize: never expose gateway_response internals to browser
      const rawReason =
        data.charges?.[0]?.last_transaction?.gateway_response?.errors?.[0]
          ?.message ||
        data.charges?.[0]?.last_transaction?.status ||
        "";
      let userMessage =
        "Não foi possível gerar o PIX. Verifique seus dados e tente novamente.";
      if (/cpf|document/i.test(rawReason))
        userMessage = "CPF inválido. Verifique o número e tente novamente.";
      else if (/phone|telefone/i.test(rawReason))
        userMessage =
          "Telefone inválido. Verifique o número e tente novamente.";
      else if (/fraud|antifraude/i.test(rawReason))
        userMessage =
          "Pagamento não autorizado. Tente novamente ou use outro método.";
      return new Response(JSON.stringify({ error: userMessage }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const charge = data.charges?.[0];
    const lastTransaction = charge?.last_transaction;

    // Increment coupon usage atomically
    if (coupon_id) {
      await supabaseAdmin.rpc("increment_coupon_usage", {
        p_coupon_id: coupon_id,
      });
    }

    // Push notification (respect user settings)
    try {
      if (productOwnerId) {
        const { data: notifSettings } = await supabaseAdmin
          .from("notification_settings")
          .select("*")
          .eq("user_id", productOwnerId)
          .maybeSingle();

        // Check if send_pending is enabled
        if (notifSettings?.send_pending === true) {
          let shouldSend = true;

          // Check product whitelist
          if (notifSettings.product_whitelist && Array.isArray(notifSettings.product_whitelist)) {
            if (!notifSettings.product_whitelist.includes(product_id)) {
              shouldSend = false;
              console.log(`[create-pix-payment] Push skipped: product ${product_id} not in whitelist`);
            }
          }

          // Check quiet hours
          if (shouldSend && notifSettings.quiet_hours_enabled) {
            const now = new Date();
            const brTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
            const hours = brTime.getHours().toString().padStart(2, '0');
            const mins = brTime.getMinutes().toString().padStart(2, '0');
            const currentTimeStr = `${hours}:${mins}`;

            const start = notifSettings.quiet_hours_start || "22:00";
            const end = notifSettings.quiet_hours_end || "08:00";

            if (start < end) {
              if (currentTimeStr >= start && currentTimeStr <= end) shouldSend = false;
            } else {
              // Over midnight
              if (currentTimeStr >= start || currentTimeStr <= end) shouldSend = false;
            }
            if (!shouldSend) console.log(`[create-pix-payment] Push skipped: quiet hours (${start}-${end})`);
          }

          if (shouldSend) {
            const formattedAmount = Number(amount).toFixed(2).replace(".", ",");
            const title = "💠 PIX gerado!";
            const message = `${customer.name} gerou um PIX de R$ ${formattedAmount}${notifSettings.show_product_name ? ` • ${productName}` : ""}`;
            await sendPushNotification(
              title,
              message,
              productOwnerId,
              "https://app.panttera.com.br/admin/orders",
            );
          }
        } else {
          console.log(`[create-pix-payment] Push skipped: send_pending is false for user ${productOwnerId}`);
        }
      }
    } catch (notifErr) {
      console.error("[create-pix-payment] Notification error:", notifErr);
    }

    // Send PIX email to customer via Resend
    try {
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (RESEND_API_KEY && lastTransaction?.qr_code_url) {
        const formattedAmount = Number(amount).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });
        const expiresAt = lastTransaction.expires_at
          ? new Date(lastTransaction.expires_at).toLocaleString("pt-BR", {
              timeZone: "America/Sao_Paulo",
            })
          : "30 minutos";
        const pixCode = lastTransaction.qr_code || "";

        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
          <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
              <div style="background:linear-gradient(135deg,#22c55e,#16a34a);padding:32px 40px;text-align:center;">
                <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">💠 Seu PIX foi gerado!</h1>
              </div>
              <div style="padding:32px 40px;">
                <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 8px;">
                  Olá <strong>${customer.name.split(" ")[0]}</strong>,
                </p>
                <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 24px;">
                  Seu pagamento de <strong>${formattedAmount}</strong> para <strong>${productName}</strong> está quase concluído! Escaneie o QR Code abaixo ou copie o código PIX para finalizar:
                </p>
                <div style="text-align:center;margin:24px 0;">
                  <img src="${lastTransaction.qr_code_url}" alt="QR Code PIX" style="width:220px;height:220px;border-radius:12px;border:2px solid #e5e7eb;" />
                </div>
                <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:20px 0;">
                  <p style="color:#6b7280;font-size:12px;margin:0 0 8px;text-transform:uppercase;font-weight:600;letter-spacing:0.5px;">Código PIX (Copia e Cola)</p>
                  <p style="color:#111827;font-size:13px;margin:0;word-break:break-all;font-family:monospace;line-height:1.5;">${pixCode}</p>
                </div>
                <div style="background:linear-gradient(135deg,#fefce8,#fef9c3);border:1px solid #fde68a;border-radius:8px;padding:14px 16px;margin:20px 0;">
                  <p style="color:#92400e;font-size:14px;margin:0;font-weight:500;">
                    ⏰ <strong>Atenção:</strong> Este PIX expira em <strong>${expiresAt}</strong>. Pague antes do vencimento para garantir sua compra!
                  </p>
                </div>
                <div style="text-align:center;margin:28px 0 0;">
                  <p style="color:#6b7280;font-size:13px;margin:0;">
                    Após o pagamento, você receberá a confirmação automaticamente. 🎉
                  </p>
                </div>
              </div>
              <div style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
                <p style="color:#9ca3af;font-size:12px;margin:0;">
                  Este é um email automático. Não responda a esta mensagem.
                </p>
              </div>
            </div>
          </body>
          </html>
        `;

        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "PanteraPay <noreply@app.panttera.com.br>",
            to: [customer.email],
            subject: `💠 Seu PIX de ${formattedAmount} foi gerado — finalize agora!`,
            html: emailHtml,
          }),
        });

        const resendData = await resendRes.json();
        // Log email
        try {
          await supabaseAdmin.from("email_logs").insert({
            user_id: productOwnerId,
            to_email: customer.email,
            to_name: customer.name,
            subject: `💠 Seu PIX de ${formattedAmount} foi gerado — finalize agora!`,
            html_body: emailHtml,
            email_type: "pix_generated",
            status: resendRes.ok ? "sent" : "failed",
            resend_id: resendData?.id || null,
            order_id: orderRecord?.id || null,
            customer_id: customerId,
            product_id: product_id || null,
            source: "create-pix-payment",
          });
        } catch (logErr) {
          console.error("[create-pix-payment] Email log error:", logErr);
        }

        if (!resendRes.ok) {
          console.error("[create-pix-payment] Resend error:", resendData);
        } else {
          console.log("[create-pix-payment] PIX email sent to", customer.email);
        }
      }
    } catch (emailErr) {
      console.error("[create-pix-payment] Email error:", emailErr);
    }

    return new Response(
      JSON.stringify({
        order_id: data.id,
        status: data.status,
        qr_code: lastTransaction?.qr_code,
        qr_code_url: lastTransaction?.qr_code_url,
        expires_at: lastTransaction?.expires_at,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[create-pix-payment] Error:", error);
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
