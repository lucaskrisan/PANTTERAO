import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SENDER_DOMAIN = "notify.app.panttera.com.br";
const FROM_DOMAIN = "app.panttera.com.br";

interface ProducerConfig {
  user_id: string;
  email_delay_minutes: number;
  email_enabled: boolean;
  email_subject: string;
  email_heading: string;
  email_button_text: string;
  email_button_color: string;
  second_email_enabled: boolean;
  second_email_delay_hours: number;
}

const DEFAULT_CONFIG = {
  email_enabled: true,
  email_delay_minutes: 30,
  email_subject: "Você esqueceu algo no carrinho 🛒",
  email_heading: "Você esqueceu algo no carrinho 🛒",
  email_button_text: "Finalizar compra →",
  email_button_color: "#22c55e",
  second_email_enabled: true,
  second_email_delay_hours: 24,
};

const MAX_EMAILS_PER_RUN = 50;

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildEmailHtml(
  cart: any,
  product: any,
  finalUrl: string,
  companyName: string,
  config: ProducerConfig,
  isSecondReminder: boolean
) {
  const productName = escapeHtml(product?.name || "seu produto");
  const productPrice = cart.product_price || product?.price || 0;
  const heading = isSecondReminder
    ? "Última chance! Seu carrinho vai expirar ⏰"
    : config.email_heading;
  const buttonColor = config.email_button_color;
  const buttonText = config.email_button_text;

  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">${heading}</h2>
      <p style="color: #666;">Olá${cart.customer_name ? ` ${escapeHtml(cart.customer_name)}` : ''},</p>
      <p style="color: #666;">${isSecondReminder
        ? "Este é seu último lembrete! Seu carrinho ainda está esperando, mas não por muito tempo."
        : "Notamos que você não finalizou sua compra. Seu carrinho ainda está esperando por você!"
      }</p>
      <div style="background: #f9f9f9; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="font-weight: bold; margin: 0;">${productName}</p>
        <p style="color: ${buttonColor}; font-size: 18px; margin: 8px 0;">R$ ${Number(productPrice).toFixed(2)}</p>
      </div>
      <a href="${finalUrl}" style="display: inline-block; background: ${buttonColor}; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">
        ${buttonText}
      </a>
      <p style="color: #999; font-size: 12px; margin-top: 24px;">
        Se você já finalizou sua compra, por favor ignore este e-mail.
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="color: #aaa; font-size: 11px; text-align: center;">
        Você recebeu este e-mail porque iniciou uma compra em ${companyName}.<br/>
        Se não deseja receber lembretes, ignore esta mensagem.
        ${isSecondReminder ? "Este é o último lembrete — você não receberá mais mensagens." : ""}
      </p>
    </div>
  `;
}

function buildEmailText(
  cart: any,
  product: any,
  finalUrl: string,
  companyName: string,
  config: ProducerConfig,
  isSecondReminder: boolean
) {
  const productName = product?.name || "seu produto";
  const productPrice = cart.product_price || product?.price || 0;
  const heading = isSecondReminder
    ? "Última chance! Seu carrinho vai expirar"
    : config.email_heading;
  const greeting = `Olá${cart.customer_name ? ` ${cart.customer_name}` : ''},`;
  const intro = isSecondReminder
    ? "Este é seu último lembrete! Seu carrinho ainda está esperando, mas não por muito tempo."
    : "Notamos que você não finalizou sua compra. Seu carrinho ainda está esperando por você!";
  const footerExtra = isSecondReminder
    ? " Este é o último lembrete — você não receberá mais mensagens."
    : "";

  return [
    heading,
    "",
    greeting,
    "",
    intro,
    "",
    `${productName} — R$ ${Number(productPrice).toFixed(2)}`,
    "",
    `${config.email_button_text}: ${finalUrl}`,
    "",
    "Se você já finalizou sua compra, por favor ignore este e-mail.",
    "",
    `Você recebeu este e-mail porque iniciou uma compra em ${companyName}.${footerExtra}`,
  ].join("\n");
}

function buildCheckoutUrl(cart: any, baseUrl: string, channel: string): string {
  let checkoutUrl = cart.checkout_url || cart.page_url || `${baseUrl}/checkout/${cart.product_id}`;
  const params = new URLSearchParams();
  if (cart.customer_name) params.set("name", cart.customer_name);
  if (cart.customer_email) params.set("email", cart.customer_email);
  if (cart.customer_phone) params.set("phone", cart.customer_phone);
  if (cart.customer_cpf) params.set("cpf", cart.customer_cpf);
  params.set("utm_source", "recovery");
  params.set("utm_medium", channel);
  params.set("utm_campaign", "abandoned_cart");
  const separator = checkoutUrl.includes("?") ? "&" : "?";
  return `${checkoutUrl}${separator}${params}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Load suppressed emails blacklist
    const { data: suppressedRows } = await supabaseAdmin
      .from("suppressed_emails")
      .select("email");
    const suppressedSet = new Set(
      (suppressedRows || []).map((r: any) => r.email?.toLowerCase())
    );

    // PHASE 1: First reminder emails
    const firstReminderResult = await processReminders(supabaseAdmin, {
      supabaseUrl,
      reminderType: "first",
      suppressedSet,
    });

    // PHASE 2: Second reminder emails (24h follow-up)
    const secondReminderResult = await processReminders(supabaseAdmin, {
      supabaseUrl,
      reminderType: "second",
      suppressedSet,
    });

    const totalProcessed = firstReminderResult.processed + secondReminderResult.processed;
    const totalSkipped = firstReminderResult.skipped + secondReminderResult.skipped;
    const totalSuppressed = firstReminderResult.suppressed + secondReminderResult.suppressed;

    console.log(`[cron] First: ${firstReminderResult.processed} sent, ${firstReminderResult.skipped} skipped, ${firstReminderResult.suppressed} suppressed. Second: ${secondReminderResult.processed} sent, ${secondReminderResult.skipped} skipped, ${secondReminderResult.suppressed} suppressed.`);

    return new Response(JSON.stringify({
      success: true,
      first_reminder: firstReminderResult,
      second_reminder: secondReminderResult,
      total_processed: totalProcessed,
      total_skipped: totalSkipped,
      total_suppressed: totalSuppressed,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[cron] Error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processReminders(
  supabaseAdmin: any,
  opts: {
    supabaseUrl: string;
    reminderType: "first" | "second";
    suppressedSet: Set<string>;
  }
) {
  const isSecond = opts.reminderType === "second";
  let totalProcessed = 0;
  let totalSkipped = 0;
  let totalSuppressed = 0;

  // Fetch eligible carts
  let query = supabaseAdmin
    .from("abandoned_carts")
    .select("user_id")
    .eq("recovered", false)
    .not("customer_email", "is", null);

  if (isSecond) {
    query = query.eq("email_reminder_count", 1);
  } else {
    query = query.is("email_recovery_sent_at", null);
  }

  let allProducerIds: string[] = [];
  let offset = 0;
  const PAGE_SIZE = 1000;

  while (true) {
    const { data: producerRows, error: producerError } = await query.range(offset, offset + PAGE_SIZE - 1);
    if (producerError) {
      console.error(`[cron][${opts.reminderType}] Error fetching producers:`, producerError);
      return { processed: 0, skipped: 0, suppressed: 0 };
    }
    if (!producerRows || producerRows.length === 0) break;
    for (const r of producerRows) {
      if (r.user_id) allProducerIds.push(r.user_id);
    }
    if (producerRows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const uniqueProducerIds = [...new Set(allProducerIds)];
  if (uniqueProducerIds.length === 0) return { processed: 0, skipped: 0, suppressed: 0 };

  // Fetch settings
  const { data: settingsRows } = await supabaseAdmin
    .from("cart_recovery_settings")
    .select("user_id, email_enabled, email_delay_minutes, email_subject, email_heading, email_button_text, email_button_color, second_email_enabled, second_email_delay_hours")
    .in("user_id", uniqueProducerIds);

  const settingsMap = new Map<string, any>();
  for (const s of settingsRows || []) {
    settingsMap.set(s.user_id, s);
  }

  const configs: ProducerConfig[] = uniqueProducerIds
    .map((uid) => {
      const s = settingsMap.get(uid) || {};
      return {
        user_id: uid,
        email_enabled: s.email_enabled ?? DEFAULT_CONFIG.email_enabled,
        email_delay_minutes: s.email_delay_minutes ?? DEFAULT_CONFIG.email_delay_minutes,
        email_subject: s.email_subject ?? DEFAULT_CONFIG.email_subject,
        email_heading: s.email_heading ?? DEFAULT_CONFIG.email_heading,
        email_button_text: s.email_button_text ?? DEFAULT_CONFIG.email_button_text,
        email_button_color: s.email_button_color ?? DEFAULT_CONFIG.email_button_color,
        second_email_enabled: s.second_email_enabled ?? DEFAULT_CONFIG.second_email_enabled,
        second_email_delay_hours: s.second_email_delay_hours ?? DEFAULT_CONFIG.second_email_delay_hours,
      };
    })
    .filter((c) => {
      if (!c.email_enabled) return false;
      if (isSecond && !c.second_email_enabled) return false;
      return true;
    });

  for (const config of configs) {
    if (totalProcessed >= MAX_EMAILS_PER_RUN) break;

    const cutoffMs = isSecond
      ? config.second_email_delay_hours * 60 * 60 * 1000
      : config.email_delay_minutes * 60 * 1000;
    const cutoff = new Date(Date.now() - cutoffMs).toISOString();

    let cartQuery = supabaseAdmin
      .from("abandoned_carts")
      .select("*, products(name, price, image_url, user_id)")
      .eq("user_id", config.user_id)
      .eq("recovered", false)
      .not("customer_email", "is", null)
      .order("created_at", { ascending: true })
      .limit(MAX_EMAILS_PER_RUN - totalProcessed);

    if (isSecond) {
      cartQuery = cartQuery
        .eq("email_reminder_count", 1)
        .lt("email_recovery_sent_at", cutoff);
    } else {
      cartQuery = cartQuery
        .is("email_recovery_sent_at", null)
        .lt("created_at", cutoff);
    }

    const { data: carts, error: cartsError } = await cartQuery;
    if (cartsError || !carts || carts.length === 0) continue;

    // Deduplication for reminders
    let sentSet = new Set<string>();
    const uniqueEmails = [...new Set(carts.map((c: any) => c.customer_email).filter(Boolean))];
    const { data: alreadySentCarts } = await supabaseAdmin
      .from("abandoned_carts")
      .select("customer_email, product_id")
      .eq("user_id", config.user_id)
      .not("email_recovery_sent_at", "is", null)
      .eq("email_reminder_count", isSecond ? 2 : 1) // Only count as sent if the specific reminder was sent
      .in("customer_email", uniqueEmails);

    sentSet = new Set(
      (alreadySentCarts || []).map((c: any) => `${c.customer_email}::${c.product_id}`)
    );

    // Fetch company name and custom domain
    const { data: checkoutSettings } = await supabaseAdmin
      .from("checkout_settings")
      .select("company_name")
      .eq("user_id", config.user_id)
      .maybeSingle();

    const companyName = checkoutSettings?.company_name || "Loja Online";

    const { data: customDomain } = await supabaseAdmin
      .from("custom_domains")
      .select("hostname")
      .eq("user_id", config.user_id)
      .eq("status", "active")
      .maybeSingle();

    const baseUrl = customDomain?.hostname
      ? `https://${customDomain.hostname}`
      : "https://app.panttera.com.br";

    // Send emails
    for (const cart of carts) {
      if (totalProcessed >= MAX_EMAILS_PER_RUN) break;

      // Rule: Only block recovery if the customer has bought EXACTLY this product.
      const { data: purchaseData } = await supabaseAdmin
        .from("pixel_events")
        .select("id")
        .eq("event_name", "Purchase")
        .eq("product_id", cart.product_id)
        .ilike("customer_email", cart.customer_email)
        .limit(1);

      if (purchaseData && purchaseData.length > 0) {
        totalSkipped++;
        await supabaseAdmin
          .from("abandoned_carts")
          .update({
            email_recovery_sent_at: new Date().toISOString(),
            email_recovery_status: "skipped_already_purchased",
            email_reminder_count: isSecond ? 2 : 1,
            recovered: true,
          } as any)
          .eq("id", cart.id);
        continue;
      }

      // Blacklist check
      if (opts.suppressedSet.has(cart.customer_email?.toLowerCase())) {
        totalSuppressed++;
        await supabaseAdmin
          .from("abandoned_carts")
          .update({
            email_recovery_sent_at: new Date().toISOString(),
            email_recovery_status: "suppressed",
            email_reminder_count: isSecond ? 2 : 1,
          } as any)
          .eq("id", cart.id);
        continue;
      }

      // Deduplication check
      const dedupeKey = `${cart.customer_email?.toLowerCase()}::${cart.product_id}`;
      if (sentSet.has(dedupeKey)) {
        totalSkipped++;
        await supabaseAdmin
          .from("abandoned_carts")
          .update({
            email_recovery_sent_at: new Date().toISOString(),
            email_recovery_status: "skipped_duplicate",
            email_reminder_count: isSecond ? 2 : 1,
          } as any)
          .eq("id", cart.id);
        continue;
      }
      sentSet.add(dedupeKey);

      const product = (cart as any).products;
      const finalUrl = buildCheckoutUrl(cart, baseUrl, "email");

      const subject = isSecond
        ? "Última chance! Seu carrinho vai expirar ⏰"
        : config.email_subject;

      const html = buildEmailHtml(cart, product, finalUrl, companyName, config, isSecond);
      const text = buildEmailText(cart, product, finalUrl, companyName, config, isSecond);

      let emailStatus = "error";

      try {
        const messageId = crypto.randomUUID();
        const reminderLabel = isSecond ? "abandoned_cart_cron_2nd" : "abandoned_cart_cron";

        const { error: enqueueError } = await supabaseAdmin.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload: {
            to: cart.customer_email,
            from: `${companyName} <noreply@${FROM_DOMAIN}>`,
            sender_domain: SENDER_DOMAIN,
            subject,
            html,
            text,
            purpose: "transactional",
            label: reminderLabel,
            idempotency_key: `cart-recovery-${isSecond ? "2nd" : "1st"}-${cart.id}`,
            message_id: messageId,
            queued_at: new Date().toISOString(),
          },
        });

        if (!enqueueError) {
          emailStatus = "sent";
        } else {
          console.error(`[cron][${opts.reminderType}] Enqueue error for cart ${cart.id}:`, enqueueError);
        }
      } catch (sendErr) {
        console.error(`[cron][${opts.reminderType}] Send error for cart ${cart.id}:`, sendErr);
      }

      // Update cart status
      const newCount = isSecond ? 2 : 1;
      await supabaseAdmin
        .from("abandoned_carts")
        .update({
          email_recovery_sent_at: new Date().toISOString(),
          email_recovery_status: emailStatus,
          email_reminder_count: newCount,
        } as any)
        .eq("id", cart.id);

      // Register in email_logs
      try {
        await supabaseAdmin.from("email_logs").insert({
          user_id: config.user_id,
          to_email: cart.customer_email,
          to_name: cart.customer_name || null,
          subject,
          email_type: "transactional",
          status: emailStatus,
          source: isSecond ? "abandoned_cart_cron_2nd" : "abandoned_cart_cron",
          product_id: cart.product_id,
          html_body: html,
          cost_estimate: 0.00115,
          metadata: { cart_id: cart.id, reminder: isSecond ? 2 : 1 },
        });
      } catch (logErr) {
        console.error(`[cron][${opts.reminderType}] Failed to log email for cart ${cart.id}:`, logErr);
      }

      totalProcessed++;
    }
  }

  return { processed: totalProcessed, skipped: totalSkipped, suppressed: totalSuppressed };
}
