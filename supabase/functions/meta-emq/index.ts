import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface EmqEvent {
  event_name: string;
  emq_score: number | null;
  match_keys: { key: string; coverage: number }[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let authenticatedUserId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
      if (token !== anonKey) {
        const userClient = createClient(
          Deno.env.get('SUPABASE_URL')!,
          anonKey,
          { global: { headers: { Authorization: authHeader } } }
        );
        const { data: { user }, error } = await userClient.auth.getUser();
        if (error || !user) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        authenticatedUserId = user.id;
      }
    }

    const { product_id } = await req.json();

    if (!product_id) {
      return new Response(
        JSON.stringify({ error: 'product_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get pixels with CAPI tokens for this product (scoped to user if not service role)
    let pixelQuery = supabase
      .from('product_pixels')
      .select('pixel_id, capi_token')
      .eq('product_id', product_id)
      .eq('platform', 'facebook')
      .not('capi_token', 'is', null);

    if (authenticatedUserId) {
      pixelQuery = pixelQuery.eq('user_id', authenticatedUserId);
    }

    const { data: pixels } = await pixelQuery;

    if (!pixels || pixels.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhum pixel com CAPI configurado para este produto' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }


    // Use global META_ACCESS_TOKEN for read operations (has ads_read permission)
    // Fall back to per-pixel capi_token if not available
    const globalToken = Deno.env.get('META_ACCESS_TOKEN');

    const results: any[] = [];

    for (const pixel of pixels) {
      const readToken = globalToken || pixel.capi_token;
      const pixelResult: any = {
        pixel_id: pixel.pixel_id,
        events: [] as EmqEvent[],
        error: null,
      };

      try {
        const fetchWithTimeout = async (url: string, timeoutMs = 10000) => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), timeoutMs);
          try {
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);
            return res;
          } catch (err) {
            clearTimeout(timeout);
            throw err;
          }
        };

        // Fetch event quality data from Meta Graph API
        const response = await fetchWithTimeout(
          `https://graph.facebook.com/v22.0/${pixel.pixel_id}?fields=name,event_stats&access_token=${readToken}`
        );
        const pixelData = await response.json();

        if (pixelData.error) {
          pixelResult.error = pixelData.error.message;
          pixelResult.pixel_name = null;
        } else {
          pixelResult.pixel_name = pixelData.name || pixel.pixel_id;
        }

        // Fetch diagnostic data via data_sources edge 
        const diagResponse = await fetchWithTimeout(
          `https://graph.facebook.com/v22.0/${pixel.pixel_id}/events?fields=event_name,event_count,event_match_quality&access_token=${readToken}`
        );
        const diagData = await diagResponse.json();

        if (diagData.data && Array.isArray(diagData.data)) {
          pixelResult.events = diagData.data.map((ev: any) => ({
            event_name: ev.event_name,
            event_count: ev.event_count || 0,
            emq_score: ev.event_match_quality?.score ?? null,
            match_keys: ev.event_match_quality?.match_keys || [],
          }));
        }

        // Also try the server_events endpoint for CAPI-specific quality
        const serverResponse = await fetchWithTimeout(
          `https://graph.facebook.com/v22.0/${pixel.pixel_id}/server_events?fields=event_name,event_time&access_token=${readToken}`
        );
        const serverData = await serverResponse.json();
        pixelResult.server_events_available = !serverData.error;

        // Try the direct EMQ endpoint 
        const emqResponse = await fetchWithTimeout(
          `https://graph.facebook.com/v22.0/${pixel.pixel_id}?fields=data_use_setting,event_bridge_setting,first_party_cookie_status&access_token=${readToken}`
        );
        const emqData = await emqResponse.json();
        if (!emqData.error) {
          pixelResult.settings = {
            data_use_setting: emqData.data_use_setting || 'unknown',
            event_bridge_setting: emqData.event_bridge_setting || 'unknown',
            first_party_cookie_status: emqData.first_party_cookie_status || 'unknown',
          };
        }

      } catch (err: any) {
        pixelResult.error = err.message;
      }

      results.push(pixelResult);
    }

    // Also calculate internal EMQ based on our pixel_events data (last 7 days)
    const { data: internalEvents } = await supabase
      .from('pixel_events')
      .select('event_name, source, event_id, visitor_id')
      .eq('product_id', product_id)
      .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString());

    const internalMetrics: any = {};
    if (internalEvents) {
      // Group by event_name
      const eventGroups: Record<string, { browser: number; server: number; dual: number; withVid: number; total: number }> = {};
      
      // Group events by event_id to check DUAL
      const eventIdMap: Record<string, Set<string>> = {};
      for (const ev of internalEvents) {
        if (!eventGroups[ev.event_name]) {
          eventGroups[ev.event_name] = { browser: 0, server: 0, dual: 0, withVid: 0, total: 0 };
        }
        eventGroups[ev.event_name].total++;
        if (ev.source === 'browser') eventGroups[ev.event_name].browser++;
        if (ev.source === 'server') eventGroups[ev.event_name].server++;
        if (ev.visitor_id) eventGroups[ev.event_name].withVid++;

        if (ev.event_id) {
          if (!eventIdMap[ev.event_id]) eventIdMap[ev.event_id] = new Set();
          eventIdMap[ev.event_id].add(ev.source);
        }
      }

      // Count DUAL events
      for (const [eventId, sources] of Object.entries(eventIdMap)) {
        if (sources.has('browser') && sources.has('server')) {
          // Find event name for this event_id
          const ev = internalEvents.find(e => e.event_id === eventId);
          if (ev && eventGroups[ev.event_name]) {
            eventGroups[ev.event_name].dual++;
          }
        }
      }

      internalMetrics.events = Object.entries(eventGroups).map(([name, data]) => ({
        event_name: name,
        browser_count: data.browser,
        server_count: data.server,
        dual_count: data.dual,
        vid_coverage: data.total > 0 ? Math.round((data.withVid / data.total) * 100) : 0,
        dedup_rate: data.server > 0 ? Math.round((data.dual / data.server) * 100) : 0,
      }));

      // Overall internal EMQ estimate
      const totalEvents = internalEvents.length;
      const withVid = internalEvents.filter(e => e.visitor_id).length;
      internalMetrics.overall = {
        total_events: totalEvents,
        vid_coverage: totalEvents > 0 ? Math.round((withVid / totalEvents) * 100) : 0,
      };
    }

    return new Response(
      JSON.stringify({ success: true, results, internal_metrics: internalMetrics }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[meta-emq] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
