// Marca uma ordem Stripe (criada como pending por create-stripe-payment) como
// "failed" quando o cliente confirma o pagamento e o cartão é recusado pelo
// Stripe Elements. Necessário porque, nesse caso, o webhook payment_intent.payment_failed
// pode não disparar (o PI fica em requires_payment_method).
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { order_id, payment_intent_id, reason } = body || {};

    if (!order_id && !payment_intent_id) {
      return new Response(
        JSON.stringify({ error: "order_id or payment_intent_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find the order. Only update if currently pending (idempotent + non-destructive).
    const query = supabase.from("orders").select("id, status, metadata").limit(1);
    const { data: rows, error: findErr } = order_id
      ? await query.eq("id", order_id)
      : await query.eq("external_id", payment_intent_id);

    if (findErr) throw findErr;
    const order = rows?.[0];
    if (!order) {
      return new Response(
        JSON.stringify({ ok: true, skipped: "order_not_found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (order.status !== "pending") {
      return new Response(
        JSON.stringify({ ok: true, skipped: `status=${order.status}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newMetadata = {
      ...(order.metadata || {}),
      failure_reason: typeof reason === "string" ? reason.slice(0, 500) : "card_declined",
      failed_at: new Date().toISOString(),
    };

    const { error: updateErr } = await supabase
      .from("orders")
      .update({ status: "failed", metadata: newMetadata, updated_at: new Date().toISOString() })
      .eq("id", order.id)
      .eq("status", "pending"); // optimistic guard

    if (updateErr) throw updateErr;

    return new Response(
      JSON.stringify({ ok: true, order_id: order.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[mark-stripe-order-failed]", err?.message || err);
    return new Response(
      JSON.stringify({ error: err?.message || "internal_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
