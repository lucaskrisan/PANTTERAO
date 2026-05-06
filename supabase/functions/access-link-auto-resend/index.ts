/**
 * Cron-driven silent re-send.
 * Runs hourly. For each paid order in the last 6h:
 *   - has at least one active member_access for the customer
 *   - the most recent access link e-mail was sent >= 30 min ago
 *   - we never re-sent automatically before
 *   - the customer has zero lesson_progress rows on those courses (i.e. never opened)
 * → re-send the access e-mail once. Marks order metadata.access_resent_at to avoid loops.
 *
 * No auth required (invoked by pg_cron via service-role).
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

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60_000).toISOString();
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60_000).toISOString();

  // Candidate orders: paid in [6h, 2h] window, no access_resent_at flag yet
  const { data: orders } = await supabase
    .from('orders')
    .select('id, customer_id, product_id, user_id, updated_at, metadata, status')
    .in('status', ['paid', 'approved', 'confirmed'])
    .gte('updated_at', sixHoursAgo)
    .lte('updated_at', twoHoursAgo)
    .limit(50);

  if (!orders || orders.length === 0) {
    return new Response(JSON.stringify({ ok: true, processed: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let resentCount = 0;
  let skipped = 0;

  for (const order of orders) {
    try {
      const meta = (order.metadata || {}) as Record<string, unknown>;
      if (meta.access_resent_at) {
        skipped++;
        continue;
      }
      if (!order.customer_id) {
        skipped++;
        continue;
      }

      // Get customer's active accesses
      const { data: accesses } = await supabase
        .from('member_access')
        .select('id, access_token, course_id, expires_at')
        .eq('customer_id', order.customer_id);

      const now = Date.now();
      const activeAccesses = (accesses || []).filter(
        (a: any) => !a.expires_at || new Date(a.expires_at).getTime() > now,
      );
      if (activeAccesses.length === 0) {
        skipped++;
        continue;
      }

      // If ANY access has lesson_progress, the student already opened — skip
      const accessIds = activeAccesses.map((a: any) => a.id);
      const { count: progressCount } = await supabase
        .from('lesson_progress')
        .select('*', { count: 'exact', head: true })
        .in('member_access_id', accessIds);
      if ((progressCount || 0) > 0) {
        // Mark to prevent re-checking
        await supabase
          .from('orders')
          .update({ metadata: { ...meta, access_resent_at: 'skipped_opened' } })
          .eq('id', order.id);
        skipped++;
        continue;
      }

      // Send
      const { data: customer } = await supabase
        .from('customers')
        .select('name, email')
        .eq('id', order.customer_id)
        .single();
      if (!customer?.email) {
        skipped++;
        continue;
      }

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

      const firstName = escapeHtml(
        customer.name?.split(' ')[0] || (isEnglish ? 'Student' : 'Aluno'),
      );
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
              ${isEnglish ? '👋 Did you receive your access?' : '👋 Você recebeu seu acesso?'}
            </h1>
          </div>
          <div style="padding:28px 40px;">
            <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 16px;">
              ${isEnglish ? 'Hi' : 'Olá'} <strong>${firstName}</strong>,
            </p>
            <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 22px;">
              ${
                isEnglish
                  ? 'We noticed you haven’t opened your course yet. Just in case, here’s your access link again:'
                  : 'Notamos que você ainda não abriu seu curso. Por garantia, aqui está seu link de acesso novamente:'
              }
            </p>
            ${itemsHtml}
            <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb;">
              <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0 0 14px;">
                ${
                  isEnglish
                    ? '💡 Tip: create your student account for one-login access to all courses:'
                    : '💡 Dica: crie sua conta de aluno e acesse todos os seus cursos com um login só:'
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
        ? '👋 Your course access — reminder'
        : '👋 Lembrete do seu acesso ao curso';

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
          email_type: 'access_link_auto_resend',
          status: resendRes.ok ? 'sent' : 'failed',
          resend_id: resendData?.id || null,
          customer_id: order.customer_id,
          product_id: order.product_id,
          order_id: order.id,
          source: 'access-link-auto-resend',
        });
      } catch {}

      // Mark order to prevent loops
      await supabase
        .from('orders')
        .update({
          metadata: { ...meta, access_resent_at: new Date().toISOString() },
        })
        .eq('id', order.id);

      if (resendRes.ok) resentCount++;
    } catch (err) {
      console.error(`[access-link-auto-resend] order ${order.id} error:`, err);
    }
  }

  return new Response(
    JSON.stringify({ ok: true, processed: orders.length, resent: resentCount, skipped }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
