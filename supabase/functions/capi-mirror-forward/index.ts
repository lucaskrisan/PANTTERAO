// Edge Function: capi-mirror-forward
// Receives a sanitized event payload and forwards it (CAPI-only) to all
// active mirror_pixels. No browser side, no fbevents.js — Meta cannot crawl
// the source domain because there's no browser context. This isolates new
// pixels from incorrect categorization (e.g. "Financial").
//
// Called fire-and-forget by facebook-capi after the primary CAPI dispatch.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ForwardPayload {
  event_name: string;
  event_time: number;
  event_id?: string; // we'll suffix to avoid dedup collision with primary pixel
  event_source_url?: string;
  action_source?: string;
  user_data: Record<string, unknown>;
  custom_data?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as ForwardPayload;
    if (!payload?.event_name || !payload?.user_data) {
      return new Response(JSON.stringify({ error: 'invalid payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: mirrors } = await supabase
      .from('mirror_pixels')
      .select('id, pixel_id, capi_token, fire_on_events, event_source_url_override, total_events_sent')
      .eq('active', true);

    if (!mirrors || mirrors.length === 0) {
      return new Response(JSON.stringify({ success: true, mirrors: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: Array<Record<string, unknown>> = [];

    for (const m of mirrors) {
      const allowedEvents: string[] = (m.fire_on_events as string[]) || [];
      if (allowedEvents.length > 0 && !allowedEvents.includes(payload.event_name)) {
        continue;
      }

      // Suffix event_id so dedup against primary pixel doesn't collide
      const mirroredEventId = payload.event_id
        ? `${payload.event_id}-mir-${m.pixel_id.slice(-6)}`
        : `mir-${crypto.randomUUID()}`;

      const event = {
        event_name: payload.event_name,
        event_time: payload.event_time || Math.floor(Date.now() / 1000),
        event_id: mirroredEventId,
        event_source_url:
          m.event_source_url_override ||
          payload.event_source_url ||
          'https://app.panttera.com.br/',
        action_source: payload.action_source || 'website',
        user_data: payload.user_data,
        ...(payload.custom_data ? { custom_data: payload.custom_data } : {}),
      };

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(
          `https://graph.facebook.com/v22.0/${m.pixel_id}/events`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: [event], access_token: m.capi_token }),
            signal: controller.signal,
          }
        );
        clearTimeout(timeout);

        const meta = await response.json();
        const ok = response.ok;
        console.log(
          `[capi-mirror-forward] pixel=${m.pixel_id} event=${payload.event_name} ok=${ok}`
        );

        // Update counters (fire-and-forget)
        await supabase
          .from('mirror_pixels')
          .update({
            total_events_sent: (m.total_events_sent || 0) + 1,
            last_event_at: new Date().toISOString(),
            last_meta_response: meta,
          })
          .eq('id', m.id);

        results.push({ pixel_id: m.pixel_id, success: ok, http_status: response.status });
      } catch (err) {
        console.error(`[capi-mirror-forward] pixel=${m.pixel_id} error:`, err);
        results.push({
          pixel_id: m.pixel_id,
          success: false,
          error: (err as Error).message,
        });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[capi-mirror-forward] fatal:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
