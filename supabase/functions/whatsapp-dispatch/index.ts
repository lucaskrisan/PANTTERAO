import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const MEDIA_TYPES = ["image", "audio", "video", "document"] as const;

function isMediaType(t: string): boolean {
  return (MEDIA_TYPES as readonly string[]).includes(t);
}

/**
 * whatsapp-dispatch
 *
 * Called internally (service_role) by payment webhooks.
 * 1. Checks if the feature flag for the category is enabled for the tenant.
 * 2. Finds active templates matching the category (supports multiple).
 * 3. Resolves variables ({nome}, {produto}, {valor}, {link}, {telefone}).
 * 4. Processes flow_nodes to send text AND media messages in order.
 * 5. Logs the result in whatsapp_send_log.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json({ error: "Invalid body" }, 400);
    }

    const {
      tenant_id,
      order_id,
      customer_phone,
      customer_name,
      product_name,
      product_price,
      access_link,
      category,
    } = body as Record<string, string | undefined>;

    if (!tenant_id || !category) {
      return json({ error: "tenant_id and category are required" }, 400);
    }

    if (!customer_phone) {
      return json({ skipped: true, reason: "no_phone" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Check feature flag
    const { data: flag } = await supabase
      .from("whatsapp_feature_flags")
      .select("enabled")
      .eq("tenant_id", tenant_id)
      .eq("feature", category)
      .maybeSingle();

    if (flag !== null && flag.enabled === false) {
      return json({ skipped: true, reason: "feature_disabled" });
    }

    // 2. Check if tenant has WhatsApp connected
    const { data: session } = await supabase
      .from("whatsapp_sessions")
      .select("instance_id, status")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    if (!session?.instance_id || session.status !== "connected") {
      return json({ skipped: true, reason: "whatsapp_not_connected" });
    }

    // 3. Find active templates for this category
    const { data: templates } = await supabase
      .from("whatsapp_templates")
      .select("body, flow_nodes")
      .eq("user_id", tenant_id)
      .eq("category", category)
      .eq("active", true)
      .order("updated_at", { ascending: false });

    if (!templates || templates.length === 0) {
      return json({ skipped: true, reason: "no_template" });
    }

    // Pick a random template if multiple exist
    const template = templates.length === 1
      ? templates[0]
      : templates[Math.floor(Math.random() * templates.length)];

    if (!template?.body) {
      return json({ skipped: true, reason: "no_template" });
    }

    // 4. Resolve variables helper
    const priceFormatted = product_price
      ? `R$ ${Number(product_price).toFixed(2).replace(".", ",")}`
      : "";

    const resolveVars = (text: string): string =>
      text
        .replace(/\{nome\}/gi, customer_name || "Cliente")
        .replace(/\{produto\}/gi, product_name || "")
        .replace(/\{valor\}/gi, priceFormatted)
        .replace(/\{link\}/gi, access_link || "")
        .replace(/\{telefone\}/gi, customer_phone || "");

    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL")!;
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY")!;

    let cleanNumber = customer_phone.replace(/\D/g, "");
    if (!cleanNumber.startsWith("55")) {
      cleanNumber = `55${cleanNumber}`;
    }

    // Fix for 11 digit mobile numbers (adding the 9 if missing)
    if (cleanNumber.length === 12 && cleanNumber[4] !== "9") {
      cleanNumber = cleanNumber.slice(0, 4) + "9" + cleanNumber.slice(4);
    }

    const whatsappNumber = `${cleanNumber}@s.whatsapp.net`;
    let sendStatus = "sent";
    let errorMessage: string | null = null;

    // Build ordered message list from flow_nodes or fallback to body
    interface MessageToSend {
      type: string;
      text: string;
      mediaUrl?: string;
    }

    const messagesToSend: MessageToSend[] = [];

    const flowNodes = Array.isArray(template.flow_nodes) ? template.flow_nodes : [];
    const messageNodeTypes = ["text", "image", "audio", "video", "document", "music", "wait"];

    if (flowNodes.length > 0) {
      const nodeMap = new Map<string, any>();
      flowNodes.forEach((n: any) => nodeMap.set(n.id, n));

      const visited = new Set<string>();
      const queue: string[] = [];

      const triggerNode = flowNodes.find((n: any) => n.type === "trigger");
      if (triggerNode) {
        queue.push(...(triggerNode.outputs || []));
      } else {
        flowNodes
          .filter((n: any) => messageNodeTypes.includes(n.type))
          .forEach((n: any) => queue.push(n.id));
      }

      while (queue.length > 0) {
        const nodeId = queue.shift()!;
        if (visited.has(nodeId)) continue;
        visited.add(nodeId);

        const node = nodeMap.get(nodeId);
        if (!node) continue;

        if (messageNodeTypes.includes(node.type)) {
          if (node.type === "wait") {
            const time = parseInt(node.config?.waitTime || "0");
            const unit = node.config?.waitUnit || "minutos";
            let ms = time * 60 * 1000;
            if (unit === "horas") ms = time * 60 * 60 * 1000;
            if (unit === "dias") ms = time * 24 * 60 * 60 * 1000;
            
            if (ms > 0) {
              console.log(`[whatsapp-dispatch] Waiting ${time} ${unit} (${ms}ms)`);
              await new Promise((r) => setTimeout(r, Math.min(ms, 30000))); // Cap at 30s for edge functions
            }
          } else {
            const nodeType = node.type === "music" ? "audio" : node.type;
            const text = resolveVars(node.config?.body || "");
            const mediaUrl = node.config?.media_url?.trim() || "";

            if (isMediaType(nodeType) && mediaUrl) {
              messagesToSend.push({ type: nodeType, text, mediaUrl });
            } else if (text) {
              messagesToSend.push({ type: "text", text, mediaUrl: undefined });
            }
          }
        }

        if (Array.isArray(node.outputs)) {
          node.outputs.forEach((out: string) => {
            if (!visited.has(out)) queue.push(out);
          });
        }
      }
    }

    // Fallback: if no nodes produced messages, send the template body as text
    if (messagesToSend.length === 0) {
      messagesToSend.push({ type: "text", text: resolveVars(template.body), mediaUrl: undefined });
    }

    // 5. Send all messages sequentially with ✅ 10s timeout per request
    try {
      for (const msg of messagesToSend) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);

        let sendRes: Response;

        if (msg.type !== "text" && msg.mediaUrl) {
          sendRes = await fetch(
            `${EVOLUTION_API_URL}/message/sendMedia/${session.instance_id}`,
            {
              method: "POST",
              headers: { apikey: EVOLUTION_API_KEY, "Content-Type": "application/json" },
              body: JSON.stringify({
                number: whatsappNumber,
                mediatype: msg.type,
                media: msg.mediaUrl,
                caption: msg.text || undefined,
              }),
              signal: controller.signal,
            }
          );
        } else {
          sendRes = await fetch(
            `${EVOLUTION_API_URL}/message/sendText/${session.instance_id}`,
            {
              method: "POST",
              headers: { apikey: EVOLUTION_API_KEY, "Content-Type": "application/json" },
              body: JSON.stringify({ number: whatsappNumber, text: msg.text }),
              signal: controller.signal,
            }
          );
        }
        clearTimeout(timeout);

        if (!sendRes.ok) {
          const errBody = await sendRes.text().catch(() => "");
          let parsedError = errBody;
          try {
            const payload = JSON.parse(errBody);
            // Evolution API returns 400 with exists:false when number is not on WhatsApp
            if (payload?.response?.message?.[0]?.exists === false || 
                payload?.message?.[0]?.exists === false ||
                (Array.isArray(payload?.response) && payload?.response[0]?.exists === false)) {
              parsedError = "Número não existe no WhatsApp";
            } else {
              parsedError = payload?.response?.message ?? payload?.message ?? payload?.error ?? errBody;
            }
          } catch {
            // Keep original if not JSON
          }
          
          sendStatus = "failed";
          errorMessage = typeof parsedError === 'string' ? parsedError.slice(0, 200) : JSON.stringify(parsedError).slice(0, 200);
          break;
        }

        // Small delay between messages to avoid rate limiting
        if (messagesToSend.length > 1) {
          await new Promise((r) => setTimeout(r, 800));
        }
      }
    } catch (err) {
      sendStatus = "failed";
      if (err instanceof DOMException && err.name === "AbortError") {
        errorMessage = "Evolution API timeout (10s)";
      } else {
        errorMessage = err instanceof Error ? err.message : "Unknown send error";
      }
    }

    // 6. Log
    const mainMessage = messagesToSend.map((m) =>
      m.type === "text" ? m.text : `[${m.type}] ${m.mediaUrl} ${m.text ? "— " + m.text : ""}`
    ).join("\n---\n");

    await supabase.from("whatsapp_send_log").insert({
      tenant_id,
      order_id: order_id || null,
      customer_phone,
      template_category: category,
      message_body: mainMessage.slice(0, 4000),
      status: sendStatus,
      error_message: errorMessage,
    });

    return json({ success: sendStatus === "sent", status: sendStatus });
  } catch (err) {
    console.error("whatsapp-dispatch error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
