import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BinResult {
  bin: string;
  scheme: string | null;
  brand: string | null;
  bank_name: string | null;
  country_alpha2: string | null;
  source: "cache" | "binlist" | "fallback";
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const rawBin = (url.searchParams.get("bin") || "").replace(/\D/g, "").slice(0, 8);

    if (rawBin.length < 6) {
      return json({ error: "BIN must be at least 6 digits" }, 400);
    }
    const bin = rawBin.slice(0, 6);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // 1) Cache
    const { data: cached } = await admin
      .from("bin_cache")
      .select("bin, scheme, brand, bank_name, country_alpha2")
      .eq("bin", bin)
      .maybeSingle();

    if (cached) {
      return json({ ...cached, source: "cache" } as BinResult);
    }

    // 2) binlist.net (free, rate-limited — falha silenciosa)
    let result: BinResult | null = null;
    try {
      const resp = await fetch(`https://lookup.binlist.net/${bin}`, {
        headers: { "Accept-Version": "3" },
      });
      if (resp.ok) {
        const data = await resp.json();
        result = {
          bin,
          scheme: data?.scheme ?? null,
          brand: data?.brand ?? null,
          bank_name: data?.bank?.name ?? null,
          country_alpha2: data?.country?.alpha2 ?? null,
          source: "binlist",
        };
        // Persist cache (fire-and-forget)
        await admin.from("bin_cache").upsert({
          bin,
          scheme: result.scheme,
          brand: result.brand,
          bank_name: result.bank_name,
          country_alpha2: result.country_alpha2,
          raw: data,
          updated_at: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error("binlist lookup failed", e);
    }

    if (!result) {
      return json({
        bin,
        scheme: null,
        brand: null,
        bank_name: null,
        country_alpha2: null,
        source: "fallback",
      } as BinResult);
    }

    return json(result);
  } catch (err) {
    console.error("bin-lookup error", err);
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}