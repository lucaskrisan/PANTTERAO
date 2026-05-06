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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apikey = req.headers.get("apikey");
    const expectedKey = Deno.env.get("EVOLUTION_API_KEY");

    // Constant-time comparison to prevent timing attacks
    const timingSafeEqual = (a: string, b: string): boolean => {
      if (a.length !== b.length) return false;
      let diff = 0;
      for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
      return diff === 0;
    };

    if (!apikey || !expectedKey || !timingSafeEqual(apikey, expectedKey)) {
      return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json();
    const event = body?.event;

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ═══════════════════════════════════════════════════════
    // Event: CONNECTION_UPDATE — update session status
    // ═══════════════════════════════════════════════════════
    if (event === "connection.update" || event === "CONNECTION_UPDATE") {
      const instanceName = body?.instance ?? body?.data?.instance?.instanceName ?? body?.data?.instanceName;
      const state = body?.data?.state ?? body?.state;

      if (instanceName && state) {
        const mappedStatus = state === "open" ? "connected" : state === "connecting" ? "connecting" : "disconnected";
        const updateData: Record<string, string | null> = {
          status: mappedStatus,
          updated_at: new Date().toISOString(),
        };

        if (state === "open") {
          updateData.connected_at = new Date().toISOString();
          const ownerJid = body?.data?.ownerJid ?? body?.data?.instance?.ownerJid ?? null;
          if (typeof ownerJid === "string" && ownerJid) {
            updateData.phone_number = ownerJid.replace("@s.whatsapp.net", "");
          }
        }

        if (mappedStatus === "disconnected") {
          updateData.connected_at = null;
          updateData.phone_number = null;
        }

        await serviceClient.from("whatsapp_sessions").update(updateData).eq("instance_id", instanceName);
      }
    }

    // ═══════════════════════════════════════════════════════
    // Event: MESSAGES_UPDATE — delivery/read receipts
    // ═══════════════════════════════════════════════════════
    if (event === "messages.update" || event === "MESSAGES_UPDATE") {
      const updates = body?.data;
      const items = Array.isArray(updates) ? updates : updates ? [updates] : [];

      for (const item of items) {
        const messageId = item?.key?.id ?? item?.id;
        const status = item?.update?.status ?? item?.status;

        if (!messageId || !status) continue;

        // Map Evolution API status codes to readable values
        // 2 = sent (server), 3 = delivered, 4 = read, 5 = played (audio/video read)
        let deliveryStatus: string | null = null;
        const updatePayload: Record<string, string> = {};

        if (status === 3 || status === "DELIVERY_ACK" || status === "delivered") {
          deliveryStatus = "delivered";
          updatePayload.delivered_at = new Date().toISOString();
        } else if (status === 4 || status === 5 || status === "READ" || status === "PLAYED" || status === "read") {
          deliveryStatus = "read";
          updatePayload.read_at = new Date().toISOString();
          // Also set delivered_at if not yet set
          updatePayload.delivered_at = new Date().toISOString();
        } else if (status === "ERROR" || status === "error" || status === 0) {
          deliveryStatus = "failed";
        }

        if (deliveryStatus) {
          updatePayload.delivery_status = deliveryStatus;

          const { error } = await serviceClient
            .from("whatsapp_send_log")
            .update(updatePayload)
            .eq("external_message_id", messageId);

          if (error) {
            console.warn(`[whatsapp-webhook] Failed to update delivery status for ${messageId}:`, error.message);
          } else {
            console.log(`[whatsapp-webhook] Updated delivery: ${messageId} → ${deliveryStatus}`);
          }
        }
      }
    }

    // ═══════════════════════════════════════════════════════
    // Event: MESSAGES_UPSERT — capture outgoing message IDs
    // ═══════════════════════════════════════════════════════
    if (event === "messages.upsert" || event === "MESSAGES_UPSERT") {
      const messages = body?.data;
      const items = Array.isArray(messages) ? messages : messages ? [messages] : [];

      for (const msg of items) {
        const key = msg?.key;
        if (!key?.fromMe) continue; // Only track outgoing messages

        const messageId = key?.id;
        const remoteJid = key?.remoteJid;

        if (!messageId || !remoteJid) continue;

        // Extract phone number from JID
        const phone = remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");

        // Try to link this message ID to a recent send_log entry
        // Match by phone number + recent timestamp (last 30 seconds)
        const thirtySecondsAgo = new Date(Date.now() - 30_000).toISOString();

        const { error } = await serviceClient
          .from("whatsapp_send_log")
          .update({
            external_message_id: messageId,
            delivery_status: "server",
          })
          .is("external_message_id", null)
          .ilike("customer_phone", `%${phone.slice(-8)}`)
          .gte("created_at", thirtySecondsAgo)
          .order("created_at", { ascending: false })
          .limit(1);

        if (error) {
          console.warn(`[whatsapp-webhook] Failed to link message ID ${messageId}:`, error.message);
        }
      }
    }

    return json({ received: true });
  } catch (err) {
    console.error("whatsapp-webhook error:", err);
    return json({ received: true });
  }
});
