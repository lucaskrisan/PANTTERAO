import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const META_API = 'https://graph.facebook.com/v22.0';

// ========== Meta API helpers ==========

async function metaFetch(endpoint: string, params: Record<string, string> = {}) {
  const token = Deno.env.get('META_ACCESS_TOKEN');
  if (!token) throw new Error('META_ACCESS_TOKEN not configured');

  const url = new URL(`${META_API}${endpoint}`);
  url.searchParams.set('access_token', token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}

async function getAllActiveAccounts(): Promise<string[]> {
  const direct = await metaFetch('/me/adaccounts', {
    fields: 'id,account_status',
    limit: '100',
  });
  const ids = new Set<string>();
  for (const acc of (direct.data || [])) {
    if (acc.account_status === 1) ids.add(acc.id);
  }

  try {
    const bms = await metaFetch('/me/businesses', { fields: 'id', limit: '50' });
    for (const bm of (bms.data || [])) {
      try {
        const owned = await metaFetch(`/${bm.id}/owned_ad_accounts`, { fields: 'id,account_status', limit: '100' });
        for (const acc of (owned.data || [])) {
          if (acc.account_status === 1) ids.add(acc.id);
        }
      } catch { /* skip */ }
    }
  } catch { /* no bm permission */ }

  return Array.from(ids);
}

async function getCampaignsForAccount(accountId: string) {
  const insightFields = 'spend,impressions,reach,frequency,cpm,ctr,cpc,actions,action_values,cost_per_action_type,purchase_roas';

  const campaigns = await metaFetch(`/${accountId}/campaigns`, {
    fields: 'id,name,status,objective,daily_budget,lifetime_budget',
    filtering: JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE'] }]),
    limit: '200',
  });

  const results = [];
  for (const c of (campaigns.data || [])) {
    try {
      const insights = await metaFetch(`/${c.id}/insights`, {
        fields: insightFields,
        date_preset: 'today',
      });
      results.push({ ...c, insights: insights.data?.[0] || null });
    } catch {
      results.push({ ...c, insights: null });
    }
  }
  return results;
}

// ========== Analysis (mirrors frontend logic) ==========

function getResults(insights: any): number {
  if (!insights?.actions) return 0;
  const purchase = insights.actions.find((a: any) =>
    a.action_type === 'offsite_conversion.fb_pixel_purchase' || a.action_type === 'purchase'
  );
  if (purchase) return parseInt(purchase.value || '0');
  const lead = insights.actions.find((a: any) => a.action_type === 'lead');
  if (lead) return parseInt(lead.value || '0');
  return 0;
}

function getConversionValue(insights: any): number {
  if (!insights?.action_values) return 0;
  const pv = insights.action_values.find((a: any) =>
    a.action_type === 'offsite_conversion.fb_pixel_purchase' || a.action_type === 'purchase'
  );
  return pv ? parseFloat(pv.value || '0') : 0;
}

function getROAS(insights: any): number {
  const spend = parseFloat(insights?.spend || '0');
  if (spend === 0) return 0;
  return getConversionValue(insights) / spend;
}

function getCPA(insights: any): number {
  const spend = parseFloat(insights?.spend || '0');
  const results = getResults(insights);
  return results > 0 ? spend / results : 0;
}

function fmt(v: number): string {
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

interface AlertMsg {
  title: string;
  body: string;
  priority: 'critical' | 'warning' | 'opportunity' | 'info';
}

function analyzeAndGenerateAlerts(campaigns: any[]): AlertMsg[] {
  const active = campaigns.filter((c: any) => c.status === 'ACTIVE' && c.insights);
  if (active.length === 0) return [{
    priority: 'info',
    title: '⏸️ AntonyAD: Nenhuma campanha ativa',
    body: 'Todas as campanhas estão pausadas. Se foi intencional, ok. Se não, ative pelo menos 1 campanha winner.',
  }];

  const alerts: AlertMsg[] = [];

  // Global metrics
  const totalSpend = active.reduce((s: number, c: any) => s + parseFloat(c.insights.spend || '0'), 0);
  const totalRevenue = active.reduce((s: number, c: any) => s + getConversionValue(c.insights), 0);
  const totalResults = active.reduce((s: number, c: any) => s + getResults(c.insights), 0);
  const avgCPM = active.reduce((s: number, c: any) => s + parseFloat(c.insights.cpm || '0'), 0) / active.length;
  const avgCTR = active.reduce((s: number, c: any) => s + parseFloat(c.insights.ctr || '0'), 0) / active.length;
  const avgFreq = active.reduce((s: number, c: any) => s + parseFloat(c.insights.frequency || '0'), 0) / active.length;
  const globalROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  // Health score
  let score = 50;
  if (globalROAS >= 3) score += 25;
  else if (globalROAS >= 2) score += 15;
  else if (globalROAS >= 1) score += 5;
  else if (globalROAS > 0 && globalROAS < 1) score -= 15;
  else if (totalSpend > 0 && totalResults === 0) score -= 25;
  if (avgCPM > 80) score -= 15;
  else if (avgCPM > 50) score -= 5;
  else if (avgCPM < 20) score += 10;
  if (avgCTR > 2) score += 10;
  else if (avgCTR > 1) score += 5;
  else if (avgCTR < 0.5) score -= 10;
  if (avgFreq > 3) score -= 15;
  else if (avgFreq > 2) score -= 5;
  score = Math.max(0, Math.min(100, score));

  // Identify winners and losers for decision-making
  const sorted = active.map((c: any) => ({
    name: c.name,
    roas: getROAS(c.insights),
    results: getResults(c.insights),
    cpa: getCPA(c.insights),
    spend: parseFloat(c.insights.spend || '0'),
    ctr: parseFloat(c.insights.ctr || '0'),
    freq: parseFloat(c.insights.frequency || '0'),
    cpm: parseFloat(c.insights.cpm || '0'),
  })).sort((a, b) => b.roas - a.roas);

  const winners = sorted.filter(c => c.roas >= 1.5 && c.results >= 1);
  const losers = sorted.filter(c => c.spend > 15 && c.roas < 1);
  const saturated = sorted.filter(c => c.freq > 3 || (c.ctr < 0.5 && c.spend > 30));

  // ===== DECISÃO PRINCIPAL DO DIA =====
  const hour = new Date().getUTCHours() - 3; // BRT approximation

  if (score >= 80) {
    const winnerNames = winners.slice(0, 2).map(w => w.name.substring(0, 25)).join(' e ');
    alerts.push({
      priority: 'opportunity',
      title: `🔥 AntonyAD: Escale agora! Score ${score}/100`,
      body: `ROAS ${globalROAS.toFixed(2)}x | ${totalResults} vendas | Gasto ${fmt(totalSpend)}. FAÇA AGORA: Aumente ${winnerNames ? '"' + winnerNames + '"' : 'winners'} em 20-30%. Leilão barato, aproveite!`,
    });
  } else if (score >= 60) {
    alerts.push({
      priority: 'info',
      title: `👍 AntonyAD: Dia bom — Score ${score}/100`,
      body: `ROAS ${globalROAS.toFixed(2)}x | ${totalResults} vendas. AÇÃO: Mantenha tudo rodando. ${winners.length > 0 ? 'Pode escalar "' + winners[0].name.substring(0, 25) + '" em 20% com segurança.' : 'Aguarde winners consolidarem.'}`,
    });
  } else if (score >= 40) {
    alerts.push({
      priority: 'warning',
      title: `⚠️ AntonyAD: Dia instável — Score ${score}/100`,
      body: `ROAS ${globalROAS.toFixed(2)}x | CPM ${fmt(avgCPM)}. AÇÃO: NÃO escale hoje. ${losers.length > 0 ? 'Pause "' + losers[0].name.substring(0, 25) + '" (ROAS ' + losers[0].roas.toFixed(2) + 'x). ' : ''}Mantenha apenas winners.`,
    });
  } else {
    alerts.push({
      priority: 'critical',
      title: `🚨 AntonyAD: AÇÃO URGENTE! Score ${score}/100`,
      body: `ROAS ${globalROAS.toFixed(2)}x | Gasto ${fmt(totalSpend)} | ${totalResults} vendas. FAÇA AGORA: ${losers.length > 0 ? 'Pause "' + losers[0].name.substring(0, 25) + '" imediatamente. ' : ''}Reduza orçamento geral em 20%. Proteja seu capital.`,
    });
  }

  // ===== DECISÕES POR CAMPANHA =====
  for (const c of sorted) {
    // Winner com decisão clara
    if (c.roas >= 2 && c.results >= 2) {
      alerts.push({
        priority: 'opportunity',
        title: `🏆 ESCALE: ${c.name.substring(0, 35)}`,
        body: `ROAS ${c.roas.toFixed(2)}x | ${c.results} vendas | CPA ${fmt(c.cpa)}. AÇÃO: Aumente orçamento em ${score >= 80 ? '30%' : '20%'}. ${c.results >= 5 ? 'Duplique o ad set e teste público lookalike.' : 'Aguarde 5+ vendas antes de duplicar.'}`,
      });
    }

    // Perdendo dinheiro — decisão de pausar
    if (c.spend > 20 && c.roas < 0.8 && c.results <= 1) {
      const killRule = c.cpa > 0 ? `Kill rule atingida (CPA ${fmt(c.cpa)}).` : `Já gastou ${fmt(c.spend)} sem retorno.`;
      alerts.push({
        priority: 'critical',
        title: `🛑 PAUSE: ${c.name.substring(0, 35)}`,
        body: `ROAS ${c.roas.toFixed(2)}x | ${killRule} AÇÃO: Pause agora. ${c.ctr < 0.8 ? 'CTR baixo (' + c.ctr.toFixed(2) + '%) — criativo fraco, troque.' : 'Teste novo público ou oferta.'}`,
      });
    }

    // Saturando — decisão de renovar
    if (c.freq > 3 && c.spend > 10) {
      alerts.push({
        priority: 'warning',
        title: `🔄 TROQUE CRIATIVO: ${c.name.substring(0, 30)}`,
        body: `Freq ${c.freq.toFixed(1)} | CTR ${c.ctr.toFixed(2)}%. Público saturado. AÇÃO: Crie novo ad set com criativo diferente na mesma campanha. Não altere o ad set atual, crie um novo.`,
      });
    }

    // Fase de aprendizado — decisão de NÃO mexer
    if (c.results > 0 && c.results < 5 && c.spend > 10 && c.roas >= 0.8) {
      alerts.push({
        priority: 'info',
        title: `⏳ NÃO MEXA: ${c.name.substring(0, 35)}`,
        body: `${c.results}/50 conversões | ROAS ${c.roas.toFixed(2)}x. Em aprendizado. AÇÃO: Não altere nada por 48-72h. Qualquer mudança reseta o algoritmo.`,
      });
    }

    // CPA bom mas poucos resultados — decisão de manter
    if (c.roas >= 1 && c.roas < 2 && c.results >= 1 && c.results < 3) {
      alerts.push({
        priority: 'info',
        title: `👀 MONITORE: ${c.name.substring(0, 35)}`,
        body: `ROAS ${c.roas.toFixed(2)}x com ${c.results} venda(s). Potencial winner. AÇÃO: Mantenha rodando. Se chegar a 3+ vendas com ROAS > 1.5x, escale 20%.`,
      });
    }
  }

  // Resumo financeiro no fim do dia (após 20h BRT)
  if (hour >= 20 && totalSpend > 0) {
    const profit = totalRevenue - totalSpend;
    alerts.push({
      priority: profit > 0 ? 'opportunity' : 'critical',
      title: profit > 0 ? `💰 Lucro do dia: ${fmt(profit)}` : `📉 Prejuízo do dia: ${fmt(Math.abs(profit))}`,
      body: `Faturou ${fmt(totalRevenue)} | Gastou ${fmt(totalSpend)} | ROAS ${globalROAS.toFixed(2)}x | ${totalResults} vendas. ${profit > 0 ? 'Amanhã repita a estratégia e escale winners.' : 'Amanhã reduza 20% do orçamento geral e revise criativos dos losers.'}`,
    });
  }

  return alerts;
}

// ========== OneSignal push ==========

async function sendPush(title: string, body: string, url?: string) {
  const appId = Deno.env.get('ONESIGNAL_APP_ID');
  const apiKey = Deno.env.get('ONESIGNAL_REST_API_KEY');
  if (!appId || !apiKey) throw new Error('OneSignal not configured');

  const payload = {
    app_id: appId,
    included_segments: ['Total Subscriptions'],
    target_channel: 'push',
    headings: { en: title },
    contents: { en: body },
    chrome_web_icon: 'https://app.panttera.com.br/pwa-192x192.png',
    url: url || 'https://app.panttera.com.br/admin/meta-ads',
  };

  const res = await fetch('https://api.onesignal.com/notifications', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return await res.json();
}

// ========== Main handler ==========

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate and verify super_admin
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user }, error: authErr } = await userClient.auth.getUser();
      if (authErr || !user) throw new Error('Unauthorized');

      const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const { data: roles } = await svc.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'super_admin');
      if (!roles || roles.length === 0) throw new Error('Forbidden');
    }

    const body = await req.json().catch(() => ({}));
    const isFullReport = body?.action === 'full_report';
    const filterAccountIds: string[] | null = body?.account_ids || null;

    console.log(`[meta-ads-alerts] Starting ${isFullReport ? 'full report' : 'analysis'}... Filter: ${filterAccountIds ? filterAccountIds.length + ' accounts' : 'ALL'}`);

    // Fetch all active accounts
    let accountIds = await getAllActiveAccounts();
    console.log(`[meta-ads-alerts] Found ${accountIds.length} active accounts`);

    // Filter by selected accounts if provided
    if (filterAccountIds && filterAccountIds.length > 0) {
      accountIds = accountIds.filter(id => filterAccountIds.includes(id));
      console.log(`[meta-ads-alerts] Filtered to ${accountIds.length} selected accounts`);
    }

    if (accountIds.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No active accounts', alerts: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Full report mode: return raw campaign data with today, 7d, and lifetime
    if (isFullReport) {
      const insightFields = 'spend,impressions,reach,frequency,cpm,ctr,cpc,actions,action_values,cost_per_action_type,purchase_roas';
      const allData: any[] = [];
      
      const accountResults = await Promise.allSettled(accountIds.map(async (accId) => {
        const accInfo = await metaFetch(`/${accId}`, { fields: 'name' });
        const campaigns = await metaFetch(`/${accId}/campaigns`, {
          fields: 'id,name,status,objective,daily_budget,lifetime_budget,effective_status',
          filtering: JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE'] }]),
          limit: '50',
        });
        
        const campaignResults = await Promise.allSettled((campaigns.data || []).map(async (c: any) => {
          const [todayRes, weekRes, maxRes] = await Promise.all([
            metaFetch(`/${c.id}/insights`, { fields: insightFields, date_preset: 'today' }).catch(() => ({ data: [] })),
            metaFetch(`/${c.id}/insights`, { fields: insightFields, date_preset: 'last_7d' }).catch(() => ({ data: [] })),
            metaFetch(`/${c.id}/insights`, { fields: insightFields, date_preset: 'maximum' }).catch(() => ({ data: [] })),
          ]);
          return {
            account_id: accId,
            account_name: accInfo.name || accId,
            ...c,
            insights_today: todayRes.data?.[0] || null,
            insights_7d: weekRes.data?.[0] || null,
            insights_lifetime: maxRes.data?.[0] || null,
          };
        }));
        
        return campaignResults
          .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
          .map(r => r.value);
      }));

      for (const r of accountResults) {
        if (r.status === 'fulfilled' && r.value) allData.push(...r.value);
      }

      console.log(`[meta-ads-alerts] Full report: ${allData.length} campaigns`);
      return new Response(JSON.stringify({ success: true, campaigns: allData }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch campaigns from all accounts (normal alert mode)
    const allCampaigns = [];
    for (const accId of accountIds) {
      try {
        const campaigns = await getCampaignsForAccount(accId);
        allCampaigns.push(...campaigns);
      } catch (err) {
        console.error(`[meta-ads-alerts] Error fetching account ${accId}:`, (err as Error).message);
      }
    }

    console.log(`[meta-ads-alerts] Analyzed ${allCampaigns.length} campaigns`);

    // Generate alerts
    const alerts = analyzeAndGenerateAlerts(allCampaigns);
    console.log(`[meta-ads-alerts] Generated ${alerts.length} alerts`);

    if (alerts.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No alerts to send', alerts: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send push for each alert (max 5 to avoid spam)
    const toSend = alerts.slice(0, 5);
    const pushResults = [];

    for (const alert of toSend) {
      try {
        const result = await sendPush(alert.title, alert.body);
        pushResults.push({ title: alert.title, sent: !!result.id });
        console.log(`[meta-ads-alerts] Push sent: ${alert.title}`);
      } catch (err) {
        console.error(`[meta-ads-alerts] Push error:`, (err as Error).message);
        pushResults.push({ title: alert.title, sent: false, error: (err as Error).message });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      accounts: accountIds.length,
      campaigns: allCampaigns.length,
      alerts_generated: alerts.length,
      alerts_sent: pushResults.filter((r) => r.sent).length,
      details: pushResults,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[meta-ads-alerts] Error:', (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
