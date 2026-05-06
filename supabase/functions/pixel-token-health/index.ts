// Edge function: pixel-token-health
// Cron diário 8h — testa cada token CAPI via Graph API e atualiza token_status
// Aceita parâmetro opcional `pixel_row_id` para testar apenas um pixel específico
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Lê body opcional para verificar pixel específico
  let pixelRowId: string | null = null;
  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body?.pixel_row_id && typeof body.pixel_row_id === "string") {
        pixelRowId = body.pixel_row_id;
      }
    }
  } catch {
    // ignora
  }

  let query = supabase
    .from("product_pixels")
    .select("id, pixel_id, capi_token")
    .not("capi_token", "is", null);

  if (pixelRowId) {
    query = query.eq("id", pixelRowId);
  }

  const { data: pixels, error } = await query;

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let healthy = 0;
  let invalid = 0;

  for (const p of pixels ?? []) {
    if (!p.capi_token || !p.pixel_id) continue;
    let status: "healthy" | "invalid" = "invalid";
    try {
      const url = `https://graph.facebook.com/v22.0/${p.pixel_id}?access_token=${encodeURIComponent(
        p.capi_token
      )}&fields=id,name`;
      const res = await fetch(url);
      if (res.ok) status = "healthy";
      else status = "invalid";
    } catch {
      status = "invalid";
    }

    await supabase
      .from("product_pixels")
      .update({ token_status: status, last_health_check_at: new Date().toISOString() })
      .eq("id", p.id);

    if (status === "healthy") healthy++;
    else invalid++;
  }

  return new Response(
    JSON.stringify({
      checked: (pixels ?? []).length,
      healthy,
      invalid,
      mode: pixelRowId ? "single" : "batch",
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
