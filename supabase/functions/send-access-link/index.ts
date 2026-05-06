import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Peek body for health-check (avoid double-consume by cloning)
    let bodyJson: any = {};
    try { bodyJson = await req.clone().json(); } catch {}
    if (bodyJson?.health_check === true) {
      return new Response(JSON.stringify({ ok: true, health_check: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- JWT Authentication ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // --- End Authentication ---

    const { customer_id, course_id, access_token } = bodyJson;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify caller owns the course (and fetch product currency to localize)
    const { data: course } = await supabase
      .from('courses')
      .select('title, user_id, product_id')
      .eq('id', course_id)
      .single();

    if (!course) {
      return new Response(
        JSON.stringify({ error: 'Course not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (course.user_id !== user.id) {
      const { data: isSuperAdmin } = await supabase.rpc('is_super_admin', { _user_id: user.id });
      if (!isSuperAdmin) {
        return new Response(
          JSON.stringify({ error: 'Forbidden' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Detect language from product currency (USD => English)
    let isEnglish = false;
    if (course.product_id) {
      const { data: product } = await supabase
        .from('products')
        .select('currency')
        .eq('id', course.product_id)
        .maybeSingle();
      isEnglish = product?.currency === 'USD';
    }

    // Get customer
    const { data: customer } = await supabase
      .from('customers')
      .select('name, email')
      .eq('id', customer_id)
      .single();

    if (!customer) {
      return new Response(
        JSON.stringify({ error: 'Customer not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build access URL
    const siteUrl = Deno.env.get('SITE_URL') || 'https://app.panttera.com.br';
    const accessUrl = `${siteUrl}/membros?token=${access_token}`;
    const portalUrl = `${siteUrl}/minha-conta`;

    // Send email via Resend
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const firstName = escapeHtml(customer.name?.split(' ')[0] || (isEnglish ? 'there' : 'cliente'));
    const courseTitle = escapeHtml(course.title);

    const headerTitle = isEnglish ? '🎉 Your access is ready!' : '🎉 Seu acesso está liberado!';
    const greeting = isEnglish ? `Hi <strong>${firstName}</strong>,` : `Olá <strong>${firstName}</strong>,`;
    const intro = isEnglish
      ? `Your access to <strong>"${courseTitle}"</strong> is ready! Click the button below to dive into the content:`
      : `Seu acesso ao curso <strong>"${courseTitle}"</strong> foi liberado com sucesso! Clique no botão abaixo para acessar todo o conteúdo:`;
    const ctaPrimary = isEnglish ? 'Access Course' : 'Acessar Curso';
    const ctaSecondary = isEnglish ? '🎓 Create my student account (lifetime access)' : '🎓 Criar minha conta de aluno (acesso vitalício)';
    const ctaSecondaryNote = isEnglish
      ? 'Sign in with Google or email and access all your courses with one login.'
      : 'Entre com Google ou e-mail e acesse todos os seus cursos com um único login.';
    const orCopy = isEnglish ? 'Or copy and paste this link into your browser:' : 'Ou copie e cole este link no seu navegador:';
    const footerText = isEnglish
      ? 'This is an automated email. Save this link to access your course anytime.'
      : 'Este é um email automático. Guarde este link para acessar seu curso.';

    const subject = isEnglish
      ? `Your access to "${course.title}" is ready! 🎉`
      : `Seu acesso ao curso "${course.title}" está liberado! 🎉`;

    const emailHtml = `
      <!DOCTYPE html>
      <html lang="${isEnglish ? 'en' : 'pt-BR'}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <div style="background:linear-gradient(135deg,#22c55e,#16a34a);padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">${headerTitle}</h1>
          </div>
          <div style="padding:32px 40px;">
            <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 16px;">
              ${greeting}
            </p>
            <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 24px;">
              ${intro}
            </p>
            <div style="text-align:center;margin:32px 0 16px;">
              <a href="${accessUrl}" style="display:inline-block;background:linear-gradient(135deg,#22c55e,#16a34a);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:16px;font-weight:600;box-shadow:0 4px 12px rgba(34,197,94,0.4);">
                ${ctaPrimary}
              </a>
            </div>
            <div style="text-align:center;margin:0 0 24px;">
              <a href="${portalUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">
                ${ctaSecondary}
              </a>
              <p style="color:#9ca3af;font-size:11px;line-height:1.5;margin:8px 0 0;">${ctaSecondaryNote}</p>
            </div>
            <p style="color:#6b7280;font-size:13px;line-height:1.5;margin:24px 0 0;padding-top:20px;border-top:1px solid #e5e7eb;">
              ${orCopy}<br>
              <a href="${accessUrl}" style="color:#22c55e;word-break:break-all;">${accessUrl}</a>
            </p>
          </div>
          <div style="background:#f9fafb;padding:20px 40px;text-align:center;">
            <p style="color:#9ca3af;font-size:12px;margin:0;">${footerText}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'PanteraPay <noreply@app.panttera.com.br>',
        to: [customer.email],
        subject,
        html: emailHtml,
      }),
    });

    const resendData = await resendRes.json();

    // Log email
    try {
      await supabase.from('email_logs').insert({
        to_email: customer.email,
        to_name: customer.name,
        subject,
        html_body: emailHtml,
        email_type: 'access_link',
        status: resendRes.ok ? 'sent' : 'failed',
        resend_id: resendData?.id || null,
        customer_id: customer_id,
        product_id: course.product_id,
        user_id: course.user_id,
        source: 'send-access-link',
        metadata: { language: isEnglish ? 'en' : 'pt-BR', resent_by: user.id },
      });
    } catch (logErr) {
      console.error('[send-access-link] Email log error:', logErr);
    }

    if (!resendRes.ok) {
      console.error('Resend error:', resendData);
      return new Response(
        JSON.stringify({
          success: true,
          email_sent: false,
          email_error: resendData.message || 'Email sending failed',
          access_url: accessUrl,
          customer_email: customer.email,
          course_title: course.title,
          language: isEnglish ? 'en' : 'pt-BR',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        email_sent: true,
        access_url: accessUrl,
        customer_email: customer.email,
        course_title: course.title,
        language: isEnglish ? 'en' : 'pt-BR',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
