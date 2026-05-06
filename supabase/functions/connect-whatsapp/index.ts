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
  const message = payload?.response?.message ?? payload?.message ?? payload?.error ?? payload;
  if (Array.isArray(message)) return message.join(" ");
  if (typeof message === "string" && message.trim()) return message;
  return "Erro desconhecido";
};

const fetchWithTimeout = async (url: string, init: RequestInit = {}, ms = 10_000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const deleteInstance = async (baseUrl: string, apikey: string, instanceId: string) => {
  const requests: Array<{ url: string; init: RequestInit }> = [
    { url: `${baseUrl}/instance/logout/${instanceId}`, init: { method: "DELETE", headers: { apikey } } },
    { url: `${baseUrl}/instance/delete/${instanceId}`, init: { method: "DELETE", headers: { apikey } } },
  ];
  for (const r of requests) {
    try {
      const res = await fetchWithTimeout(r.url, r.init, 8_000);
      await readResponseBody(res);
    } catch (error) {
      console.warn(`[connect-whatsapp] cleanup ${r.url} failed:`, error);
    }
  }
};

const extractQrCode = (payload: any): string | null => {
  const raw =
    payload?.qrcode?.base64 ??
    payload?.qrcode ??
    payload?.base64 ??
    payload?.data?.qrcode?.base64 ??
    payload?.data?.qrcode ??
    null;
  return typeof raw === "string" ? raw.replace(/\s/g, "") : null;
};

const extractState = (payload: any): string | null => {
  return payload?.instance?.state ?? payload?.state ?? null;
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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user?.id) {
      return json({ error: "Token inválido" }, 401);
    }

    const userId = user.id;
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL")!;
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

    const serviceClient = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: existingSession, error: sessionError } = await serviceClient
      .from("whatsapp_sessions")
      .select("instance_id, status")
      .eq("tenant_id", userId)
      .maybeSingle();

    if (sessionError) throw sessionError;

    // 🧹 STEP 1: Cleanup orphan instances on Evolution that belong to nobody
    // (instances created in past attempts but never persisted in DB)
    try {
      const listRes = await fetchWithTimeout(
        `${EVOLUTION_API_URL}/instance/fetchInstances`,
        { headers: { apikey: EVOLUTION_API_KEY } },
        8_000
      );
      const listPayload = await readResponseBody(listRes);
      const instances = Array.isArray(listPayload)
        ? listPayload
        : Array.isArray(listPayload?.instances)
          ? listPayload.instances
          : [];

      // Find this user's instances by prefix; keep only the one in DB (if any)
      const myInstances = instances
        .map((i: any) => i?.name ?? i?.instance?.instanceName)
        .filter((n: string | undefined): n is string => typeof n === "string" && n.startsWith("pantera_"));

      const dbInstance = existingSession?.instance_id ?? null;

      // Get all DB instance_ids for ALL users so we don't delete other producers' instances
      const { data: allDbSessions } = await serviceClient
        .from("whatsapp_sessions")
        .select("instance_id");
      const allDbInstanceIds = new Set(
        (allDbSessions ?? []).map((s) => s.instance_id).filter(Boolean)
      );

      // Delete only orphans (not in any DB session)
      for (const inst of myInstances) {
        if (inst === dbInstance) continue;
        if (allDbInstanceIds.has(inst)) continue;
        console.log(`[connect-whatsapp] Cleaning up orphan instance: ${inst}`);
        await deleteInstance(EVOLUTION_API_URL, EVOLUTION_API_KEY, inst);
      }
    } catch (err) {
      console.warn("[connect-whatsapp] Orphan cleanup failed (non-blocking):", err);
    }

    // 🔄 STEP 2: If existing session has an instance, try to fetch a FRESH QR for it
    // (avoids creating endless new instances when QR expires)
    if (existingSession?.instance_id) {
      try {
        const stateRes = await fetchWithTimeout(
          `${EVOLUTION_API_URL}/instance/connectionState/${existingSession.instance_id}`,
          { headers: { apikey: EVOLUTION_API_KEY } },
          8_000
        );
        const stateData = await readResponseBody(stateRes);
        const state = extractState(stateData);

        // If instance still exists and is not yet open, reuse it with fresh QR
        if (stateRes.ok && state && state !== "open") {
          const connectRes = await fetchWithTimeout(
            `${EVOLUTION_API_URL}/instance/connect/${existingSession.instance_id}`,
            { headers: { apikey: EVOLUTION_API_KEY } },
            10_000
          );
          const connectData = await readResponseBody(connectRes);
          const freshQr = extractQrCode(connectData);

          if (connectRes.ok && freshQr) {
            console.log(`[connect-whatsapp] Reusing instance ${existingSession.instance_id} with fresh QR`);
            return json({ qrcode: freshQr, instance_id: existingSession.instance_id, reused: true });
          }
        }

        // If instance is already open, no need to create a new one
        if (state === "open") {
          return json({ error: "WhatsApp já está conectado", state: "open", instance_id: existingSession.instance_id }, 409);
        }
      } catch (err) {
        console.warn("[connect-whatsapp] Reuse attempt failed, will create new instance:", err);
      }

      // Reuse failed → delete the stale instance before creating new
      await deleteInstance(EVOLUTION_API_URL, EVOLUTION_API_KEY, existingSession.instance_id);
    }

    // 🆕 STEP 3: Create brand new instance
    const instanceId = `pantera_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

    const evoRes = await fetchWithTimeout(
      `${EVOLUTION_API_URL}/instance/create`,
      {
        method: "POST",
        headers: { apikey: EVOLUTION_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ instanceName: instanceId, qrcode: true, integration: "WHATSAPP-BAILEYS" }),
      },
      10_000
    );

    const evoData = await readResponseBody(evoRes);

    if (!evoRes.ok) {
      console.error("Evolution API error:", evoData);
      if (evoRes.status === 401 || evoRes.status === 403) {
        return json({ error: "Falha na autenticação com a Evolution API", details: "A chave configurada no backend não coincide com AUTHENTICATION_API_KEY da sua Evolution API." }, 502);
      }
      return json({ error: "Falha ao criar instância", details: extractErrorMessage(evoData) }, 500);
    }

    const qrcode = extractQrCode(evoData);

    if (!qrcode) {
      console.error("Evolution API returned no QR code:", evoData);
      return json({ error: "QR Code não retornado pela Evolution API" }, 502);
    }

    // ✅ Auto-register webhook URL on Evolution API
    const webhookUrl = `${SUPABASE_URL}/functions/v1/whatsapp-webhook`;
    try {
      await fetchWithTimeout(
        `${EVOLUTION_API_URL}/webhook/set/${instanceId}`,
        {
          method: "POST",
          headers: { apikey: EVOLUTION_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            url: webhookUrl,
            webhook_by_events: false,
            webhook_base64: false,
            events: ["CONNECTION_UPDATE", "MESSAGES_UPSERT", "MESSAGES_UPDATE"],
          }),
        },
        10_000
      );
      console.log(`[connect-whatsapp] Webhook auto-registered: ${webhookUrl}`);
    } catch (whErr) {
      console.warn("[connect-whatsapp] Webhook registration failed (non-blocking):", whErr);
    }

    const { error: upsertError } = await serviceClient.from("whatsapp_sessions").upsert(
      {
        tenant_id: userId,
        instance_id: instanceId,
        node_url: EVOLUTION_API_URL,
        status: "connecting",
        phone_number: null,
        connected_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id" }
    );

    if (upsertError) throw upsertError;

    return json({ qrcode, instance_id: instanceId });
  } catch (err) {
    console.error("connect-whatsapp error:", err);
    if (err instanceof DOMException && err.name === "AbortError") {
      return json({ error: "Evolution API não respondeu a tempo (timeout 10s)" }, 504);
    }
    return json({ error: "Erro interno do servidor" }, 500);
  }
});
