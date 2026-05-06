import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const DEFAULT_APP_ORIGIN = 'https://app.panttera.com.br';

function resolveAppOrigin(req: Request) {
  const candidates = [req.headers.get('origin'), req.headers.get('referer')];

  for (const candidate of candidates) {
    if (!candidate) continue;

    try {
      return new URL(candidate).origin;
    } catch {
      // ignore invalid header values
    }
  }

  return DEFAULT_APP_ORIGIN;
}

function toAbsoluteUrl(value: string, appOrigin: string) {
  try {
    return new URL(value, appOrigin).toString();
  } catch {
    return new URL('/', appOrigin).toString();
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('user_id');
    const appOrigin = resolveAppOrigin(req);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let settings: any = null;

    if (userId) {
      const { data } = await supabase
        .from('pwa_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      settings = data;
    }

    // Defaults
    const appName = settings?.app_name || 'PanteraPay';
    const shortName = settings?.short_name || 'PanteraPay';
    const description = settings?.description || 'Plataforma completa de vendas';
    const themeColor = settings?.theme_color || '#10b981';
    const bgColor = settings?.background_color || '#050505';
    const icon192 = toAbsoluteUrl(settings?.icon_192_url || '/pwa-192x192.png', appOrigin);
    const icon512 = toAbsoluteUrl(settings?.icon_512_url || '/pwa-512x512.png', appOrigin);

    const manifest = {
      id: `${appOrigin}/admin`,
      name: appName,
      short_name: shortName,
      description,
      theme_color: themeColor,
      background_color: bgColor,
      display: 'standalone',
      orientation: 'portrait',
      scope: `${appOrigin}/`,
      start_url: `${appOrigin}/admin`,
      icons: [
        {
          src: icon192,
          sizes: '192x192',
          type: icon192.endsWith('.webp') ? 'image/webp' : 'image/png',
          purpose: 'any',
        },
        {
          src: icon192,
          sizes: '192x192',
          type: icon192.endsWith('.webp') ? 'image/webp' : 'image/png',
          purpose: 'maskable',
        },
        {
          src: icon512,
          sizes: '512x512',
          type: icon512.endsWith('.webp') ? 'image/webp' : 'image/png',
          purpose: 'any',
        },
        {
          src: icon512,
          sizes: '512x512',
          type: icon512.endsWith('.webp') ? 'image/webp' : 'image/png',
          purpose: 'maskable',
        },
        {
          src: '/badge-72x72.png',
          sizes: '72x72',
          type: 'image/png',
          purpose: 'any',
        },
      ],
    };

    return new Response(JSON.stringify(manifest), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error) {
    console.error('[pwa-manifest] Error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
