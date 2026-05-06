import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Auth check — only authenticated users or cron can trigger
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;

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
        userId = user.id;
      }
    }

    // Get body params (optional product_id filter)
    let productFilter: string | null = null;
    try {
      const body = await req.json();
      productFilter = body.product_id || null;
    } catch { /* no body = snapshot all */ }

    // Get all products with Facebook pixels
    let query = supabase
      .from('product_pixels')
      .select('product_id, pixel_id')
      .eq('platform', 'facebook')
      .not('capi_token', 'is', null);

    if (productFilter) {
      query = query.eq('product_id', productFilter);
    } else if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: pixels } = await query;

    if (!pixels || pixels.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No pixels to monitor', snapshots: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    let snapshotCount = 0;

    // Group by product_id to avoid duplicate queries
    const productIds = [...new Set(pixels.map(p => p.product_id))];

    for (const productId of productIds) {
      const productPixels = pixels.filter(p => p.product_id === productId);

      // Get internal metrics from pixel_events
      const { data: events } = await supabase
        .from('pixel_events')
        .select('event_name, source, event_id, visitor_id')
        .eq('product_id', productId)
        .gte('created_at', sevenDaysAgo);

      if (!events || events.length === 0) continue;

      // Compute per-event metrics
      const eventGroups: Record<string, { browser: number; server: number; withVid: number; total: number }> = {};
      const eventIdMap: Record<string, { sources: Set<string>; eventName: string }> = {};

      for (const ev of events) {
        if (!eventGroups[ev.event_name]) {
          eventGroups[ev.event_name] = { browser: 0, server: 0, withVid: 0, total: 0 };
        }
        const g = eventGroups[ev.event_name];
        g.total++;
        if (ev.source === 'browser') g.browser++;
        if (ev.source === 'server') g.server++;
        if (ev.visitor_id) g.withVid++;

        if (ev.event_id) {
          if (!eventIdMap[ev.event_id]) eventIdMap[ev.event_id] = { sources: new Set(), eventName: ev.event_name };
          eventIdMap[ev.event_id].sources.add(ev.source);
        }
      }

      // Count DUAL
      const dualCounts: Record<string, number> = {};
      for (const [, info] of Object.entries(eventIdMap)) {
        if (info.sources.has('browser') && info.sources.has('server')) {
          dualCounts[info.eventName] = (dualCounts[info.eventName] || 0) + 1;
        }
      }

      // Upsert snapshots for each pixel × event
      for (const pixel of productPixels) {
        for (const [eventName, data] of Object.entries(eventGroups)) {
          const dual = dualCounts[eventName] || 0;
          const dedupRate = data.server > 0 ? Math.round((dual / data.server) * 100) : 0;
          const vidCoverage = data.total > 0 ? Math.round((data.withVid / data.total) * 100) : 0;

          const { error } = await supabase
            .from('emq_snapshots')
            .upsert({
              product_id: productId,
              pixel_id: pixel.pixel_id,
              event_name: eventName,
              browser_count: data.browser,
              server_count: data.server,
              dual_count: dual,
              vid_coverage: vidCoverage,
              dedup_rate: dedupRate,
              snapshot_date: today,
            }, { onConflict: 'product_id,pixel_id,event_name,snapshot_date' });

          if (!error) snapshotCount++;
        }
      }
    }

    console.log(`[meta-emq-monitor] Saved ${snapshotCount} snapshots for ${today}`);

    return new Response(
      JSON.stringify({ success: true, snapshots: snapshotCount, date: today }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[meta-emq-monitor] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
