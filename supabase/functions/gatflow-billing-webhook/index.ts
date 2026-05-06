import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function signHMAC(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );
  
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, plan_name, status } = await req.json();

    if (!user_id || !plan_name) {
      return new Response(JSON.stringify({ error: 'Missing parameters' }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get the GatFlow configuration and secret
    const { data: partner } = await supabase
      .from('marketplace_partners')
      .select('shared_secret')
      .eq('name', 'GatFlow')
      .single();

    if (!partner?.shared_secret) {
      throw new Error('GatFlow shared secret not found');
    }

    const payload = {
      event: status === 'uninstalled' ? 'app.uninstalled' : 'subscription.updated',
      shop_id: user_id,
      plan_tier: plan_name // Starter, Pro, Black
    };

    const body = JSON.stringify(payload);
    const signature = await signHMAC(body, partner.shared_secret);

    console.log(`Sending webhook to GatFlow for user ${user_id}, plan ${plan_name}`);

    const response = await fetch('https://izclmoxvjujxatfivcqv.supabase.co/functions/v1/webhook-panttera', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-panttera-signature': signature
      },
      body: body
    });

    return new Response(JSON.stringify({ 
      success: response.ok, 
      status: response.status 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('[gatflow-billing-webhook] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});