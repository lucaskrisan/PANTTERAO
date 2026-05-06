/**
 * Admin/producer endpoint to resend the access link e-mail for a paid order.
 * Used by the "Reenviar acesso" button in /admin/orders.
 *
 * Auth: producer must own the order, OR be super-admin.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SITE_URL = 'https://app.panttera.com.br';
const PORTAL_URL = `${SITE_URL}/minha-conta`;

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { order_id } = await req.json();
    if (!order_id) {
      return new Response(JSON.stringify({ error: 'order_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Fetch order + ownership check
    const { data: order } = await supabase
      .from('orders')
      .select('id, customer_id, product_id, user_id, status, metadata')
      .eq('id', order_id)
      .maybeSingle();

    if (!order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (order.user_id !== user.id) {
      const { data: isSuper } = await supabase.rpc('is_super_admin', { _user_id: user.id });
      if (!isSuper) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (!['paid', 'approved', 'confirmed'].includes(order.status)) {
      return new Response(JSON.stringify({ error: 'Order is not paid' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!order.customer_id) {
      return new Response(JSON.stringify({ error: 'Order has no customer' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find all member_access for this customer (covers main + bumps)
    const { data: accesses } = await supabase
      .from('member_access')
      .select('access_token, course_id, expires_at')
      .eq('customer_id', order.customer_id);

    const now = Date.now();
    const activeAccesses = (accesses || []).filter(
      (a: any) => !a.expires_at || new Date(a.expires_at).getTime() > now,
    );

    if (activeAccesses.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No active access links for this customer' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: customer } = await supabase
      .from('customers')
      .select('name, email')
      .eq('id', order.customer_id)
      .single();
    if (!customer?.email) {
      return new Response(JSON.stringify({ error: 'Customer has no email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine language from product currency
    let isEnglish = false;
    if (order.product_id) {
      const { data: prod } = await supabase
        .from('products')
        .select('currency')
        .eq('id', order.product_id)
        .maybeSingle();
      isEnglish = prod?.currency === 'USD';
    }

    const courseIds = Array.from(new Set(activeAccesses.map((a: any) => a.course_id)));
    const { data: courses } = await supabase
      .from('courses')
      .select('id, title')
      .in('id', courseIds);
    const courseMap = new Map((courses || []).map((c: any) => [c.id, c.title]));

    const seen = new Set<string>();
    const links: Array<{ title: string; url: string }> = [];
    for (const a of activeAccesses) {
      if (seen.has(a.course_id)) continue;
      seen.add(a.course_id);
      links.push({
        title: courseMap.get(a.course_id) || (isEnglish ? 'Course' : 'Curso'),
        url: `${SITE_URL}/membros?token=${a.access_token}`,
      });
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const firstName = escapeHtml(customer.name?.split(' ')[0] || (isEnglish ? 'Student' : 'Aluno'));
    const itemsHtml = links
      .map(
        (l) => `
        <div style="background:#f9fafb;border-radius:10px;padding:18px;margin:0 0 12px;border:1px solid #e5e7eb;">
          <p style="margin:0 0 10px;color:#111827;font-size:15px;font-weight:600;">${escapeHtml(l.title)}</p>
          <a href="${l.url}" style="display:inline-block;background:linear-gradient(135deg,#22c55e,#16a34a);color:#ffffff;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:14px;font-weight:600;">
            ${isEnglish ? 'Open course' : 'Acessar curso'}
          </a>
        </div>`,
      )
      .join('');

    const html = `<!DOCTYPE html>
    <html><head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <div style="background:linear-gradient(135deg,#22c55e,#16a34a);padding:28px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">
            ${isEnglish ? '🔓 Your course access' : '🔓 Seu acesso aos cursos'}
          </h1>
        </div>
        <div style="padding:28px 40px;">
          <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 16px;">
            ${isEnglish ? 'Hi' : 'Olá'} <strong>${firstName}</strong>,
          </p>
          <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 22px;">
            ${
              isEnglish
                ? 'Here are your access links again:'
                : 'Aqui estão seus links de acesso novamente:'
            }
          </p>
          ${itemsHtml}
          <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb;">
            <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0 0 14px;">
              ${
                isEnglish
                  ? '💡 Create your student account to access all your courses with one login:'
                  : '💡 Crie sua conta de aluno para acessar todos os cursos com um login só:'
              }
            </p>
            <a href="${PORTAL_URL}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:13px;font-weight:600;">
              ${isEnglish ? 'Create student account' : 'Criar conta de aluno'}
            </a>
          </div>
        </div>
      </div>
    </body></html>`;

    const subject = isEnglish
      ? '🔓 Your course access links'
      : '🔓 Seus links de acesso aos cursos';

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'PanteraPay <noreply@app.panttera.com.br>',
        to: [customer.email],
        subject,
        html,
      }),
    });
    const resendData = await resendRes.json().catch(() => ({}));

    try {
      await supabase.from('email_logs').insert({
        user_id: order.user_id,
        to_email: customer.email,
        to_name: customer.name,
        subject,
        html_body: html,
        email_type: 'access_link_resend',
        status: resendRes.ok ? 'sent' : 'failed',
        resend_id: resendData?.id || null,
        customer_id: order.customer_id,
        product_id: order.product_id,
        order_id: order.id,
        source: 'resend-access-link',
      });
    } catch (logErr) {
      console.error('[resend-access-link] Email log error:', logErr);
    }

    return new Response(
      JSON.stringify({
        ok: resendRes.ok,
        sent_to: customer.email,
        links_count: links.length,
      }),
      {
        status: resendRes.ok ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    console.error('[resend-access-link] Error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
