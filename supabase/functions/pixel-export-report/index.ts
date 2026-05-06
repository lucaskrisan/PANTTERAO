// Edge function: pixel-export-report
// Gera CSV sob demanda com snapshot dos pixels (Super Admin only)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Não autenticado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );

  // Valida super admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Não autenticado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: isSuper } = await supabase.rpc("is_super_admin", { _user_id: user.id });
  if (!isSuper) {
    return new Response(JSON.stringify({ error: "Acesso negado" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Busca métricas via RPC já existente
  const { data, error } = await supabase.rpc("get_pixel_feedback_metrics", { p_days: 7 });
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const payload = data as any;
  const lines: string[] = [];
  lines.push("Pixel ID,Produto,Plataforma,Token,Status,Último evento,Total eventos 7d,Purchases 7d,EMQ médio");

  for (const p of payload.pixels ?? []) {
    const totalEvents = (p.events ?? []).reduce((s: number, e: any) => s + e.count, 0);
    const purchases = (p.events ?? [])
      .filter((e: any) => e.event_name === "Purchase")
      .reduce((s: number, e: any) => s + e.count, 0);
    const emqVals = (p.emq_by_event ?? []).map((e: any) => e.avg_emq).filter((v: number) => v > 0);
    const emqAvg = emqVals.length ? emqVals.reduce((a: number, b: number) => a + b, 0) / emqVals.length : 0;

    lines.push(
      [
        p.pixel_id,
        `"${(p.product_name || "").replace(/"/g, '""')}"`,
        p.platform,
        p.has_token ? "sim" : "não",
        p.token_status,
        p.last_event_at || "—",
        totalEvents,
        purchases,
        emqAvg.toFixed(2),
      ].join(",")
    );
  }

  const csv = lines.join("\n");
  return new Response(csv, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
});
