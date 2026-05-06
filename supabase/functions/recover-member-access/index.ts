/**
 * Public self-service endpoint that resends member access links by e-mail.
 *
 * Flow:
 *   1. Customer enters their e-mail on the "restricted access" screen.
 *   2. We look up all customers + member_access records matching that e-mail.
 *   3. We bundle the active access links into a single branded e-mail.
 *   4. We always respond 200 with a generic message (no enumeration).
 *
 * Rate-limit: 3 attempts / 10 min per (email + ip), tracked via rate_limit_hits.
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

function buildEmailHtml(
  firstName: string,
  links: Array<{ courseTitle: string; url: string }>,
  isEnglish: boolean,
): string {
  const itemsHtml = links
    .map(
      (l) => `
      <div style="background:#f9fafb;border-radius:10px;padding:18px;margin:0 0 12px;border:1px solid #e5e7eb;">
        <p style="margin:0 0 10px;color:#111827;font-size:15px;font-weight:600;">${escapeHtml(l.courseTitle)}</p>
        <a href="${l.url}" style="display:inline-block;background:linear-gradient(135deg,#22c55e,#16a34a);color:#ffffff;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:14px;font-weight:600;">
          ${isEnglish ? 'Open course' : 'Acessar curso'}
        </a>
      </div>`,
    )
    .join('');

  return `<!DOCTYPE html>
  <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      <div style="background:linear-gradient(135deg,#22c55e,#16a34a);padding:28px 40px;text-align:center;">
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">
          ${isEnglish ? '🔓 Your access links' : '🔓 Seus links de acesso'}
        </h1>
      </div>
      <div style="padding:28px 40px;">
        <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 16px;">
          ${isEnglish ? 'Hi' : 'Olá'} <strong>${escapeHtml(firstName)}</strong>,
        </p>
        <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 22px;">
          ${
            isEnglish
              ? 'Here are the access links to all your courses:'
              : 'Aqui estão os links de acesso para todos os seus cursos:'
          }
        </p>
        ${itemsHtml}
        <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb;">
          <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0 0 14px;">
            ${
              isEnglish
                ? '💡 <strong>Tip:</strong> create your student account to access all your courses with a single login (just like Hotmart and Kiwify):'
                : '💡 <strong>Dica:</strong> crie sua conta de aluno para acessar todos os seus cursos com um único login (igual Hotmart e Kiwify):'
            }
          </p>
          <a href="${PORTAL_URL}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:13px;font-weight:600;">
            ${isEnglish ? 'Create my student account' : 'Criar minha conta de aluno'}
          </a>
        </div>
      </div>
      <div style="background:#f9fafb;padding:18px 40px;text-align:center;border-top:1px solid #e5e7eb;">
        <p style="color:#9ca3af;font-size:12px;margin:0;">
          ${isEnglish ? 'You requested this email from the member area login screen.' : 'Você solicitou este e-mail na tela de acesso à área de membros.'}
        </p>
      </div>
    </div>
  </body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const rawEmail = String(body?.email || '').trim().toLowerCase();
    const lang = body?.lang === 'en' ? 'en' : 'pt';
    const isEnglish = lang === 'en';

    // Generic OK response (used in all "no result" / rate-limit branches)
    const genericOk = () =>
      new Response(
        JSON.stringify({
          ok: true,
          message: isEnglish
            ? 'If we find an account with this e-mail, you will receive your access links shortly.'
            : 'Se encontrarmos uma conta com este e-mail, você receberá seus links de acesso em instantes.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );

    if (!rawEmail || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(rawEmail)) {
      return genericOk();
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Rate-limit: max 3 attempts / 10min per email
    const tenMinAgo = new Date(Date.now() - 10 * 60_000).toISOString();
    const { count } = await supabase
      .from('rate_limit_hits')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'recover-member-access')
      .eq('identifier', rawEmail)
      .gte('created_at', tenMinAgo);

    if ((count || 0) >= 3) {
      console.log(`[recover-member-access] Rate-limited: ${rawEmail}`);
      return genericOk();
    }

    await supabase.from('rate_limit_hits').insert({
      action: 'recover-member-access',
      identifier: rawEmail,
      blocked: false,
    });

    // Find customers with this email
    const { data: customers } = await supabase
      .from('customers')
      .select('id, name, email')
      .ilike('email', rawEmail);

    if (!customers || customers.length === 0) return genericOk();

    const customerIds = customers.map((c: any) => c.id);

    // Find active member_access records for those customers
    const { data: accesses } = await supabase
      .from('member_access')
      .select('id, access_token, course_id, expires_at, customer_id')
      .in('customer_id', customerIds);

    if (!accesses || accesses.length === 0) return genericOk();

    const now = Date.now();
    const activeAccesses = accesses.filter(
      (a: any) => !a.expires_at || new Date(a.expires_at).getTime() > now,
    );
    if (activeAccesses.length === 0) return genericOk();

    // Fetch course titles
    const courseIds = Array.from(new Set(activeAccesses.map((a: any) => a.course_id)));
    const { data: courses } = await supabase
      .from('courses')
      .select('id, title')
      .in('id', courseIds);
    const courseMap = new Map((courses || []).map((c: any) => [c.id, c.title]));

    // Group by customer (use first customer's name for greeting)
    const primaryCustomer = customers[0];
    const firstName = primaryCustomer.name?.split(' ')[0] || (isEnglish ? 'Student' : 'Aluno');

    // Deduplicate by course (keep most recent token per course)
    const seenCourses = new Set<string>();
    const links: Array<{ courseTitle: string; url: string }> = [];
    for (const a of activeAccesses) {
      if (seenCourses.has(a.course_id)) continue;
      seenCourses.add(a.course_id);
      const title = courseMap.get(a.course_id) || (isEnglish ? 'Course' : 'Curso');
      links.push({
        courseTitle: title,
        url: `${SITE_URL}/membros?token=${a.access_token}`,
      });
    }

    if (links.length === 0) return genericOk();

    // Send via Resend
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      console.warn('[recover-member-access] RESEND_API_KEY not configured');
      return genericOk();
    }

    const html = buildEmailHtml(firstName, links, isEnglish);
    const subject = isEnglish
      ? '🔓 Your course access links'
      : '🔓 Seus links de acesso aos cursos';

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'PanteraPay <noreply@app.panttera.com.br>',
        to: [primaryCustomer.email],
        subject,
        html,
      }),
    });

    const resendData = await resendRes.json().catch(() => ({}));

    try {
      await supabase.from('email_logs').insert({
        to_email: primaryCustomer.email,
        to_name: primaryCustomer.name,
        subject,
        html_body: html,
        email_type: 'access_recovery',
        status: resendRes.ok ? 'sent' : 'failed',
        resend_id: resendData?.id || null,
        customer_id: primaryCustomer.id,
        source: 'recover-member-access',
      });
    } catch (logErr) {
      console.error('[recover-member-access] Email log error (non-blocking):', logErr);
    }

    console.log(
      `[recover-member-access] Sent ${links.length} access link(s) to ${primaryCustomer.email}`,
    );

    return genericOk();
  } catch (err) {
    console.error('[recover-member-access] Error:', err);
    // Still respond OK to avoid leaking info
    return new Response(
      JSON.stringify({ ok: true, message: 'OK' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
