import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.clone().json().catch(() => ({}));
    const isHealthCheck = requestBody?.health_check === true;

    const appId = Deno.env.get('ONESIGNAL_APP_ID');
    const apiKey = Deno.env.get('ONESIGNAL_REST_API_KEY');

    if (!appId || !apiKey) {
      return new Response(JSON.stringify({ error: 'OneSignal not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user from auth header
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let notifTitle = isHealthCheck ? '🛡️ Fiscalização do Sistema' : '🎉 Ka-ching! Mais uma venda!';
    let notifBody = isHealthCheck ? 'Push notifications operando normalmente ✅' : 'João Silva • 💠 PIX R$ 197,00 • Curso Premium';
    let iconUrl = 'https://app.panttera.com.br/pwa-192x192.png';
    let user: { id: string } | null = null;

    // Try to get user's PWA settings for the notification template
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user: authUser } } = await supabase.auth.getUser(token);
      user = authUser;
      
      if (user) {
        const { data: pwaSettings } = await supabase
          .from('pwa_settings')
          .select('notification_title, notification_body, notification_icon_url, icon_192_url')
          .eq('user_id', user.id)
          .maybeSingle();

        if (pwaSettings) {
          if (pwaSettings.notification_title) {
            notifTitle = pwaSettings.notification_title;
          }
          if (pwaSettings.notification_body) {
            notifBody = pwaSettings.notification_body
              .replace('{product}', 'Curso Premium')
              .replace('{value}', 'R$ 197,00')
              .replace('{customer}', 'João Silva');
          }
          if (pwaSettings.notification_icon_url) {
            iconUrl = pwaSettings.notification_icon_url;
          } else if (pwaSettings.icon_192_url) {
            iconUrl = pwaSettings.icon_192_url;
          }
        }
      }
    }

    const payload: Record<string, unknown> = {
      app_id: appId,
      target_channel: 'push',
      headings: { en: notifTitle },
      contents: { en: notifBody },
      chrome_web_icon: iconUrl,
      url: 'https://app.panttera.com.br/admin/orders',
    };

    // Target only the calling user's devices (not all subscribers)
    if (user) {
      payload.include_aliases = { external_id: [user.id] };
    } else {
      payload.included_segments = ['Total Subscriptions'];
    }

    let response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    let data = await response.json();
    const shouldFallbackToTag = user && (
      !data?.id ||
      JSON.stringify(data?.errors || '').includes('All included players are not subscribed') ||
      JSON.stringify(data?.errors || '').includes('invalid_aliases')
    );

    if (shouldFallbackToTag) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.include_aliases;
      fallbackPayload.filters = [{ field: 'tag', key: 'user_id', relation: '=', value: user.id }];
      response = await fetch('https://api.onesignal.com/notifications', {
        method: 'POST',
        headers: {
          'Authorization': `Key ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fallbackPayload),
      });
      data = await response.json();
      console.log('[test-push] OneSignal fallback response:', JSON.stringify(data));
    }
    console.log('[test-push] OneSignal response:', JSON.stringify(data));

    return new Response(JSON.stringify({ success: !!data.id, onesignal: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[test-push] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
