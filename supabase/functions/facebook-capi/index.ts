import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Facebook CAPI dispatcher — formato KwaiPay (string hashes).
 *
 * Aplica o MESMO padrão premium a TODOS os eventos (PageView, ViewContent,
 * InitiateCheckout, AddPaymentInfo, Lead, Purchase, AddToCart):
 *   - user_data com hashes em STRING (não array)
 *   - external_id = CPF hashed (string única)
 *   - client_ip_address = IPv4 real do visitante (via payload.client_ip)
 *   - geo (ct/st/zp/country) hashed
 *   - custom_data com contents[], num_items, payment_method quando aplicável
 *   - currency forçado pra BRL se omitido
 */

interface ContentItem {
  id: string;
  quantity: number;
  item_price: number;
}

interface CAPICustomData {
  value?: number;
  currency?: string;
  content_type?: string;
  content_ids?: string[];
  content_name?: string;
  num_items?: number;
  order_id?: string;
  contents?: ContentItem[];
  payment_method?: string;
}

interface CAPIUserData {
  em?: string;
  ph?: string;
  fn?: string;
  ln?: string;
  external_id?: string;
  ct?: string;
  st?: string;
  zp?: string;
  country?: string;
  client_ip_address?: string;
  client_user_agent?: string;
  fbc?: string;
  fbp?: string;
  ctwa_clid?: string;
}

interface CAPIEvent {
  event_name: string;
  event_time: number;
  event_id: string;
  event_source_url: string;
  referrer_url?: string;
  action_source: string;
  user_data: CAPIUserData;
  custom_data?: CAPICustomData;
  data_processing_options?: string[];
  data_processing_options_country?: number;
  data_processing_options_state?: number;
}

/**
 * Resolve the event_source_url to send to Meta CAPI.
 * Priority: owner's active custom_domain > origin extracted from rawUrl > fallback app.panttera.com.br
 * All events use /checkout/{productId} path for consistent attribution.
 */
function buildEventSourceUrl(
  metaDomain: string | null | undefined,
  rawUrl: string | null | undefined,
  eventName: string,
  productId: string,
  orderId?: string | null
): string {
  const FALLBACK = 'app.panttera.com.br';

  // Strip protocol and trailing slash from meta_domain if present
  let domain = (metaDomain || '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');

  // Fall back to origin extracted from raw URL
  if (!domain && rawUrl) {
    try { domain = new URL(rawUrl).hostname; } catch { /* ignore */ }
  }

  if (!domain) domain = FALLBACK;

  const base = `https://${domain}`;

  return `${base}/checkout/${productId}`;
}

async function hashSHA256(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value.trim().toLowerCase());
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const normalize = (v: string) => v.trim().toLowerCase().replace(/\s+/g, '').replace(/[^\w]/g, '');

