import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const normalizePhone = (phone?: string | null) => {
  const digits = phone?.replace(/\D/g, '') || '';
  const localPhone = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits;

  if (localPhone.length < 10) return null;

  return {
    country_code: '55',
    area_code: localPhone.slice(0, 2),
    number: localPhone.slice(2),
  };
};

const extractErrorMessages = (value: unknown): string[] => {
  if (!value) return [];
  if (typeof value === 'string') return value.trim() ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(extractErrorMessages);
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const preferred = [record.description, record.message, record.error]
      .flatMap(extractErrorMessages);

    if (preferred.length > 0) return preferred;

    return Object.values(record).flatMap(extractErrorMessages);
  }

  return [String(value)];
};

const getGatewayErrorMessage = (data: any, fallback: string) => {
  const messages = extractErrorMessages(data?.errors);
  if (messages.length > 0) return messages.join(' ');

  const fallbackMessages = extractErrorMessages(data?.message ?? data?.error);
  return fallbackMessages.length > 0 ? fallbackMessages.join(' ') : fallback;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();
    const amount = Number(body.amount);
    const method = body.method || 'pix';

    if (!amount || amount < 10) {
      return jsonResponse({ success: false, error: 'Valor mínimo de recarga é R$10' });
    }

    const name = user.user_metadata?.full_name || user.email!.split('@')[0];
    const email = user.email!;

    const [{ data: profile }, { data: recentCustomer }] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('cpf, phone')
        .eq('id', user.id)
        .maybeSingle(),
      supabaseAdmin
        .from('customers')
        .select('cpf, phone')
        .eq('email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const cpf = (profile?.cpf || recentCustomer?.cpf || '').replace(/\D/g, '') || null;
    const phone = normalizePhone(profile?.phone || recentCustomer?.phone || null);

    if (method === 'pix') {
      const PAGARME_API_KEY = Deno.env.get('PAGARME_API_KEY');
      if (!PAGARME_API_KEY) {
        return jsonResponse({ success: false, error: 'Gateway PIX não configurado' });
      }

      if (!cpf) {
        return jsonResponse({ success: false, error: 'CPF necessário para gerar PIX. Complete seu perfil.' });
      }

      if (!phone) {
        return jsonResponse({ success: false, error: 'Telefone necessário para gerar PIX. Complete seu perfil.' });
      }

      const externalRef = `recharge_${user.id.slice(0, 8)}_${Date.now()}`;
      const orderPayload = {
        code: externalRef,
        items: [
          {
            amount: Math.round(amount * 100),
            description: `Recarga PanteraPay — R$${amount.toFixed(2).replace('.', ',')}`,
            quantity: 1,
            code: 'billing-recharge',
          },
        ],
        customer: {
          name,
          email,
          type: 'individual',
          document: cpf,
          document_type: 'CPF',
          phones: {
            mobile_phone: phone,
          },
        },
        payments: [
          {
            payment_method: 'pix',
            pix: { expires_in: 3600 },
          },
        ],
      };

      const response = await fetch('https://api.pagar.me/core/v5/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${btoa(PAGARME_API_KEY + ':')}`,
        },
        body: JSON.stringify(orderPayload),
      });

      const data = await response.json();
      if (!response.ok || data.status === 'failed') {
        console.error('[billing-recharge] Pagar.me error:', JSON.stringify(data));
        return jsonResponse({
          success: false,
          error: getGatewayErrorMessage(data, 'Erro ao gerar PIX. Tente novamente.'),
        });
      }

      const charge = data.charges?.[0];
      const pixData = charge?.last_transaction;

      await supabaseAdmin.from('billing_recharges').insert({
        user_id: user.id,
        amount,
        external_id: data.id,
        status: 'pending',
      });

      return jsonResponse({
        success: true,
        method: 'pix',
        payment_id: data.id,
        pix_code: pixData?.qr_code || null,
        qr_code_url: pixData?.qr_code_url || null,
        expires_at: pixData?.expires_at || null,
        amount,
      });
    }

    if (method === 'card') {
      const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
      if (!ASAAS_API_KEY) {
        return jsonResponse({ success: false, error: 'Gateway cartão não configurado' });
      }

      const ASAAS_ENV = Deno.env.get('ASAAS_ENV') || 'production';
      const baseUrl = ASAAS_ENV === 'production'
        ? 'https://api.asaas.com/v3'
        : 'https://sandbox.asaas.com/api/v3';

      // Check if user has a saved card token
      const { data: billingAccount } = await supabaseAdmin
        .from('billing_accounts')
        .select('card_token, card_last4, card_brand')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!billingAccount?.card_token) {
        return jsonResponse({
          success: false,
          error: 'Nenhum cartão cadastrado. Valide um cartão primeiro.',
          needs_card: true,
        });
      }

      // Find or create Asaas customer
      const searchRes = await fetch(
        `${baseUrl}/customers?email=${encodeURIComponent(email)}`,
        { headers: { 'access_token': ASAAS_API_KEY } }
      );
      const searchData = await searchRes.json();

      let asaasCustomerId: string;
      if (searchData.data?.[0]?.id) {
        asaasCustomerId = searchData.data[0].id;
      } else {
        const createRes = await fetch(`${baseUrl}/customers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
          body: JSON.stringify({
            name,
            email,
            cpfCnpj: cpf || undefined,
            phone: profile?.phone || recentCustomer?.phone || undefined,
          }),
        });
        const createData = await createRes.json();
        if (!createData.id) {
          console.error('[billing-recharge] Asaas customer error:', createData);
          return jsonResponse({
            success: false,
            error: getGatewayErrorMessage(createData, 'Erro ao criar cliente no gateway'),
          });
        }
        asaasCustomerId = createData.id;
      }

      const dueDate = new Date().toISOString().split('T')[0];
      const externalRef = `recharge_${user.id.slice(0, 8)}_${Date.now()}`;

      // Charge using saved card token
      const chargeRes = await fetch(`${baseUrl}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
        body: JSON.stringify({
          customer: asaasCustomerId,
          billingType: 'CREDIT_CARD',
          value: amount,
          dueDate,
          description: `Recarga PanteraPay — R$${amount.toFixed(2).replace('.', ',')}`,
          externalReference: externalRef,
          creditCardToken: billingAccount.card_token,
          remoteIp: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || '0.0.0.0',
        }),
      });
      const chargeData = await chargeRes.json();

      if (!chargeRes.ok || !chargeData.id) {
        console.error('[billing-recharge] Asaas card error:', chargeData);

        // If token is invalid/expired, clear it
        if (chargeData.errors?.some?.((e: any) => e.code === 'invalid_creditCardToken')) {
          await supabaseAdmin
            .from('billing_accounts')
            .update({ card_token: null, card_last4: null, card_brand: null, updated_at: new Date().toISOString() })
            .eq('user_id', user.id);
          return jsonResponse({
            success: false,
            error: 'Cartão expirado ou inválido. Cadastre um novo cartão.',
            needs_card: true,
          });
        }

        return jsonResponse({
          success: false,
          error: getGatewayErrorMessage(chargeData, 'Erro ao cobrar no cartão'),
        });
      }

      await supabaseAdmin.from('billing_recharges').insert({
        user_id: user.id,
        amount,
        external_id: chargeData.id,
        status: chargeData.status === 'CONFIRMED' ? 'confirmed' : 'pending',
      });

      // If payment confirmed immediately, add credit
      if (chargeData.status === 'CONFIRMED' || chargeData.status === 'RECEIVED') {
        await supabaseAdmin.rpc('add_billing_credit', {
          p_user_id: user.id,
          p_amount: amount,
          p_description: `Recarga via Cartão •••• ${billingAccount.card_last4} — R$${amount.toFixed(2).replace('.', ',')}`,
        });
      }

      return jsonResponse({
        success: true,
        method: 'card',
        payment_id: chargeData.id,
        status: chargeData.status,
        card_last4: billingAccount.card_last4,
        amount,
      });
    }

    return jsonResponse({ success: false, error: 'Método inválido. Use pix ou card.' });
  } catch (error: unknown) {
    console.error('[billing-recharge] Error:', error);
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : 'Erro interno ao processar recarga' }, 500);
  }
});