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
    const url = new URL(req.url);
    const productId = url.searchParams.get('product_id') || (await req.json().catch(() => ({})))?.product_id;

    if (!productId) {
      return new Response(
        JSON.stringify({ error: 'product_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Find the product owner
    const { data: prod } = await supabaseAdmin
      .from('products')
      .select('user_id')
      .eq('id', productId)
      .maybeSingle();

    if (!prod?.user_id) {
      return new Response(
        JSON.stringify({ error: 'Product not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Look up the producer's Stripe gateway
    const { data: gw } = await supabaseAdmin
      .from('payment_gateways')
      .select('config')
      .eq('user_id', prod.user_id)
      .eq('provider', 'stripe')
      .eq('active', true)
      .maybeSingle();

    let publishableKey: string | null = null;
    if (gw?.config && typeof gw.config === 'object') {
      const cfg = gw.config as Record<string, unknown>;
      publishableKey =
        (cfg.publishable_key as string) ||
        (cfg.public_key as string) ||
        (cfg.pk as string) ||
        null;
    }

    // Fallback to platform key for super_admin producers
    if (!publishableKey) {
      const { data: ownerRoles } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', prod.user_id)
        .eq('role', 'super_admin')
        .maybeSingle();
      if (ownerRoles) {
        publishableKey = Deno.env.get('STRIPE_PUBLISHABLE_KEY') || null;
      }
    }

    if (!publishableKey) {
      return new Response(
        JSON.stringify({ error: 'Stripe publishable key not configured for this producer.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Safety: never return secret keys
    if (publishableKey.startsWith('sk_')) {
      console.error('[get-stripe-publishable-key] Refusing to return secret key');
      return new Response(
        JSON.stringify({ error: 'Misconfigured key (secret key stored as publishable).' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ publishable_key: publishableKey }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[get-stripe-publishable-key] Error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
