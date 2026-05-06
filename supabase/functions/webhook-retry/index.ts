import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const RETRY_DELAYS = [5, 30, 120]; // seconds
const TIMEOUT_MS = 5000;

async function createHmacSignature(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch deliveries due for retry
    const { data: deliveries } = await supabase
      .from('webhook_deliveries')
      .select('*, webhook_endpoints(url, secret)')
      .eq('status', 'retrying')
      .lte('next_retry_at', new Date().toISOString())
      .limit(50);

    if (!deliveries || deliveries.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const delivery of deliveries) {
      const ep = delivery.webhook_endpoints as any;
      if (!ep?.url) continue;

      const bodyStr = JSON.stringify(delivery.payload);
      const signature = await createHmacSignature(ep.secret, bodyStr);
      const newAttempt = delivery.attempt + 1;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      let respStatus = 0;
      let respBody = '';
      let success = false;

      try {
        const resp = await fetch(ep.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-panttera-signature': signature,
            'x-panttera-event': delivery.event_type,
            'User-Agent': 'Panttera-Webhooks/1.0',
          },
          body: bodyStr,
          signal: controller.signal,
        });
        clearTimeout(timeout);
        respStatus = resp.status;
        try { respBody = (await resp.text()).substring(0, 2000); } catch { respBody = ''; }
        success = resp.ok;
      } catch (err) {
        clearTimeout(timeout);
        respBody = (err as Error).message;
      }

      if (success) {
        await supabase
          .from('webhook_deliveries')
          .update({
            status: 'success',
            attempt: newAttempt,
            last_response_status: respStatus,
            last_response_body: respBody,
            completed_at: new Date().toISOString(),
            next_retry_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', delivery.id);
        succeeded++;
      } else if (newAttempt >= delivery.max_attempts) {
        // Dead letter — max retries exceeded
        await supabase
          .from('webhook_deliveries')
          .update({
            status: 'failed',
            attempt: newAttempt,
            last_response_status: respStatus,
            last_response_body: respBody,
            last_error: respBody,
            next_retry_at: null,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', delivery.id);
        failed++;
      } else {
        // Schedule next retry with exponential backoff
        const delayIdx = Math.min(newAttempt - 1, RETRY_DELAYS.length - 1);
        const nextRetry = new Date(Date.now() + RETRY_DELAYS[delayIdx] * 1000).toISOString();

        await supabase
          .from('webhook_deliveries')
          .update({
            status: 'retrying',
            attempt: newAttempt,
            last_response_status: respStatus,
            last_response_body: respBody,
            last_error: respBody,
            next_retry_at: nextRetry,
            updated_at: new Date().toISOString(),
          })
          .eq('id', delivery.id);
      }

      processed++;
    }

    console.log(`[webhook-retry] Processed: ${processed}, Success: ${succeeded}, Failed: ${failed}`);

    return new Response(
      JSON.stringify({ success: true, processed, succeeded, failed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[webhook-retry] Error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
