import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify the caller is a super_admin
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: roleCheck } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'super_admin')
      .maybeSingle();

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { product_id, product_name, producer_user_id, status, reason } = await req.json();

    if (!product_id || !producer_user_id || !status) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get producer email from auth.users
    const { data: producerAuth } = await supabase.auth.admin.getUserById(producer_user_id);
    if (!producerAuth?.user?.email) {
      return new Response(JSON.stringify({ error: 'Producer email not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', producer_user_id)
      .single();

    const producerName = profile?.full_name || 'Produtor';
    const producerEmail = producerAuth.user.email;

    const isApproved = status === 'approved';
    const subject = isApproved
      ? `✅ Produto "${product_name}" aprovado!`
      : `❌ Produto "${product_name}" não foi aprovado`;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#0B0B0D;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#141419;border-radius:12px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;">
    <div style="padding:32px 28px;text-align:center;background:${isApproved ? 'linear-gradient(135deg,rgba(0,230,118,0.15),rgba(0,200,83,0.05))' : 'linear-gradient(135deg,rgba(239,68,68,0.15),rgba(220,38,38,0.05))'};">
      <div style="font-size:48px;margin-bottom:12px;">${isApproved ? '✅' : '❌'}</div>
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">
        ${isApproved ? 'Produto Aprovado!' : 'Produto Reprovado'}
      </h1>
    </div>
    <div style="padding:28px;">
      <p style="color:#9A9AA5;font-size:14px;line-height:1.6;margin:0 0 16px;">
        Olá <strong style="color:#fff;">${producerName}</strong>,
      </p>
      <p style="color:#9A9AA5;font-size:14px;line-height:1.6;margin:0 0 16px;">
        ${isApproved
          ? `Seu produto <strong style="color:#fff;">"${product_name}"</strong> foi revisado e <strong style="color:#00E676;">aprovado</strong> pela nossa equipe. Os links de checkout já estão ativos e você pode começar a vender!`
          : `Seu produto <strong style="color:#fff;">"${product_name}"</strong> foi revisado, mas <strong style="color:#ef4444;">não foi aprovado</strong> neste momento.`
        }
      </p>
      ${!isApproved && reason ? `
      <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:16px;margin:16px 0;">
        <p style="color:#ef4444;font-size:12px;font-weight:600;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.05em;">Motivo da reprovação</p>
        <p style="color:#fca5a5;font-size:14px;line-height:1.5;margin:0;">${reason}</p>
      </div>
      <p style="color:#9A9AA5;font-size:14px;line-height:1.6;margin:16px 0 0;">
        Você pode editar o produto e reenviar para revisão a qualquer momento pelo painel.
      </p>
      ` : ''}
      ${isApproved ? `
      <div style="text-align:center;margin-top:24px;">
        <a href="https://app.panttera.com.br/admin/products" style="display:inline-block;padding:12px 32px;background:#00E676;color:#0B0B0D;font-weight:700;font-size:14px;border-radius:8px;text-decoration:none;">
          Ver meus produtos
        </a>
      </div>
      ` : ''}
    </div>
    <div style="padding:20px 28px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
      <p style="color:#6A6A75;font-size:11px;margin:0;">PanteraPay — Plataforma de vendas</p>
    </div>
  </div>
</body>
</html>`;

    // Send via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (resendApiKey) {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'PanteraPay <noreply@app.panttera.com.br>',
          to: [producerEmail],
          subject,
          html,
        }),
      });

      if (!emailRes.ok) {
        const errData = await emailRes.text();
        console.error('[product-moderation-email] Resend error:', errData);
      }

      // Log the email
      await supabase.from('email_logs').insert({
        user_id: producer_user_id,
        to_email: producerEmail,
        to_name: producerName,
        subject,
        email_type: 'product_moderation',
        status: emailRes.ok ? 'sent' : 'failed',
        html_body: html,
        metadata: { product_id, moderation_status: status },
      });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[product-moderation-email] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
