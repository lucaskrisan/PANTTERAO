// Public router for A/B tests.
// URL pattern: /functions/v1/ab-redirect/{slug}?type=page|checkout
// Sets a sticky cookie `_abv_<slug>` so the same visitor always sees the same variant.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getCookie(req: Request, name: string): string | null {
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function genVisitorId(): string {
  return crypto.randomUUID();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    // path comes as /ab-redirect/<slug> after function name
    const parts = url.pathname.split("/").filter(Boolean);
    const slug = parts[parts.length - 1];
    const linkType = (url.searchParams.get("type") ?? "page").toLowerCase() === "checkout" ? "checkout" : "page";

    if (!slug || slug === "ab-redirect") {
      return new Response(JSON.stringify({ error: "missing_slug" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const visitorCookieName = `_abv_${slug}`;
    let visitorId = getCookie(req, visitorCookieName);
    let setCookie = false;
    if (!visitorId) {
      visitorId = genVisitorId();
      setCookie = true;
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase.rpc("ab_pick_variant", {
      p_test_slug: slug,
      p_visitor_id: visitorId,
      p_link_type: linkType,
    });

    if (error) {
      console.error("[ab-redirect] rpc error", error);
      return new Response(JSON.stringify({ error: "rpc_error", detail: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = data as Record<string, unknown> | null;
    if (!result || result.error) {
      return new Response(JSON.stringify({ error: result?.error ?? "no_result" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const redirectUrl = (result.redirect_url as string) ?? "";
    if (!redirectUrl) {
      return new Response(JSON.stringify({ error: "variant_missing_url" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build redirect with sticky cookie + visitor_id propagated as query for sale tracking
    // Preserve original query parameters from the request
    const finalUrl = new URL(redirectUrl);
    url.searchParams.forEach((value, key) => {
      if (key !== "type") { // Skip internal param
        finalUrl.searchParams.set(key, value);
      }
    });
    finalUrl.searchParams.set("_abv", visitorId);
    finalUrl.searchParams.set("_abt", slug);

    const headers: Record<string, string> = {
      ...corsHeaders,
      Location: finalUrl.toString(),
      "Cache-Control": "no-store",
    };
    if (setCookie) {
      // 30 days sticky
      headers["Set-Cookie"] = `${visitorCookieName}=${visitorId}; Path=/; Max-Age=2592000; SameSite=Lax`;
    }

    return new Response(null, { status: 302, headers });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ab-redirect] fatal", msg);
    return new Response(JSON.stringify({ error: "fatal", detail: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
