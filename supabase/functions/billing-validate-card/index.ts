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

const getGatewayErrorMessage = (data: Record<string, unknown>, fallback: string) => {
  const messages = extractErrorMessages(data.errors);
  if (messages.length > 0) return messages.join(' ');

  const fallbackMessages = extractErrorMessages(data.message ?? data.error);
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

    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
    if (!ASAAS_API_KEY) {
      return jsonResponse({ success: false, error: 'Gateway de cartão não configurado' });
    }

    const ASAAS_ENV = Deno.env.get('ASAAS_ENV') || 'production';
    const baseUrl = ASAAS_ENV === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();
    const { card_number, card_name, card_expiry_month, card_expiry_year, card_cvv, card_cpf } = body;

    // Validate required fields
    if (!card_number || !card_name || !card_expiry_month || !card_expiry_year || !card_cvv || !card_cpf) {
      return jsonResponse({ success: false, error: 'Todos os campos do cartão são obrigatórios' });
    }

    // Sanitize inputs
    const cleanNumber = card_number.replace(/\D/g, '');
    const cleanCpf = card_cpf.replace(/\D/g, '');
    const cleanMonth = String(card_expiry_month).padStart(2, '0');
    const cleanYear = String(card_expiry_year).length === 2
      ? `20${card_expiry_year}`
      : String(card_expiry_year);

    if (cleanNumber.length < 13 || cleanNumber.length > 19) {
      return jsonResponse({ success: false, error: 'Número do cartão inválido' });
    }
    if (cleanCpf.length !== 11) {
      return jsonResponse({ success: false, error: 'CPF inválido' });
    }
    if (card_cvv.length < 3 || card_cvv.length > 4) {
      return jsonResponse({ success: false, error: 'CVV inválido' });
    }

    const name = user.user_metadata?.full_name || user.email!.split('@')[0];
    const email = user.email!;

    // Get phone from profile or latest customer record
    const [{ data: profile }, { data: recentCustomer }] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('phone')
        .eq('id', user.id)
        .maybeSingle(),
      supabaseAdmin
        .from('customers')
        .select('phone')
        .eq('email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const phone = profile?.phone || recentCustomer?.phone || '';

    // 1. Find or create Asaas customer
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
          name: card_name,
          email,
          cpfCnpj: cleanCpf,
          phone: phone || undefined,
        }),
      });
      const createData = await createRes.json();
      if (!createData.id) {
        console.error('[billing-validate-card] Asaas customer error:', createData);
        return jsonResponse({ success: false, error: 'Erro ao criar cliente no gateway' });
      }
      asaasCustomerId = createData.id;
    }

    // 2. Tokenize card first via dedicated endpoint
    const tokenizePayload = {
      customer: asaasCustomerId,
      creditCard: {
        holderName: card_name,
        number: cleanNumber,
        expiryMonth: cleanMonth,
        expiryYear: cleanYear,
        ccv: card_cvv,
      },
      creditCardHolderInfo: {
        name: card_name,
        email,
        cpfCnpj: cleanCpf,
        phone: phone || cleanNumber.slice(-11),
        postalCode: '01310100',
        addressNumber: '0',
        addressComplement: '',
      },
      remoteIp: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || '0.0.0.0',
    };

    const tokenizeRes = await fetch(`${baseUrl}/creditCard/tokenize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
      body: JSON.stringify(tokenizePayload),
    });

    const tokenizeData = await tokenizeRes.json();
    const creditCardToken = tokenizeData.creditCardToken;

    if (!tokenizeRes.ok || !creditCardToken) {
      console.error('[billing-validate-card] Tokenize error:', JSON.stringify(tokenizeData));
      return jsonResponse({
        success: false,
        error: getGatewayErrorMessage(tokenizeData, 'Não foi possível tokenizar o cartão. Verifique os dados.'),
      });
    }

    console.log('[billing-validate-card] Card tokenized successfully:', creditCardToken);

    // 3. Make R$5 validation charge using token to confirm card is real
    const dueDate = new Date().toISOString().split('T')[0];
    const validationPayload = {
      customer: asaasCustomerId,
      billingType: 'CREDIT_CARD',
      value: 5.00,
      dueDate,
      description: 'Validação de cartão PanteraPay (será estornada automaticamente)',
      creditCardToken,
    };

    const validationRes = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
      body: JSON.stringify(validationPayload),
    });

    const validationData = await validationRes.json();
    const failedStatuses = new Set(['REFUSED', 'FAILED', 'CANCELLED']);

    if (!validationRes.ok || !validationData.id || failedStatuses.has(validationData.status)) {
      console.error('[billing-validate-card] Validation charge error:', JSON.stringify(validationData));
      return jsonResponse({
        success: false,
        error: getGatewayErrorMessage(validationData, 'Cartão recusado. Verifique os dados e tente novamente.'),
      });
    }

    // 4. Immediately refund the validation charge — CRITICAL: must always refund
    // Retry up to 3 times with exponential backoff
    let refundSuccess = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise(r => setTimeout(r, attempt * 2000)); // 0, 2s, 4s
        }
        const refundRes = await fetch(`${baseUrl}/payments/${validationData.id}/refund`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
          body: JSON.stringify({ value: 5.00, description: 'Estorno automático de validação de cartão' }),
        });
        const refundData = await refundRes.json();
        console.log(`[billing-validate-card] Refund attempt ${attempt + 1} for ${validationData.id}:`, JSON.stringify(refundData));

        if (refundRes.ok) {
          refundSuccess = true;
          break;
        }
      } catch (refundErr) {
        console.error(`[billing-validate-card] Refund attempt ${attempt + 1} exception:`, refundErr);
      }
    }

    if (!refundSuccess) {
      console.error('[billing-validate-card] ALL refund attempts FAILED for payment:', validationData.id);
      return jsonResponse({
        success: false,
        error: 'Não foi possível estornar a cobrança de validação (R$5,00). Cartão NÃO foi salvo. Entre em contato com o suporte.',
        refund_payment_id: validationData.id,
      });
    }

    // 5. Save token to billing_accounts
    const last4 = validationData.creditCard?.creditCardNumber?.slice(-4) || tokenizeData.creditCardNumber?.slice(-4) || cleanNumber.slice(-4);
    const brand = validationData.creditCard?.creditCardBrand || tokenizeData.creditCardBrand || 'unknown';

    await supabaseAdmin
      .from('billing_accounts')
      .upsert({
        user_id: user.id,
        card_token: creditCardToken,
        card_last4: last4,
        card_brand: brand,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    // Also save CPF to profile if not set
    if (cleanCpf) {
      await supabaseAdmin
        .from('profiles')
        .update({ cpf: cleanCpf })
        .eq('id', user.id)
        .is('cpf', null);
    }

    return jsonResponse({
      success: true,
      card_last4: last4,
      card_brand: brand,
    });
  } catch (error: unknown) {
    console.error('[billing-validate-card] Error:', error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno ao validar cartão',
    }, 500);
  }
});
