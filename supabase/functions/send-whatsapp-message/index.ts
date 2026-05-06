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
  // Evolution API returns 400 with exists:false when number is not on WhatsApp
  const firstMsg = payload?.response?.message?.[0] ?? payload?.message?.[0];
  if (firstMsg?.exists === false) {
    return "Este número não possui WhatsApp ativo.";
  }

  const message = payload?.response?.message ?? payload?.message ?? payload?.error ?? payload;
  if (Array.isArray(message)) {
    if (typeof message[0] === 'object') return JSON.stringify(message[0]);
    return message.join(" ");
  }
  if (typeof message === "string" && message.trim()) return message;
  return "Erro desconhecido";
};

const MEDIA_TYPES = ["image", "audio", "video", "document"] as const;
type MediaType = typeof MEDIA_TYPES[number];

function isMediaType(t: string): t is MediaType {
  return MEDIA_TYPES.includes(t as MediaType);
}

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
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return json({ error: "Corpo da requisição inválido" }, 400);
    }

    const toNumberInput = typeof body.to_number === "string" ? body.to_number : String(body.to_number ?? "");
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const mediaType = typeof body.media_type === "string" ? body.media_type : null;
    const mediaUrl = typeof body.media_url === "string" ? body.media_url.trim() : "";
    const pendingSendId = typeof body.pending_send_id === "string" ? body.pending_send_id : null;

    if (!toNumberInput) {
      return json({ error: "to_number é obrigatório" }, 400);
    }

    if (!mediaType && !message) {
      return json({ error: "message é obrigatório para mensagens de texto" }, 400);
    }

    if (mediaType && !isMediaType(mediaType)) {
      return json({ error: `media_type inválido. Use: ${MEDIA_TYPES.join(", ")}` }, 400);
    }

    if (mediaType && !mediaUrl) {
      return json({ error: "media_url é obrigatório para mensagens de mídia" }, 400);
    }

    if (mediaUrl) {
      try {
        new URL(mediaUrl);
      } catch {
        return json({ error: "media_url não é uma URL válida" }, 400);
      }
    }

    let cleanNumber = toNumberInput.replace(/\D/g, "");
    if (!cleanNumber.startsWith("55")) {
      cleanNumber = `55${cleanNumber}`;
    }

    // Fix for 11 digit mobile numbers (adding the 9 if missing)
    if (cleanNumber.length === 12 && cleanNumber[4] !== "9") {
      cleanNumber = cleanNumber.slice(0, 4) + "9" + cleanNumber.slice(4);
    }

    if (cleanNumber.length < 12 || cleanNumber.length > 15) {
      return json({ error: "Número de destino inválido" }, 400);
    }

    if (message.length > 4096) {
      return json({ error: "Mensagem muito longa" }, 400);
    }

    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL")!;
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY")!;

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: sessionRow, error: sessionError } = await serviceClient
      .from("whatsapp_sessions")
      .select("instance_id, status")
      .eq("tenant_id", userId)
      .maybeSingle();

    if (sessionError) throw sessionError;

    if (!sessionRow?.instance_id) {
      return json({ error: "WhatsApp não conectado" }, 404);
    }

    if (sessionRow.status !== "connected") {
      return json({ error: "WhatsApp ainda não está conectado" }, 409);
    }

    const whatsappNumber = `${cleanNumber}@s.whatsapp.net`;

    // ✅ Add 10s timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    let sendRes: Response;

    if (mediaType && mediaUrl) {
      sendRes = await fetch(`${EVOLUTION_API_URL}/message/sendMedia/${sessionRow.instance_id}`, {
        method: "POST",
        headers: { apikey: EVOLUTION_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ number: whatsappNumber, mediatype: mediaType, media: mediaUrl, caption: message || undefined }),
        signal: controller.signal,
      });
    } else {
      sendRes = await fetch(`${EVOLUTION_API_URL}/message/sendText/${sessionRow.instance_id}`, {
        method: "POST",
        headers: { apikey: EVOLUTION_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ number: whatsappNumber, text: message }),
        signal: controller.signal,
      });
    }
    clearTimeout(timeout);

    const sendData = await readResponseBody(sendRes);

    if (sendRes.ok) {
      if (pendingSendId) {
        await serviceClient
          .from("pending_sends")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", pendingSendId)
          .eq("tenant_id", userId);
      }
      return json({ success: true });
    }

    console.error("send-whatsapp-message error:", sendData);

    if (pendingSendId) {
      await serviceClient
        .from("pending_sends")
        .update({ status: "failed" })
        .eq("id", pendingSendId)
        .eq("tenant_id", userId);
    }

    if (sendRes.status === 401 || sendRes.status === 403) {
      return json({ error: "Falha na autenticação com a Evolution API", details: "A chave configurada no backend não coincide com AUTHENTICATION_API_KEY da sua Evolution API." }, 502);
    }

    return json({ success: false, error: "Falha ao enviar mensagem", details: extractErrorMessage(sendData) }, 500);
  } catch (err) {
    console.error("send-whatsapp-message error:", err);
    if (err instanceof DOMException && err.name === "AbortError") {
      return json({ error: "Evolution API não respondeu a tempo (timeout 10s)" }, 504);
    }
    return json({ error: "Erro interno do servidor" }, 500);
  }
});
