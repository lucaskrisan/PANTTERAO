// Landing Health Check — verifica instalação do script PanteraPay numa URL externa
// Não envia nada ao Meta. Apenas faz fetch da URL pública e analisa o HTML.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Check {
  name: string;
  status: "pass" | "warning" | "error";
  detail: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, product_id, pixel_id } = await req.json();

    if (!url || typeof url !== "string" || !url.startsWith("http")) {
      return new Response(
        JSON.stringify({ error: "URL inválida (precisa começar com http/https)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Auth (any authenticated user can run health check on their own URLs)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authErr || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the landing page HTML
    let html = "";
    let statusCode = 0;
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; PanteraPayHealthCheck/1.0; +https://panttera.com.br)",
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "follow",
      });
      statusCode = res.status;
      html = await res.text();
    } catch (err: any) {
      return new Response(
        JSON.stringify({
          error: `Não foi possível acessar a URL: ${err.message || "erro de conexão"}`,
          checks: [
            {
              name: "Acesso à página",
              status: "error",
              detail: `Falha ao buscar a URL: ${err.message || "timeout/erro de conexão"}`,
            },
          ],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const checks: Check[] = [];

    // 1. HTTP status
    if (statusCode >= 200 && statusCode < 400) {
      checks.push({
        name: "Acesso à página",
        status: "pass",
        detail: `HTTP ${statusCode} — página acessível ✅`,
      });
    } else {
      checks.push({
        name: "Acesso à página",
        status: "error",
        detail: `HTTP ${statusCode} — página inacessível`,
      });
    }

    // 2. Meta Pixel SDK
    if (html.includes("fbevents.js")) {
      checks.push({
        name: "Meta Pixel SDK",
        status: "pass",
        detail: "fbevents.js carregado ✅",
      });
    } else {
      checks.push({
        name: "Meta Pixel SDK",
        status: "error",
        detail: "fbevents.js NÃO encontrado — Pixel não vai disparar",
      });
    }

    // 3. fbq init
    if (html.match(/fbq\(\s*['"]init['"]/)) {
      checks.push({
        name: "fbq('init')",
        status: "pass",
        detail: "Inicialização do Pixel encontrada ✅",
      });
    } else {
      checks.push({
        name: "fbq('init')",
        status: "error",
        detail: "Nenhuma chamada fbq('init', ...) detectada",
      });
    }

    // 4. Pixel ID específico do produto selecionado
    if (pixel_id && typeof pixel_id === "string" && pixel_id.length > 5) {
      if (html.includes(pixel_id)) {
        checks.push({
          name: "Pixel ID correto",
          status: "pass",
          detail: `Pixel ${pixel_id} presente na página ✅`,
        });
      } else {
        checks.push({
          name: "Pixel ID correto",
          status: "error",
          detail: `Pixel ${pixel_id} NÃO encontrado — script pode ser de outro produto`,
        });
      }
    }

    // 5. Script PanteraPay (marca registrada)
    if (html.includes("__pcTrackingFired")) {
      checks.push({
        name: "Script PanteraPay",
        status: "pass",
        detail: "Guard __pcTrackingFired detectado — script oficial ✅",
      });
    } else {
      checks.push({
        name: "Script PanteraPay",
        status: "warning",
        detail: "Guard __pcTrackingFired ausente — script pode ter sido modificado",
      });
    }

    // 6. CAPI endpoint
    if (html.includes("facebook-capi")) {
      checks.push({
        name: "Endpoint CAPI",
        status: "pass",
        detail: "Chamada server-side facebook-capi presente ✅",
      });
    } else {
      checks.push({
        name: "Endpoint CAPI",
        status: "warning",
        detail: "Endpoint facebook-capi ausente — só Pixel browser",
      });
    }

    // 7. PageView
    if (html.match(/track['"],\s*['"]PageView/)) {
      checks.push({
        name: "Evento PageView",
        status: "pass",
        detail: "fbq('track','PageView') detectado ✅",
      });
    } else {
      checks.push({
        name: "Evento PageView",
        status: "warning",
        detail: "PageView pode ser disparado dinamicamente (SPA) — use window.pcTrack()",
      });
    }

    // 8. ViewContent
    if (html.match(/track['"],\s*['"]ViewContent/)) {
      checks.push({
        name: "Evento ViewContent",
        status: "pass",
        detail: "ViewContent detectado ✅",
      });
    } else {
      checks.push({
        name: "Evento ViewContent",
        status: "warning",
        detail: "ViewContent ausente",
      });
    }

    // 9. UTMs
    if (html.includes("utm_source") || html.includes("pc_utms")) {
      checks.push({
        name: "Captura de UTMs",
        status: "pass",
        detail: "Lógica de UTMs encontrada ✅",
      });
    } else {
      checks.push({
        name: "Captura de UTMs",
        status: "warning",
        detail: "Nenhuma captura de UTMs",
      });
    }

    // 10. fbclid handling
    if (html.includes("fbclid")) {
      checks.push({
        name: "fbclid → _fbc",
        status: "pass",
        detail: "Construção de _fbc a partir de fbclid ativa ✅",
      });
    } else {
      checks.push({
        name: "fbclid → _fbc",
        status: "warning",
        detail: "fbclid não tratado — primeiro PageView pode ter matching baixo",
      });
    }

    // 11. goToCheckout (link decorator)
    if (html.includes("goToCheckout")) {
      checks.push({
        name: "Decorator de checkout",
        status: "pass",
        detail: "window.goToCheckout encontrado — UTMs e fbc/fbp serão propagados ✅",
      });
    } else {
      checks.push({
        name: "Decorator de checkout",
        status: "warning",
        detail: "goToCheckout ausente — UTMs podem não chegar ao checkout",
      });
    }

    // 12. Product ID match
    if (product_id && typeof product_id === "string") {
      if (html.includes(product_id)) {
        checks.push({
          name: "Product ID correto",
          status: "pass",
          detail: `Produto ${product_id.slice(0, 8)}… presente no script ✅`,
        });
      } else {
        checks.push({
          name: "Product ID correto",
          status: "error",
          detail: "Product ID do checkout não encontrado — script pode ser de outro produto",
        });
      }
    }

    const summary = {
      total: checks.length,
      passed: checks.filter((c) => c.status === "pass").length,
      warnings: checks.filter((c) => c.status === "warning").length,
      errors: checks.filter((c) => c.status === "error").length,
    };

    return new Response(
      JSON.stringify({ url, status_code: statusCode, summary, checks }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
