import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const userId = body.user_id;

    if (!userId || typeof userId !== 'string') {
      return jsonResponse({ success: false, error: 'Missing user_id' }, 400);
    }

    // Validate request comes from service role (internal call from trigger via pg_net)
    const authHeader = req.headers.get('Authorization') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    if (!authHeader.includes(serviceRoleKey)) {
      return jsonResponse({ success: false, error: 'Forbidden' }, 403);
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      serviceRoleKey
    );

    // Get billing account
    const { data: account } = await supabaseAdmin
      .from('billing_accounts')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!account) {
      return jsonResponse({ success: false, error: 'No billing account' });
    }

    // Guard: auto-recharge must be enabled
    if (!account.auto_recharge_enabled) {
      return jsonResponse({ success: false, error: 'Auto-recharge disabled' });
    }

    // Guard: must have card token
    if (!account.card_token) {
      return jsonResponse({ success: false, error: 'No card token' });
    }

    // Guard: balance must be below threshold
    if (account.balance > account.auto_recharge_threshold) {
      return jsonResponse({ success: false, error: 'Balance above threshold' });
    }

    // Guard: prevent duplicate charges (cooldown 5 minutes)
    if (account.last_auto_recharge_at) {
      const lastRecharge = new Date(account.last_auto_recharge_at).getTime();
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      if (lastRecharge > fiveMinutesAgo) {
        return jsonResponse({ success: false, error: 'Cooldown active' });
      }
    }

    // Mark as processing (prevent duplicates)
    await supabaseAdmin
      .from('billing_accounts')
      .update({ last_auto_recharge_at: new Date().toISOString() })
      .eq('user_id', userId);

    const amount = account.auto_recharge_amount;
    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
    if (!ASAAS_API_KEY) {
      return jsonResponse({ success: false, error: 'Gateway not configured' });
    }

    const ASAAS_ENV = Deno.env.get('ASAAS_ENV') || 'production';
    const baseUrl = ASAAS_ENV === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';

    // Get user email for Asaas customer lookup
    const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (!user?.email) {
      return jsonResponse({ success: false, error: 'User not found' });
    }

    // Find Asaas customer
    const searchRes = await fetch(
      `${baseUrl}/customers?email=${encodeURIComponent(user.email)}`,
      { headers: { 'access_token': ASAAS_API_KEY } }
    );
    const searchData = await searchRes.json();
    const asaasCustomerId = searchData.data?.[0]?.id;

    if (!asaasCustomerId) {
      console.error('[billing-auto-recharge] No Asaas customer for', user.email);
      return jsonResponse({ success: false, error: 'No Asaas customer' });
    }

    // Charge card
    const dueDate = new Date().toISOString().split('T')[0];
    const chargeRes = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType: 'CREDIT_CARD',
        value: amount,
        dueDate,
        description: `Recarga automática PanteraPay — R$${amount.toFixed(2).replace('.', ',')}`,
        externalReference: `auto_recharge_${userId.slice(0, 8)}_${Date.now()}`,
        creditCardToken: account.card_token,
      }),
    });

    const chargeData = await chargeRes.json();

    if (!chargeRes.ok || !chargeData.id) {
      console.error('[billing-auto-recharge] Charge failed:', JSON.stringify(chargeData));

      // If token expired, disable auto-recharge and clear card
      if (chargeData.errors?.some?.((e: any) => e.code === 'invalid_creditCardToken')) {
        await supabaseAdmin
          .from('billing_accounts')
          .update({
            card_token: null,
            card_last4: null,
            card_brand: null,
            auto_recharge_enabled: false,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);
      }

      return jsonResponse({ success: false, error: 'Charge failed' });
    }

    // Record recharge
    await supabaseAdmin.from('billing_recharges').insert({
      user_id: userId,
      amount,
      external_id: chargeData.id,
      status: chargeData.status === 'CONFIRMED' ? 'confirmed' : 'pending',
    });

    // If confirmed immediately, add credit
    if (chargeData.status === 'CONFIRMED' || chargeData.status === 'RECEIVED') {
      await supabaseAdmin.rpc('add_billing_credit', {
        p_user_id: userId,
        p_amount: amount,
        p_description: `Recarga automática •••• ${account.card_last4} — R$${amount.toFixed(2).replace('.', ',')}`,
      });
    }

    console.log(`[billing-auto-recharge] Success for ${userId}: R$${amount} via card ****${account.card_last4}`);

    return jsonResponse({
      success: true,
      payment_id: chargeData.id,
      status: chargeData.status,
      amount,
    });
  } catch (error: unknown) {
    console.error('[billing-auto-recharge] Error:', error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Internal error',
    }, 500);
  }
});
