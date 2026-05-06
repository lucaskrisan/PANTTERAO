import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const fetchWithTimeout = async (url: string, init: RequestInit, timeoutMs = 10000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
};

const readResponseBody = async (res: Response) => {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Não autorizado" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // FIX: Use getUser() instead of getClaims() for reliability across SDK versions
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user?.id) {
      return json({ error: "Token inválido" }, 401);
    }

    const userId = userData.user.id;
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL")!;
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY")!;

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: sessionRow, error: sessionError } = await serviceClient
      .from("whatsapp_sessions")
      .select("instance_id")
      .eq("tenant_id", userId)
      .maybeSingle();

    if (sessionError) throw sessionError;

    const statuses: number[] = [];
    if (sessionRow?.instance_id) {
      const requests: Array<{ url: string; init: RequestInit }> = [
        {
          url: `${EVOLUTION_API_URL}/instance/logout/${sessionRow.instance_id}`,
          init: { method: "DELETE", headers: { apikey: EVOLUTION_API_KEY } },
        },
        {
          url: `${EVOLUTION_API_URL}/instance/delete/${sessionRow.instance_id}`,
          init: { method: "DELETE", headers: { apikey: EVOLUTION_API_KEY } },
        },
        {
          url: `${EVOLUTION_API_URL}/instance/delete`,
          init: {
            method: "DELETE",
            headers: { apikey: EVOLUTION_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ instanceName: sessionRow.instance_id }),
          },
        },
      ];

      for (const request of requests) {
        try {
          const response = await fetchWithTimeout(request.url, request.init, 10000);
          statuses.push(response.status);
          await readResponseBody(response);
        } catch (error) {
          console.error("disconnect-whatsapp cleanup error:", error);
        }
      }
    }

    if (statuses.length > 0 && statuses.every((status) => status === 401 || status === 403)) {
      return json(
        {
          error: "Falha na autenticação com a Evolution API",
          details:
            "A chave configurada no backend não coincide com AUTHENTICATION_API_KEY da sua Evolution API.",
        },
        502
      );
    }

    const { error: updateError } = await serviceClient
      .from("whatsapp_sessions")
      .update({
        status: "disconnected",
        phone_number: null,
        connected_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", userId);

    if (updateError) throw updateError;

    return json({ success: true });
  } catch (err) {
    console.error("disconnect-whatsapp error:", err);
    return json({ error: "Erro interno do servidor" }, 500);
  }
});
