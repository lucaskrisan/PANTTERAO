import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature',
};

async function verifyWebhookSignature(payload: string, headers: Headers, secret: string): Promise<boolean> {
  const svixId = headers.get('svix-id');
  const svixTimestamp = headers.get('svix-timestamp');
  const svixSignature = headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error('[resend-webhook] Missing svix headers');
    return false;
  }

  // Check timestamp (5 min tolerance)
  const ts = parseInt(svixTimestamp);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 300) {
    console.error('[resend-webhook] Timestamp too old');
    return false;
  }

  // Decode secret (remove "whsec_" prefix, base64 decode)
  const secretBytes = Uint8Array.from(atob(secret.replace('whsec_', '')), c => c.charCodeAt(0));

  // Sign: "msg_id.timestamp.body"
  const toSign = `${svixId}.${svixTimestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(toSign));
  const computed = btoa(String.fromCharCode(...new Uint8Array(signature)));

  // svix-signature can have multiple sigs separated by space, each prefixed with "v1,"
  const signatures = svixSignature.split(' ');
  for (const sig of signatures) {
    const [version, value] = sig.split(',');
    if (version === 'v1' && value === computed) {
      return true;
    }
  }

  console.error('[resend-webhook] Signature mismatch');
  return false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    
    // Verify signature
    const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET');
    if (webhookSecret) {
      const isValid = await verifyWebhookSignature(rawBody, req.headers, webhookSecret);
      if (!isValid) {
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const payload = JSON.parse(rawBody);
    console.log('[resend-webhook] event:', payload.type, 'email_id:', payload.data?.email_id);

    const eventType = payload.type;
    const data = payload.data;

    if (!data?.email_id) {
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const now = new Date().toISOString();
    const updates: Record<string, any> = {};

    switch (eventType) {
      case 'email.delivered':
        updates.status = 'delivered';
        updates.delivered_at = data.created_at || now;
        break;
      case 'email.opened':
        updates.status = 'opened';
        updates.opened_at = data.created_at || now;
        break;
      case 'email.clicked':
        updates.status = 'clicked';
        updates.clicked_at = data.created_at || now;
        break;
      case 'email.bounced':
        updates.status = 'bounced';
        updates.bounced_at = data.created_at || now;
        updates.bounce_reason = data.bounce?.message || data.reason || 'Unknown';
        break;
      case 'email.complained':
        updates.status = 'complained';
        break;
      default:
        console.log('[resend-webhook] Unhandled event type:', eventType);
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const { error } = await supabase
      .from('email_logs')
      .update(updates)
      .eq('resend_id', data.email_id);

    if (error) {
      console.error('[resend-webhook] Update error:', error);
    } else {
      console.log('[resend-webhook] Updated email_log for resend_id:', data.email_id, 'status:', updates.status);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[resend-webhook] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
