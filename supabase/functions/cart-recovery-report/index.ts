import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * cart-recovery-report
 * 
 * Weekly cron: sends each producer a summary email with:
 * - Total abandoned carts this week
 * - Total recovered carts
 * - Recovery rate %
 * - Revenue recovered
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!resendApiKey || !lovableApiKey) {
      return new Response(JSON.stringify({ error: "Missing API keys" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Get all producers who had abandoned carts this week
    const { data: weekCarts, error } = await supabase
      .from("abandoned_carts")
      .select("user_id, recovered, product_price, products(price)")
      .gt("created_at", oneWeekAgo)
      .not("user_id", "is", null);

    if (error || !weekCarts || weekCarts.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No carts this week" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Aggregate per producer
    const producerStats = new Map<string, {
      total: number;
      recovered: number;
      recoveredRevenue: number;
    }>();

    for (const cart of weekCarts) {
      if (!cart.user_id) continue;
      const stats = producerStats.get(cart.user_id) || { total: 0, recovered: 0, recoveredRevenue: 0 };
      stats.total++;
      if (cart.recovered) {
        stats.recovered++;
        const price = cart.product_price || (cart as any).products?.price || 0;
        stats.recoveredRevenue += Number(price);
      }
      producerStats.set(cart.user_id, stats);
    }

    let sentCount = 0;

    for (const [userId, stats] of producerStats) {
      // Get producer email from profiles
      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      const producerEmail = authUser?.user?.email;
      if (!producerEmail) continue;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();

      const { data: checkoutSettings } = await supabase
        .from("checkout_settings")
        .select("company_name")
        .eq("user_id", userId)
        .maybeSingle();

      const companyName = checkoutSettings?.company_name || "Sua Loja";
      const producerName = profile?.full_name || "Produtor";
      const recoveryRate = stats.total > 0 ? ((stats.recovered / stats.total) * 100).toFixed(1) : "0";

      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">📊 Relatório Semanal de Recuperação</h2>
          <p style="color: #666;">Olá ${producerName},</p>
          <p style="color: #666;">Aqui está o resumo da sua semana em ${companyName}:</p>
          
          <div style="background: #f9f9f9; border-radius: 12px; padding: 24px; margin: 20px 0;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 16px;">
              <div style="text-align: center; flex: 1;">
                <p style="color: #999; font-size: 12px; margin: 0;">Carrinhos Abandonados</p>
                <p style="color: #333; font-size: 28px; font-weight: bold; margin: 4px 0;">${stats.total}</p>
              </div>
              <div style="text-align: center; flex: 1;">
                <p style="color: #999; font-size: 12px; margin: 0;">Recuperados</p>
                <p style="color: #22c55e; font-size: 28px; font-weight: bold; margin: 4px 0;">${stats.recovered}</p>
              </div>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <div style="text-align: center; flex: 1;">
                <p style="color: #999; font-size: 12px; margin: 0;">Taxa de Recuperação</p>
                <p style="color: #3b82f6; font-size: 28px; font-weight: bold; margin: 4px 0;">${recoveryRate}%</p>
              </div>
              <div style="text-align: center; flex: 1;">
                <p style="color: #999; font-size: 12px; margin: 0;">Receita Recuperada</p>
                <p style="color: #22c55e; font-size: 28px; font-weight: bold; margin: 4px 0;">R$ ${stats.recoveredRevenue.toFixed(2)}</p>
              </div>
            </div>
          </div>

          ${stats.recovered > 0
            ? `<p style="color: #22c55e; font-weight: bold;">🎉 Parabéns! Você recuperou ${stats.recovered} venda${stats.recovered > 1 ? 's' : ''} esta semana!</p>`
            : `<p style="color: #666;">💡 Dica: Certifique-se de que a recuperação automática está ativada para maximizar suas vendas.</p>`
          }
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #aaa; font-size: 11px; text-align: center;">
            Este relatório é enviado automaticamente toda semana.<br/>
            ${companyName} — Relatório de Recuperação de Carrinhos
          </p>
        </div>
      `;

      try {
        const emailRes = await fetch(`${GATEWAY_URL}/emails`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lovableApiKey}`,
            "X-Connection-Api-Key": resendApiKey,
          },
          body: JSON.stringify({
            from: `${companyName} <noreply@app.panttera.com.br>`,
            to: [producerEmail],
            subject: `📊 Relatório Semanal: ${stats.recovered}/${stats.total} carrinhos recuperados`,
            html,
          }),
        });

        if (emailRes.ok) {
          sentCount++;
          // Log
          await supabase.from("email_logs").insert({
            user_id: userId,
            to_email: producerEmail,
            to_name: producerName,
            subject: `Relatório Semanal: ${stats.recovered}/${stats.total} carrinhos recuperados`,
            email_type: "transactional",
            status: "sent",
            source: "cart_recovery_report",
            cost_estimate: 0.00115,
            metadata: { ...stats, week_start: oneWeekAgo },
          });
        }
      } catch (sendErr) {
        console.error(`[report] Failed to send to ${producerEmail}:`, sendErr);
      }
    }

    console.log(`[cart-recovery-report] Sent ${sentCount} weekly reports`);

    return new Response(JSON.stringify({ success: true, sent: sentCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[cart-recovery-report] Error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
