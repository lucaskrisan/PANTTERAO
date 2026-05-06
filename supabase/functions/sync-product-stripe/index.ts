import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@18.5.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Usuário não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = userData.user.id;

    const { product_id } = await req.json();
    if (!product_id) {
      return new Response(JSON.stringify({ error: 'product_id obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load product
    const { data: product, error: prodError } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', product_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (prodError || !product) {
      return new Response(JSON.stringify({ error: 'Produto não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Resolve Stripe key from producer's gateway config
    let stripeKey: string | null = null;
    const { data: gw } = await supabaseAdmin
      .from('payment_gateways')
      .select('config')
      .eq('user_id', userId)
      .eq('provider', 'stripe')
      .eq('active', true)
      .maybeSingle();

    if (gw?.config && typeof gw.config === 'object' && (gw.config as any).api_key) {
      stripeKey = (gw.config as any).api_key;
    }

    // Fallback for super_admin
    if (!stripeKey) {
      const { data: ownerRoles } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'super_admin')
        .maybeSingle();
      if (ownerRoles) {
        stripeKey = Deno.env.get('STRIPE_SECRET_KEY') || null;
      }
    }

    if (!stripeKey) {
      return new Response(JSON.stringify({ error: 'Configure o Stripe nos Gateways antes de sincronizar.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2025-08-27.basil' });
    const currency = (product as any).currency === 'USD' ? 'usd' : 'brl';
    const amountCents = Math.round(product.price * 100);

    let stripeProductId = (product as any).stripe_product_id;
    let stripePriceId = (product as any).stripe_price_id;

    // Create or update Stripe product
    if (stripeProductId) {
      await stripe.products.update(stripeProductId, {
        name: product.name,
        description: product.description || undefined,
        images: product.image_url ? [product.image_url] : undefined,
      });
      console.log(`[sync-product-stripe] Updated Stripe product ${stripeProductId}`);
    } else {
      const stripeProduct = await stripe.products.create({
        name: product.name,
        description: product.description || undefined,
        images: product.image_url ? [product.image_url] : undefined,
        metadata: { panttera_id: product_id },
      });
      stripeProductId = stripeProduct.id;
      console.log(`[sync-product-stripe] Created Stripe product ${stripeProductId}`);
    }

    // Create new price (Stripe prices are immutable, so always create if price changed)
    if (!stripePriceId) {
      const stripePrice = await stripe.prices.create({
        product: stripeProductId,
        unit_amount: amountCents,
        currency,
      });
      stripePriceId = stripePrice.id;
      console.log(`[sync-product-stripe] Created Stripe price ${stripePriceId}`);
    } else {
      // Check if price changed
      const existingPrice = await stripe.prices.retrieve(stripePriceId);
      if (existingPrice.unit_amount !== amountCents || existingPrice.currency !== currency) {
        // Archive old price and create new one
        await stripe.prices.update(stripePriceId, { active: false });
        const newPrice = await stripe.prices.create({
          product: stripeProductId,
          unit_amount: amountCents,
          currency,
        });
        stripePriceId = newPrice.id;
        console.log(`[sync-product-stripe] Recreated Stripe price ${stripePriceId} (price changed)`);
      }
    }

    // Update product with Stripe IDs
    await supabaseAdmin
      .from('products')
      .update({
        stripe_product_id: stripeProductId,
        stripe_price_id: stripePriceId,
      })
      .eq('id', product_id);

    return new Response(JSON.stringify({
      success: true,
      stripe_product_id: stripeProductId,
      stripe_price_id: stripePriceId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[sync-product-stripe] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
