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

const readResponseBody = async (res: Response) => {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const extractErrorMessage = (payload: any) => {
  const firstMsg = payload?.response?.message?.[0] ?? payload?.message?.[0];
  if (firstMsg?.exists === false) {
    return "Número não encontrado no WhatsApp.";
  }
  const message = payload?.response?.message ?? payload?.message ?? payload?.error ?? payload;
  if (Array.isArray(message)) {
    if (typeof message[0] === 'object') return JSON.stringify(message[0]);
    return message.join(" ");
  }
  if (typeof message === "string" && message.trim()) return message;
  return "Erro desconhecido";
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

    // ✅ Use getUser() instead of getClaims()
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user?.id) {
      return json({ error: "Token inválido" }, 401);
    }

    const userId = user.id;
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL")!;
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY")!;

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: sessionRow, error: sessionError } = await serviceClient
      .from("whatsapp_sessions")
      .select("instance_id, phone_number")
      .eq("tenant_id", userId)
      .maybeSingle();

    if (sessionError) throw sessionError;

    if (!sessionRow?.instance_id) {
      return json({ state: "close", phone_number: null });
    }

    // ✅ Add 10s timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const stateRes = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${sessionRow.instance_id}`, {
      headers: { apikey: EVOLUTION_API_KEY },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const stateData = await readResponseBody(stateRes);

    if (!stateRes.ok) {
      console.error("check-whatsapp-status upstream error:", stateData);
      if (stateRes.status === 401 || stateRes.status === 403) {
        return json({ error: "Falha na autenticação com a Evolution API", details: "A chave configurada no backend não coincide com AUTHENTICATION_API_KEY da sua Evolution API." }, 502);
      }
      return json({ error: "Falha ao consultar status do WhatsApp", details: extractErrorMessage(stateData) }, 500);
    }

    const state = stateData?.instance?.state ?? stateData?.state ?? "close";
    let phoneNumber = sessionRow.phone_number ?? null;

    if (state === "open") {
      try {
        const instController = new AbortController();
        const instTimeout = setTimeout(() => instController.abort(), 10_000);
        const instancesRes = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
          headers: { apikey: EVOLUTION_API_KEY },
          signal: instController.signal,
        });
        clearTimeout(instTimeout);

        const instancesPayload = await readResponseBody(instancesRes);
        const instances = Array.isArray(instancesPayload)
          ? instancesPayload
          : Array.isArray(instancesPayload?.instances)
            ? instancesPayload.instances
            : [];

        const mine = instances.find(
          (item: any) =>
            item?.instance?.instanceName === sessionRow.instance_id || item?.instanceName === sessionRow.instance_id
        );

        const ownerJid = mine?.instance?.ownerJid ?? mine?.ownerJid ?? "";
        if (typeof ownerJid === "string" && ownerJid) {
          phoneNumber = ownerJid.replace("@s.whatsapp.net", "");
        }
      } catch (error) {
        console.error("Error fetching instances:", error);
      }

      const { error: updateError } = await serviceClient
        .from("whatsapp_sessions")
        .update({
          status: "connected",
          connected_at: new Date().toISOString(),
          phone_number: phoneNumber,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", userId);

      if (updateError) throw updateError;
    } else {
      const mappedStatus = state === "connecting" ? "connecting" : "disconnected";
      const updatePayload: Record<string, string | null> = {
        status: mappedStatus,
        updated_at: new Date().toISOString(),
      };

      if (mappedStatus === "disconnected") {
        updatePayload.phone_number = null;
        updatePayload.connected_at = null;
        phoneNumber = null;
      }

      const { error: updateError } = await serviceClient
        .from("whatsapp_sessions")
        .update(updatePayload)
        .eq("tenant_id", userId);

      if (updateError) throw updateError;
    }

    return json({ state, phone_number: phoneNumber, instance_id: sessionRow.instance_id });
  } catch (err) {
    console.error("check-whatsapp-status error:", err);
    if (err instanceof DOMException && err.name === "AbortError") {
      return json({ error: "Evolution API não respondeu a tempo (timeout 10s)" }, 504);
    }
    return json({ error: "Erro interno do servidor" }, 500);
  }
});
