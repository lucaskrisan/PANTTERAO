import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const BILLING_URL = 'https://app.panttera.com.br/admin/billing';
const LOW_BALANCE_THRESHOLD = 20;
async function sendPush(title: string, message: string, userId: string, url: string) {
  const appId = Deno.env.get('ONESIGNAL_APP_ID');
  const apiKey = Deno.env.get('ONESIGNAL_REST_API_KEY');
  if (!appId || !apiKey) return;
  try {
    await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: { 'Authorization': `Key ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: appId,
        target_channel: 'push',
        headings: { en: title },
        contents: { en: message },
        filters: [{ field: 'tag', key: 'user_id', relation: '=', value: userId }],
        url,
        chrome_web_icon: 'https://app.panttera.com.br/pwa-192x192.png',
      }),
    });
  } catch (err) {
    console.error('[billing-notify] Push error:', err);
  }
}
async function sendEmail(to: string, name: string, subject: string, html: string) {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  if (!RESEND_API_KEY) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'PanteraPay <noreply@app.panttera.com.br>',
        to: [to],
        subject,
        html,
      }),
    });
  } catch (err) {
    console.error('[billing-notify] Email error:', err);
  }
}
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const { user_id, balance, is_blocked } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id required' }), { status: 400 });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    // Get producer email and name from auth.users
    // Skip super_admin — they are exempt from billing
    const { data: roleRows } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user_id)
      .eq('role', 'super_admin')
      .limit(1);

    if (roleRows && roleRows.length > 0) {
      console.log('[billing-notify] Skipping — user is super_admin');
      return new Response(JSON.stringify({ skipped: true, reason: 'super_admin' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: userErr } = await supabase.auth.admin.getUserById(user_id);
    if (userErr || !user?.email) {
      console.error('[billing-notify] User not found:', userErr);
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
    }
    const email = user.email;
    const name = user.user_metadata?.full_name || email.split('@')[0];
    const fmtBalance = `R$${Number(balance).toFixed(2).replace('.', ',')}`;
    if (is_blocked) {
      // Account blocked — send urgent notification
      const subject = '🚨 Conta PanteraPay bloqueada — Recarregue seu saldo';
      const html = `
        <!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,sans-serif;">
        <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <div style="background:linear-gradient(135deg,#ef4444,#dc2626);padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">🚨 Conta Bloqueada</h1>
          </div>
          <div style="padding:32px 40px;">
            <p style="color:#374151;font-size:16px;">Olá <strong>${name}</strong>,</p>
            <p style="color:#374151;font-size:15px;line-height:1.6;">
              Sua conta PanteraPay foi <strong>bloqueada</strong> porque seu saldo chegou a zero.
              Seus checkouts estão temporariamente desativados.
            </p>
            <p style="color:#374151;font-size:15px;line-height:1.6;">
              Recarregue seu saldo via PIX para reativar sua conta imediatamente.
            </p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${BILLING_URL}" style="display:inline-block;background:#22c55e;color:#fff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:16px;font-weight:600;">
                Recarregar Saldo Agora
              </a>
            </div>
          </div>
          <div style="background:#f9fafb;padding:20px 40px;text-align:center;">
            <p style="color:#9ca3af;font-size:12px;margin:0;">PanteraPay — Plataforma de Checkout</p>
          </div>
        </div>
        </body></html>
      `;
      await sendEmail(email, name, subject, html);
      await sendPush('🚨 Conta bloqueada!', 'Seu saldo zerou. Recarregue para reativar seus checkouts.', user_id, BILLING_URL);
    } else if (Number(balance) < LOW_BALANCE_THRESHOLD && Number(balance) >= 0) {
      // Low balance warning
      const subject = `⚠️ Saldo baixo — ${fmtBalance} restantes na PanteraPay`;
      const html = `
        <!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,sans-serif;">
        <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">⚠️ Saldo Baixo</h1>
          </div>
          <div style="padding:32px 40px;">
            <p style="color:#374151;font-size:16px;">Olá <strong>${name}</strong>,</p>
            <p style="color:#374151;font-size:15px;line-height:1.6;">
              Seu saldo na PanteraPay está em <strong>${fmtBalance}</strong>.
              Quando o saldo zerar, seus checkouts serão bloqueados automaticamente.
            </p>
            <p style="color:#374151;font-size:15px;line-height:1.6;">
              Recarregue agora para continuar vendendo sem interrupção.
            </p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${BILLING_URL}" style="display:inline-block;background:#22c55e;color:#fff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:16px;font-weight:600;">
                Adicionar Saldo
              </a>
            </div>
          </div>
          <div style="background:#f9fafb;padding:20px 40px;text-align:center;">
            <p style="color:#9ca3af;font-size:12px;margin:0;">PanteraPay — Plataforma de Checkout</p>
          </div>
        </div>
        </body></html>
      `;
      await sendEmail(email, name, subject, html);
      await sendPush('⚠️ Saldo baixo!', `Você tem ${fmtBalance} restantes. Recarregue para não ser bloqueado.`, user_id, BILLING_URL);
    }
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[billing-notify] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
