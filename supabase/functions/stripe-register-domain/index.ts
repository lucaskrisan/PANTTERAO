import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@18.5.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Registers a domain with the producer's Stripe account for Apple Pay / Google Pay.
 * Idempotent — if already registered, retrieves and updates status.
 *
 * Called by:
 *  - cloudflare-check-status when domain transitions to 'active'
 *  - /admin/domains UI "Re-validate" button
 *  - (future) DB trigger when custom_domains.status = 'active'
 *
 * POST { domain?: string, domain_id?: string, producer_user_id?: string }
 *   domain         — hostname to register (e.g. checkout.paolasemfiltro.com)
 *   domain_id      — custom_domains.id (alternative to domain+producer_user_id)
 *   producer_user_id — owner of the Stripe account
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Accept: user JWT (from UI) or service-role key (from other edge functions)
    let callerUserId: string | null = null;
    let isServiceCall = false;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      if (token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
        isServiceCall = true;
      } else {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (!error && user) callerUserId = user.id;
      }
    }

    if (!isServiceCall && !callerUserId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { domain_id, producer_user_id } = body;
    let { domain } = body;

    // Resolve domain row
    let domainRow: any = null;
    if (domain_id) {
      const { data } = await supabase
        .from('custom_domains')
        .select('*')
        .eq('id', domain_id)
        .single();
      domainRow = data;
    } else if (domain && producer_user_id) {
      const { data } = await supabase
        .from('custom_domains')
        .select('*')
        .eq('hostname', domain)
        .eq('user_id', producer_user_id)
        .maybeSingle();
      domainRow = data;
    }

    if (!domainRow) {
      return new Response(JSON.stringify({ error: 'Domain not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Caller must own the domain (unless service call)
    if (!isServiceCall && callerUserId !== domainRow.user_id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    domain = domainRow.hostname;
    const ownerId = domainRow.user_id;

    // Resolve Stripe secret key for this producer
    let stripeKey: string | null = null;
    const { data: gw } = await supabase
      .from('payment_gateways')
      .select('config')
      .eq('user_id', ownerId)
      .eq('provider', 'stripe')
      .eq('active', true)
      .maybeSingle();

    if (gw?.config && typeof gw.config === 'object') {
      const cfg = gw.config as any;
      stripeKey = cfg.secret_key || cfg.api_key || cfg.sk || null;
    }

    // Fallback: super_admin uses platform Stripe key
    if (!stripeKey) {
      const { data: role } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', ownerId)
        .eq('role', 'super_admin')
        .maybeSingle();
      if (role) stripeKey = Deno.env.get('STRIPE_SECRET_KEY') || null;
    }

    if (!stripeKey) {
      // Producer has no Stripe — mark as not_applicable
      await supabase
        .from('custom_domains')
        .update({ stripe_apple_pay_status: 'not_applicable', updated_at: new Date().toISOString() })
        .eq('id', domainRow.id);

      return new Response(
        JSON.stringify({ status: 'not_applicable', reason: 'Producer has no Stripe gateway configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2025-08-27.basil' });

    // Idempotent: retrieve existing PMD if we have an id
    let pmd: any = null;

    if (domainRow.stripe_pmd_id) {
      try {
        pmd = await stripe.paymentMethodDomains.retrieve(domainRow.stripe_pmd_id);
        console.log(`[stripe-register-domain] Retrieved existing PMD: ${pmd.id}`);
      } catch (e: any) {
        // PMD was deleted on Stripe side — will recreate below
        console.warn(`[stripe-register-domain] Could not retrieve PMD ${domainRow.stripe_pmd_id}:`, e.message);
        pmd = null;
      }
    }

    if (!pmd) {
      try {
        pmd = await stripe.paymentMethodDomains.create({ domain_name: domain });
        console.log(`[stripe-register-domain] Created PMD: ${pmd.id} for ${domain}`);
      } catch (e: any) {
        // If domain already exists in this Stripe account, list and find it
        if (e?.code === 'resource_already_exists' || e?.message?.includes('already registered')) {
          const list = await stripe.paymentMethodDomains.list({ domain_name: domain, limit: 1 });
          pmd = list.data[0] || null;
          console.log(`[stripe-register-domain] Found existing PMD via list: ${pmd?.id}`);
        } else {
          throw e;
        }
      }
    }

    if (!pmd) {
      throw new Error('Could not create or retrieve payment method domain');
    }

    // Extract wallet statuses
    const appleStatus = pmd.apple_pay?.status ?? 'inactive';
    const googleStatus = pmd.google_pay?.status ?? 'inactive';
    const linkStatus = pmd.link?.status ?? 'inactive';

    // Persist to custom_domains
    await supabase
      .from('custom_domains')
      .update({
        stripe_pmd_id: pmd.id,
        stripe_apple_pay_status: appleStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', domainRow.id);

    return new Response(
      JSON.stringify({
        pmd_id: pmd.id,
        domain: pmd.domain_name,
        apple_pay: appleStatus,
        google_pay: googleStatus,
        link: linkStatus,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[stripe-register-domain] Error:', err);
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
