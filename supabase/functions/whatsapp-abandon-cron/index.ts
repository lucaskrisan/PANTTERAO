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

const MAX_ATTEMPTS_PER_CART = 1;
const RETRY_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Get recovery settings for active users
    const { data: settings, error: settingsError } = await supabase
      .from("cart_recovery_settings")
      .select("user_id, whatsapp_enabled, whatsapp_delay_minutes")
      .eq("whatsapp_enabled", true);

    if (settingsError) {
      console.error("Error fetching settings:", settingsError);
      return json({ error: "Failed to fetch settings" }, 500);
    }

    if (!settings || settings.length === 0) {
      return json({ processed: 0, reason: "no_active_settings" });
    }

    const userSettingsMap = new Map(settings.map(s => [s.user_id, s.whatsapp_delay_minutes || 15]));
    const activeUserIds = settings.map(s => s.user_id);

    // Pull candidate carts from last 24h
    const twentyFourHAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: carts, error: cartError } = await supabase
      .from("abandoned_carts")
      .select("id, customer_phone, customer_name, customer_email, customer_cpf, product_id, user_id, checkout_url, page_url, utm_source, utm_medium, utm_campaign, utm_content, utm_term, created_at")
      .eq("recovered", false)
      .in("user_id", activeUserIds)
      .not("customer_phone", "is", null)
      .gt("created_at", twentyFourHAgo)
      .limit(100);

    if (cartError) {
      console.error("Error fetching carts:", cartError);
      return json({ error: "Failed to fetch carts" }, 500);
    }

    if (!carts || carts.length === 0) {
      return json({ processed: 0, reason: "no_carts" });
    }

    // Filter carts based on individual user delay settings
    const now = Date.now();
    const candidateCarts = carts.filter(cart => {
      const delayMinutes = userSettingsMap.get(cart.user_id!) || 15;
      const createdAt = new Date(cart.created_at).getTime();
      return (now - createdAt) >= (delayMinutes * 60 * 1000);
    });

    if (candidateCarts.length === 0) {
      return json({ processed: carts.length, reason: "no_carts_reached_delay" });
    }

    // Fetch attempt logs for candidates
    const cartIds = candidateCarts.map((c) => c.id);
    const { data: logs } = await supabase
      .from("whatsapp_send_log")
      .select("order_id, customer_phone, status, created_at")
      .eq("template_category", "abandono")
      .in("status", ["sent", "failed"])
      .in("order_id", cartIds);

    const attemptsByCart = new Map<string, { count: number; lastAt: number }>();
    for (const log of logs || []) {
      const ts = log.created_at ? new Date(log.created_at).getTime() : 0;
      if (log.order_id) {
        const cur = attemptsByCart.get(log.order_id) || { count: 0, lastAt: 0 };
        cur.count++;
        cur.lastAt = Math.max(cur.lastAt, ts);
        attemptsByCart.set(log.order_id, cur);
      }
    }

    let dispatched = 0;
    for (const cart of candidateCarts) {
      const cartAttempts = attemptsByCart.get(cart.id);
      if (cartAttempts && cartAttempts.count >= MAX_ATTEMPTS_PER_CART) continue;
      if (cartAttempts && (now - cartAttempts.lastAt < RETRY_COOLDOWN_MS)) continue;

      // Final recovery check
      const { data: freshCart } = await supabase
        .from("abandoned_carts")
        .select("recovered")
        .eq("id", cart.id)
        .maybeSingle();

      if (!freshCart || freshCart.recovered) continue;

      const { data: product } = await supabase
        .from("products")
        .select("name, price")
        .eq("id", cart.product_id)
        .maybeSingle();

      const baseUrl = cart.checkout_url || cart.page_url || "";
      let recoveryLink = baseUrl;
      if (baseUrl) {
        try {
          const u = new URL(baseUrl);
          // Remove bulky params to keep the URL shorter
          ["name", "email", "phone", "cpf", "customer_name", "customer_email", "customer_phone"].forEach(k => u.searchParams.delete(k));
          
          // Add essential tracking
          u.searchParams.set("c", cart.id.split("-")[0]); // Use short ID prefix if possible or keep full if necessary
          u.searchParams.set("utm_source", "wa");
          u.searchParams.set("utm_medium", "rec");
          
          recoveryLink = u.toString();
        } catch (_) {}
      }

      await supabase.functions.invoke("whatsapp-dispatch", {
        body: {
          tenant_id: cart.user_id,
          order_id: cart.id,
          customer_phone: cart.customer_phone,
          customer_name: cart.customer_name || "Cliente",
          product_name: product?.name || "",
          product_price: product?.price?.toString() || "",
          access_link: recoveryLink,
          category: "abandono",
        },
      });

      dispatched++;
    }

    return json({ processed: candidateCarts.length, dispatched });
  } catch (err) {
    console.error("whatsapp-abandon-cron error:", err);
    return json({ error: "Internal error" }, 500);
  }
});