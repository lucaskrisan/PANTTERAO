import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SENDER_DOMAIN = "notify.app.panttera.com.br";
const FROM_DOMAIN = "app.panttera.com.br";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { cart_id } = await req.json();
    if (!cart_id) {
      return new Response(JSON.stringify({ error: "cart_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch cart with product (incl. currency for language detection)
    const { data: cart, error: cartError } = await supabaseAdmin
      .from("abandoned_carts")
      .select("*, products(name, price, image_url, user_id, currency)")
      .eq("id", cart_id)
      .single();

    if (cartError || !cart) {
      return new Response(JSON.stringify({ error: "Cart not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Security: only allow the product owner
    const product = (cart as any).products;
    if (product?.user_id !== userData.user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!cart.customer_email) {
      return new Response(JSON.stringify({ error: "No customer email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Blacklist check
    const { data: suppressed } = await supabaseAdmin
      .from("suppressed_emails")
      .select("id")
      .eq("email", cart.customer_email.toLowerCase())
      .limit(1);

    if (suppressed && suppressed.length > 0) {
      return new Response(JSON.stringify({ error: "This email is suppressed/unsubscribed" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduplication
    const { data: existingSent } = await supabaseAdmin
      .from("abandoned_carts")
      .select("id")
      .eq("customer_email", cart.customer_email)
      .eq("product_id", cart.product_id)
      .eq("user_id", userData.user.id)
      .not("email_recovery_sent_at", "is", null)
      .eq("email_recovery_status", "sent")
      .limit(1);

    if (existingSent && existingSent.length > 0) {
      return new Response(JSON.stringify({ error: "Recovery email already sent to this customer for this product" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Bug 3: Verify if the customer already has a paid order for this product
    const { data: customerRecord } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('email', cart.customer_email)
      .maybeSingle();

    if (customerRecord) {
      const { data: paidOrder } = await supabaseAdmin
        .from('orders')
        .select('id')
        .eq('customer_id', customerRecord.id)
        .eq('product_id', cart.product_id)
        .in('status', ['paid', 'approved', 'completed'])
        .maybeSingle();

      if (paidOrder) {
        console.log(`[send-abandoned-cart-email] Customer ${cart.customer_email} already purchased product ${cart.product_id} - skipping email`);
        return new Response(JSON.stringify({ error: "Customer already purchased this product" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fetch checkout settings for company name
    const { data: settings } = await supabaseAdmin
      .from("checkout_settings")
      .select("company_name")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    const companyName = settings?.company_name || "Loja Online";

    // Check for custom domain
    const { data: customDomain } = await supabaseAdmin
      .from("custom_domains")
      .select("hostname")
      .eq("user_id", userData.user.id)
      .eq("status", "active")
      .maybeSingle();

    const baseUrl = customDomain?.hostname
      ? `https://${customDomain.hostname}`
      : "https://app.panttera.com.br";

    // Build checkout URL
    let checkoutUrl = cart.checkout_url || cart.page_url || `${baseUrl}/checkout/${cart.product_id}`;
    const params = new URLSearchParams();
    if (cart.customer_name) params.set("name", cart.customer_name);
    if (cart.customer_email) params.set("email", cart.customer_email);
    if (cart.customer_phone) params.set("phone", cart.customer_phone);
    if (cart.customer_cpf) params.set("cpf", cart.customer_cpf);
    params.set("utm_source", "recovery");
    params.set("utm_medium", "email");
    params.set("utm_campaign", "abandoned_cart_manual");
    const separator = checkoutUrl.includes("?") ? "&" : "?";
    const finalUrl = `${checkoutUrl}${separator}${params}`;

    const productName = product?.name || (product?.currency === "USD" ? "your product" : "seu produto");
    const productPrice = (cart as any).product_price || product?.price || 0;
    const isEnglish = product?.currency === "USD";

    const formattedPrice = isEnglish
      ? `$${Number(productPrice).toFixed(2)}`
      : `R$ ${Number(productPrice).toFixed(2).replace(".", ",")}`;

    const subject = isEnglish
      ? "You left something in your cart 🛒"
      : "Você esqueceu algo no carrinho 🛒";

    const greeting = isEnglish
      ? `Hi${cart.customer_name ? ` ${cart.customer_name}` : ""},`
      : `Olá${cart.customer_name ? ` ${cart.customer_name}` : ""},`;
    const intro = isEnglish
      ? "We noticed you didn't finish your purchase. Your cart is still waiting for you!"
      : "Notamos que você não finalizou sua compra. Seu carrinho ainda está esperando por você!";
    const ctaLabel = isEnglish ? "Complete purchase →" : "Finalizar compra →";
    const ignoreNote = isEnglish
      ? "If you've already completed your purchase, please ignore this email."
      : "Se você já finalizou sua compra, por favor ignore este e-mail.";
    const footerNote = isEnglish
      ? `You received this email because you started a purchase at ${companyName}.<br/>If you don't want to receive reminders, ignore this message. This is a one-time send — you won't receive another reminder for this product.`
      : `Você recebeu este e-mail porque iniciou uma compra em ${companyName}.<br/>Se não deseja receber lembretes, ignore esta mensagem. Este é um envio único — você não receberá outro lembrete para este produto.`;

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">${subject}</h2>
        <p style="color: #666;">${greeting}</p>
        <p style="color: #666;">${intro}</p>
        <div style="background: #f9f9f9; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="font-weight: bold; margin: 0;">${productName}</p>
          <p style="color: #22c55e; font-size: 18px; margin: 8px 0;">${formattedPrice}</p>
        </div>
        <a href="${finalUrl}" style="display: inline-block; background: #22c55e; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">
          ${ctaLabel}
        </a>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">
          ${ignoreNote}
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #aaa; font-size: 11px; text-align: center;">
          ${footerNote}
        </p>
      </div>
    `;

    // Enqueue via Lovable email queue
    const messageId = crypto.randomUUID();
    const { error: enqueueError } = await supabaseAdmin.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        to: cart.customer_email,
        from: `${companyName} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        purpose: "transactional",
        label: "abandoned_cart_manual",
        idempotency_key: `cart-recovery-manual-${cart_id}`,
        message_id: messageId,
        queued_at: new Date().toISOString(),
      },
    });

    const emailStatus = enqueueError ? "error" : "sent";

    if (enqueueError) {
      console.error("[send-abandoned-cart-email] Enqueue error details:", {
        cart_id,
        error: enqueueError,
        customer_email: cart.customer_email
      });
    }

    // Update cart
    await supabaseAdmin
      .from("abandoned_carts")
      .update({
        email_recovery_sent_at: new Date().toISOString(),
        email_recovery_status: emailStatus,
      } as any)
      .eq("id", cart_id);

    // Register in email_logs
    try {
      await supabaseAdmin.from("email_logs").insert({
        user_id: userData.user.id,
        to_email: cart.customer_email,
        to_name: cart.customer_name || null,
        subject,
        email_type: "transactional",
        status: emailStatus,
        source: "abandoned_cart_manual",
        product_id: cart.product_id,
        resend_id: messageId,
        html_body: html,
        cost_estimate: 0.00115,
        metadata: { cart_id: cart_id, language: isEnglish ? "en" : "pt-BR" },
      });
    } catch (logErr) {
      console.error("[send-abandoned-cart-email] Failed to log email:", logErr);
    }

    if (enqueueError) {
      return new Response(JSON.stringify({ error: "Email enqueue failed", details: enqueueError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[send-abandoned-cart-email] Error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
