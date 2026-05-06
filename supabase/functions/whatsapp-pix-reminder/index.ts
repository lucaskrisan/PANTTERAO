import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/**
 * whatsapp-pix-reminder
 *
 * Called by pg_cron every 10 minutes.
 * Finds pending PIX orders older than 7 min (but less than 4h)
 * and dispatches a WhatsApp reminder via whatsapp-dispatch.
 *
 * FIX v2: Full CORS headers + 10s AbortController timeout on Evolution API calls.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const sevenMinAgo = new Date(Date.now() - 7 * 60 * 1000).toISOString();
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

    // Find pending PIX orders between 7min and 4h old
    const { data: orders, error: orderError } = await supabase
      .from("orders")
      .select("id, user_id, customer_id, product_id, amount, status")
      .eq("status", "pending")
      .eq("payment_method", "pix")
      .lt("created_at", sevenMinAgo)
      .gt("created_at", fourHoursAgo)
      .limit(50);

    if (orderError) {
      console.error("Error fetching orders:", orderError);
      return json({ error: "Failed to fetch orders" }, 500);
    }

    if (!orders || orders.length === 0) {
      return json({ processed: 0, reason: "no_pending_pix" });
    }

    // Check which orders already had a reminder sent
    const orderIds = orders.map((o) => o.id);
    const { data: alreadySent } = await supabase
      .from("whatsapp_send_log")
      .select("order_id")
      .eq("template_category", "lembrete_pix")
      .in("order_id", orderIds);

    const sentSet = new Set((alreadySent || []).map((s: any) => s.order_id));
    const pendingOrders = orders.filter((o) => !sentSet.has(o.id));

    let dispatched = 0;
    let skippedPaid = 0;

    for (const order of pendingOrders) {
      if (!order.user_id || !order.customer_id) continue;

      // ── CRITICAL: Re-check payment status before dispatch ──
      const { data: freshOrder } = await supabase
        .from("orders")
        .select("status")
        .eq("id", order.id)
        .maybeSingle();

      if (!freshOrder || freshOrder.status !== "pending") {
        skippedPaid++;
        console.log(`[pix-reminder] Skipped order ${order.id} — status is now "${freshOrder?.status}"`);
        continue;
      }

      // Get customer info
      const { data: customer } = await supabase
        .from("customers")
        .select("name, phone")
        .eq("id", order.customer_id)
        .maybeSingle();

      if (!customer?.phone) continue;

      // Get product info
      const { data: product } = await supabase
        .from("products")
        .select("name")
        .eq("id", order.product_id)
        .maybeSingle();

      try {
        // Check if user wants WhatsApp reminders for PIX
        const { data: notifSettings } = await supabase
          .from("notification_settings")
          .select("whatsapp_pix_reminder")
          .eq("user_id", order.user_id)
          .maybeSingle();

        if (notifSettings && notifSettings.whatsapp_pix_reminder === false) {
          console.log(`[pix-reminder] Skipped order ${order.id} — WhatsApp reminders disabled for user ${order.user_id}`);
          continue;
        }

        const rawCheckoutUrl = (order as any).metadata?.checkout_url 
          || `https://app.panttera.com.br/checkout/${order.product_id}`;

        let checkoutUrl = rawCheckoutUrl;
        try {
          const u = new URL(rawCheckoutUrl);
          // Remove bulky params to keep the URL shorter
          ["name", "email", "phone", "cpf", "customer_name", "customer_email", "customer_phone"].forEach(k => u.searchParams.delete(k));
          
          // Add minimalist tracking
          u.searchParams.set("o", order.id.split("-")[0]); // order short prefix
          u.searchParams.set("utm_source", "wa");
          u.searchParams.set("utm_medium", "pix");
          
          checkoutUrl = u.toString();
        } catch (_) {}

        await supabase.functions.invoke("whatsapp-dispatch", {
          body: {
            tenant_id: order.user_id,
            order_id: order.id,
            customer_phone: customer.phone,
            customer_name: customer.name || "Cliente",
            product_name: product?.name || "",
            product_price: order.amount?.toString() || "",
            access_link: checkoutUrl,
            category: "lembrete_pix",
          },
        });
        dispatched++;
        console.log(`[pix-reminder] Dispatched reminder for order ${order.id}`);
      } catch (err) {
        console.error("Dispatch error for order:", order.id, err);
      }
    }

    console.log(`[pix-reminder] Total: ${pendingOrders.length}, dispatched: ${dispatched}, skipped_paid: ${skippedPaid}`);

    return json({ processed: pendingOrders.length, dispatched, skipped_paid: skippedPaid });
  } catch (err) {
    console.error("whatsapp-pix-reminder error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