function isPrivateOrInvalidIp(ip: string | undefined | null): boolean {
  if (!ip) return true;
  if (ip.startsWith('0.') || ip.startsWith('127.') || ip.startsWith('10.') || ip.startsWith('192.168.')) return true;
  if (ip === '::1') return true;
  const m = ip.match(/^172\.(\d+)\./);
  if (m) {
    const second = parseInt(m[1], 10);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const _payload = await req.json();
    if (_payload?.health_check === true) {
      return new Response(JSON.stringify({ ok: true, health_check: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const {
      product_id,
      event_name,
      event_id,
      event_source_url,
      referrer_url,
      customer,
      custom_data,
      fbc,
      fbp,
      visitor_id,
      user_agent,
      client_ip,
      ctwa_clid,
      log_browser,
      payment_method,
      geo,
      test_event_code,
      is_bot,
      bot_reason,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      utm_term,
    } = _payload;

    // Se não houver UTMs, tenta extrair do referrer ou do próprio payload (caso venha encapsulado)
    const finalUtmSource = utm_source || ((!utm_source && !utm_medium && referrer_url?.includes('google.com')) ? 'google' : null) || (utm_source === undefined && !utm_medium ? 'organic' : utm_source);
    const finalUtmMedium = utm_medium || ((!utm_source && !utm_medium && referrer_url?.includes('google.com')) ? 'organic' : null) || (utm_source === undefined && !utm_medium ? 'organic' : utm_medium);

    // Server-side bot fallback: bate UA mesmo se o cliente não declarou.
    const SERVER_BOT_UA = /bot|crawl|spider|slurp|headlesschrome|phantomjs|selenium|puppeteer|playwright|lighthouse|pagespeed|ahrefs|semrush|mj12bot|dotbot|petalbot|yandex|bingbot|googlebot|baiduspider|applebot|linkedinbot|twitterbot|telegrambot|discordbot|scraper|curl|wget|python-requests|node-fetch|axios/i;
    const serverDetectedBot = typeof user_agent === 'string' && SERVER_BOT_UA.test(user_agent);
    const finalIsBot = Boolean(is_bot) || serverDetectedBot;
    const finalBotReason = bot_reason || (serverDetectedBot ? 'server_ua_match' : null);

    if (!product_id || !event_name) {
      return new Response(
        JSON.stringify({ error: 'product_id and event_name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Product owner for logging/attribution
    const { data: productData } = await supabase
      .from('products')
      .select('user_id')
      .eq('id', product_id)
      .single();

    const productOwnerId = productData?.user_id || null;

    // Resolve active custom checkout domain for this product owner
    let ownerDomain: string | null = null;
    if (productOwnerId) {
      const { data: cdData } = await supabase
        .from('custom_domains')
        .select('hostname')
        .eq('user_id', productOwnerId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      ownerDomain = (cdData as any)?.hostname || null;
    }

    // Pixels with CAPI tokens
    const { data: pixels } = await supabase
      .from('product_pixels')
      .select('pixel_id, capi_token, fire_on_pix, fire_on_boleto')
      .eq('product_id', product_id)
      .eq('platform', 'facebook')
      .not('capi_token', 'is', null);

    const customerName = customer?.name || null;

    // Para atribuição correta no painel, gravamos um log de evento por pixel.
    // Se não houver pixels CAPI configurados, gravamos ainda assim com pixel_id=null
    // (mantém o histórico do produto).
    const allPixels = pixels && pixels.length > 0 ? pixels : [{ pixel_id: null }];

    // Capture monetary value for Purchase/Subscribe events (powers live feed R$ display)
    const eventValue = (event_name === 'Purchase' || event_name === 'Subscribe')
      ? (Number((custom_data as any)?.value) || null)
      : null;

    // Customer geo for live feed flags (fallback ao header cf-ipcountry quando o frontend não envia geo)
    const cfCountry = req.headers.get('cf-ipcountry') || req.headers.get('x-vercel-ip-country') || null;
    const customerCountry = (geo?.country || cfCountry || null)?.toString().toUpperCase().slice(0, 2) || null;
    const customerCity = geo?.city ? String(geo.city).slice(0, 80) : null;

    // Gera ID estável para visitantes anônimos (sem visitor_id)
    // usando hash de IP + UA + dia + produto — mesmo visitante = mesmo hash
    let effectiveVisitorId = visitor_id || null;
    if (!effectiveVisitorId && (event_name === 'PageView' || event_name === 'ViewContent')) {
      const ip = client_ip || req.headers.get('cf-connecting-ip') || '';
      const ua = (user_agent || req.headers.get('user-agent') || '').slice(0, 50);
      const day = new Date().toISOString().slice(0, 10);
      const raw = `${ip}_${ua}_${day}_${product_id}`;
      const encoded = new TextEncoder().encode(raw);
      const hashBuf = await crypto.subtle.digest('SHA-256', encoded);
      effectiveVisitorId = 'anon_' + Array.from(new Uint8Array(hashBuf))
        .slice(0, 8)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }

    if (effectiveVisitorId && (event_name === 'PageView' || event_name === 'ViewContent')) {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('pixel_events')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', product_id)
        .eq('event_name', event_name)
        .eq('visitor_id', effectiveVisitorId)
        .gte('created_at', fiveMinAgo);
      if ((count || 0) > 0) {
        return new Response(
          JSON.stringify({ success: true, skipped: 'rate_limited' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    for (const px of allPixels) {
      // Server-side log
      await supabase.from('pixel_events').insert({
        product_id,
        pixel_id: px.pixel_id,
        event_name,
        source: 'server',
        event_id: event_id || null,
        user_id: productOwnerId,
        customer_name: customerName,
        visitor_id: visitor_id || effectiveVisitorId || null,
        event_value: eventValue,
        customer_country: customerCountry,
        customer_city: customerCity,
        is_bot: finalIsBot,
        utm_source: finalUtmSource,
        utm_medium: finalUtmMedium,
        utm_campaign: utm_campaign || null,
        utm_content: utm_content || null,
        utm_term: utm_term || null,
      });

      // Browser-side log (quando o frontend também disparou via fbq)
      if (log_browser) {
        await supabase.from('pixel_events').insert({
          product_id,
          pixel_id: px.pixel_id,
          event_name,
          source: 'browser',
          event_id: event_id || null,
          user_id: productOwnerId,
          customer_name: customerName,
          visitor_id: visitor_id || effectiveVisitorId || null,
          event_value: eventValue,
          customer_country: customerCountry,
          customer_city: customerCity,
          is_bot: finalIsBot,
          utm_source: finalUtmSource,
          utm_medium: finalUtmMedium,
          utm_campaign: utm_campaign || null,
          utm_content: utm_content || null,
          utm_term: utm_term || null,
        });
      }
    }

    // 🤖 BOT FILTER: registramos o evento (pra auditoria), mas NÃO enviamos pra Meta.
    // Mantém Meta enxuto e impede que o algoritmo otimize pra audiência ruim.
    if (finalIsBot) {
      console.log(`[facebook-capi] 🤖 Bot detected (${finalBotReason}) — event ${event_name} logged but NOT sent to Meta`);
      return new Response(
        JSON.stringify({ success: true, skipped: 'bot_filter', reason: finalBotReason }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!pixels || pixels.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No CAPI tokens configured, skipping' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Resolve IP: payload.client_ip (IPv4 do Worker) > header chain ──
    const forwardedFor = req.headers.get('x-forwarded-for');
    const headerIp = forwardedFor
      ? forwardedFor.split(',')[0].trim()
      : req.headers.get('cf-connecting-ip') || undefined;

    const candidateIp = (client_ip && !isPrivateOrInvalidIp(client_ip)) ? client_ip
                      : (headerIp && !isPrivateOrInvalidIp(headerIp)) ? headerIp
                      : undefined;

    const userData: CAPIUserData = {
      client_ip_address: candidateIp,
      client_user_agent: user_agent || req.headers.get('user-agent') || undefined,
    };

    // fbc — only if valid + < 90 days
    if (fbc && typeof fbc === 'string' && fbc.startsWith('fb.')) {
      const parts = fbc.split('.');
      if (parts.length >= 3) {
        const ts = parseInt(parts[2], 10);
        const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
        if (!isNaN(ts) && (Date.now() - ts) < ninetyDaysMs) {
          userData.fbc = fbc;
        } else {
          console.log(`[facebook-capi] Skipping expired fbc: ${fbc}`);
        }
      }
    }
    if (fbp && typeof fbp === 'string' && fbp.startsWith('fb.')) userData.fbp = fbp;
    if (ctwa_clid && typeof ctwa_clid === 'string' && ctwa_clid.length > 0) userData.ctwa_clid = ctwa_clid;

    // ── GEO (string hash, KwaiPay format) ──
    const geoCity: string | undefined = geo?.city;
    const geoState: string | undefined = geo?.state;
    const geoZip: string | undefined = geo?.zip;
    const geoCountry: string = (geo?.country || 'BR').toLowerCase();

    if (geoCity) {
      const n = normalize(geoCity);
      if (n) userData.ct = await hashSHA256(n);
    }
    if (geoState) {
      const n = geoState.trim().toLowerCase().replace(/\s+/g, '');
      if (n) userData.st = await hashSHA256(n);
    }
    if (geoZip) {
      const n = geoZip.replace(/\D/g, '');
      if (n) userData.zp = await hashSHA256(n);
    }
    userData.country = await hashSHA256(geoCountry);

    // external_id = CPF (string única, KwaiPay style). Fallback: visitor_id.
    if (customer?.cpf) {
      userData.external_id = await hashSHA256(customer.cpf.replace(/\D/g, ''));
    } else if (visitor_id) {
      userData.external_id = await hashSHA256(String(visitor_id));
    }

    if (customer?.email) {
      userData.em = await hashSHA256(customer.email);
    }
    if (customer?.phone) {
      const phone = customer.phone.replace(/\D/g, '');
      const withCountry = geoCountry === 'br' && !phone.startsWith('55') ? `55${phone}` : phone;
      userData.ph = await hashSHA256(`+${withCountry}`);
    }
    if (customer?.name) {
      const parts = customer.name.trim().toLowerCase().split(/\s+/);
      userData.fn = await hashSHA256(parts[0]);
      if (parts.length > 1) {
        userData.ln = await hashSHA256(parts.slice(1).join(' '));
      }
    }

    // ── custom_data: BRL default + contents/num_items/payment_method passthrough ──
    const cd: CAPICustomData = { currency: 'BRL', ...(custom_data || {}) };
    if (!cd.currency) cd.currency = 'BRL';
    if (cd.value !== undefined) cd.value = Number(cd.value);

    // Auto-build `contents` when content_ids exists e contents não veio do app
    if (!cd.contents && Array.isArray(cd.content_ids) && cd.content_ids.length > 0) {
      const ids = cd.content_ids;
      const itemPrice = cd.value && ids.length > 0 ? Number((cd.value / ids.length).toFixed(2)) : 0;
      cd.contents = ids.map((id) => ({ id, quantity: 1, item_price: itemPrice }));
      if (cd.num_items === undefined) cd.num_items = ids.length;
    }

    // Propaga payment_method top-level se cd não tiver
    if (!cd.payment_method && payment_method) cd.payment_method = payment_method;

    // data_processing_options: LDU only for US traffic (CCPA); empty array for BR (LGPD handled separately)
    const isUsTraffic = geoCountry === 'us';
    const dataProcessingOptions = isUsTraffic
      ? { data_processing_options: ['LDU'], data_processing_options_country: 1, data_processing_options_state: 0 }
      : { data_processing_options: [] };

    const event: CAPIEvent = {
      event_name,
      event_time: Math.floor(Date.now() / 1000),
      event_id: event_id || `${event_name}_${Date.now()}`,
      event_source_url: '', // resolved per-pixel inside the loop
      ...(referrer_url ? { referrer_url: String(referrer_url) } : {}),
      action_source: 'website',
      user_data: userData,
      custom_data: cd,
      ...dataProcessingOptions,
    };

    const results: any[] = [];

    for (const pixel of pixels) {
      if (!pixel.capi_token) continue;

      if (payment_method === 'pix' && pixel.fire_on_pix === false) {
        console.log(`[facebook-capi] Skipping pixel ${pixel.pixel_id} — fire_on_pix disabled`);
        continue;
      }
      if (payment_method === 'boleto' && pixel.fire_on_boleto === false) {
        console.log(`[facebook-capi] Skipping pixel ${pixel.pixel_id} — fire_on_boleto disabled`);
        continue;
      }

      // Resolve event_source_url using owner's active custom checkout domain
      const resolvedUrl = buildEventSourceUrl(
        ownerDomain,
        event_source_url,
        event_name,
        product_id,
        (custom_data as any)?.order_id
      );
      event.event_source_url = resolvedUrl;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        // ── DEBUG: log payload sent to Meta (hashes truncated for privacy) ──
        const mask = (h?: string) => (h ? `${h.slice(0, 8)}…${h.slice(-4)}` : undefined);
        const debugPayload = {
          pixel_id: pixel.pixel_id,
          event_name: event.event_name,
          event_id: event.event_id,
          event_time: event.event_time,
          event_source_url: event.event_source_url,
          action_source: event.action_source,
          user_data: {
            em: mask(event.user_data.em),
            ph: mask(event.user_data.ph),
            fn: mask(event.user_data.fn),
            ln: mask(event.user_data.ln),
            external_id: mask(event.user_data.external_id),
            ct: mask(event.user_data.ct),
            st: mask(event.user_data.st),
            zp: mask(event.user_data.zp),
            country: mask(event.user_data.country),
            client_ip_address: event.user_data.client_ip_address,
            client_user_agent: event.user_data.client_user_agent?.slice(0, 60) + '…',
            fbc: event.user_data.fbc,
            fbp: event.user_data.fbp,
          },
          custom_data: event.custom_data,
        };
        console.log(`[facebook-capi][PAYLOAD→META] ${JSON.stringify(debugPayload)}`);

        const metaBody: Record<string, unknown> = {
          data: [event],
          access_token: pixel.capi_token,
        };
        if (test_event_code) metaBody.test_event_code = test_event_code;

        const response = await fetch(
          `https://graph.facebook.com/v22.0/${pixel.pixel_id}/events`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(metaBody),
            signal: controller.signal,
          }
        );
        clearTimeout(timeout);

        const data = await response.json();
        console.log(`[facebook-capi][META←RESPONSE] Pixel ${pixel.pixel_id}:`, JSON.stringify(data));
        results.push({
          pixel_id: pixel.pixel_id,
          success: response.ok,
          http_status: response.status,
          meta_response: data,
          ...(test_event_code ? { payload_preview: { ...debugPayload, test_event_code } } : {}),
        });
      } catch (err) {
        console.error(`[facebook-capi] Pixel ${pixel.pixel_id} error:`, err);
        results.push({ pixel_id: pixel.pixel_id, success: false, error: (err as Error).message });
      }
    }

    // ── Fire-and-forget: mirror this event to all active mirror_pixels (CAPI-only) ──
    // Mirror pixels never touch the browser, so Meta cannot crawl/categorize the source domain.
    // Used to migrate away from pixels in dead/inaccessible BMs without losing tracking.
    try {
      const mirrorUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/capi-mirror-forward`;
      fetch(mirrorUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`,
        },
        body: JSON.stringify({
          event_name: event.event_name,
          event_time: event.event_time,
          event_id: event.event_id,
          event_source_url: event.event_source_url,
          action_source: event.action_source,
          user_data: event.user_data,
          custom_data: event.custom_data,
        }),
      }).catch((e) => console.warn('[facebook-capi] mirror dispatch failed:', e));
    } catch (e) {
      console.warn('[facebook-capi] mirror skipped:', e);
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[facebook-capi] Error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
