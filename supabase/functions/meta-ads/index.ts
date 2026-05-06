import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const META_API = 'https://graph.facebook.com/v22.0';

async function authenticateUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Unauthorized');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Invalid token');

  // Only super_admin can access Meta Ads data
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const { data: roles } = await serviceClient
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'super_admin');

  if (!roles || roles.length === 0) {
    throw new Error('Forbidden');
  }

  return user;
}

async function metaFetch(endpoint: string, params: Record<string, string> = {}, method = 'GET', body?: any) {
  const token = Deno.env.get('META_ACCESS_TOKEN');
  if (!token) throw new Error('META_ACCESS_TOKEN not configured');

  const url = new URL(`${META_API}${endpoint}`);
  url.searchParams.set('access_token', token);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const options: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
  if (body && method === 'POST') {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url.toString(), options);
  const data = await res.json();

  if (data.error) {
    throw new Error(data.error.message || JSON.stringify(data.error));
  }

  return data;
}

// ========== Handlers ==========

async function listAccounts() {
  // 1. Direct ad accounts
  const direct = await metaFetch('/me/adaccounts', {
    fields: 'id,name,account_id,currency,account_status,amount_spent',
    limit: '100',
  });
  const allAccounts = new Map<string, any>();
  for (const acc of (direct.data || [])) {
    allAccounts.set(acc.id, acc);
  }

  // 2. Ad accounts from all Business Managers
  try {
    const businesses = await metaFetch('/me/businesses', { fields: 'id,name', limit: '100' });
    for (const bm of (businesses.data || [])) {
      try {
        const bmAccounts = await metaFetch(`/${bm.id}/owned_ad_accounts`, {
          fields: 'id,name,account_id,currency,account_status,amount_spent',
          limit: '100',
        });
        for (const acc of (bmAccounts.data || [])) {
          if (!allAccounts.has(acc.id)) {
            allAccounts.set(acc.id, acc);
          }
        }
        // Also fetch client ad accounts
        const clientAccounts = await metaFetch(`/${bm.id}/client_ad_accounts`, {
          fields: 'id,name,account_id,currency,account_status,amount_spent',
          limit: '100',
        });
        for (const acc of (clientAccounts.data || [])) {
          if (!allAccounts.has(acc.id)) {
            allAccounts.set(acc.id, acc);
          }
        }
      } catch {
        // Skip BMs with permission issues
      }
    }
  } catch {
    // Token may not have business_management permission
  }

  return Array.from(allAccounts.values());
}

async function listCampaigns(accountId: string, datePreset: string, since?: string, until?: string, includeAll = false, dailyBreakdown = false) {
  const fields = 'id,name,status,objective,daily_budget,lifetime_budget,budget_remaining,effective_status,start_time,updated_time';
  const insightFields = 'spend,impressions,reach,frequency,cpm,ctr,cpc,actions,action_values,cost_per_action_type,purchase_roas';
  
  const fetchParams: Record<string, string> = { fields, limit: '200' };
  if (!includeAll) {
    fetchParams.filtering = JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE'] }]);
  } else {
    fetchParams.filtering = JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE', 'PAUSED', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED', 'IN_PROCESS', 'WITH_ISSUES'] }]);
  }

  const campaigns = await metaFetch(`/${accountId}/campaigns`, fetchParams);

  const results = [];
  for (const campaign of (campaigns.data || [])) {
    try {
      const insightParams: Record<string, string> = { fields: insightFields };
      if (since && until) {
        insightParams.time_range = JSON.stringify({ since, until });
      } else {
        insightParams.date_preset = datePreset || 'today';
      }
      if (dailyBreakdown) {
        insightParams.time_increment = '1';
      }
      const insights = await metaFetch(`/${campaign.id}/insights`, insightParams);
      results.push({ 
        ...campaign, 
        insights: dailyBreakdown ? (insights.data || []) : (insights.data?.[0] || null),
        daily_insights: dailyBreakdown ? (insights.data || []) : undefined,
      });
    } catch {
      results.push({ ...campaign, insights: dailyBreakdown ? [] : null, daily_insights: dailyBreakdown ? [] : undefined });
    }
  }

  return results;
}

async function listAdSets(accountId: string, datePreset: string, since?: string, until?: string, includeAll = false, dailyBreakdown = false) {
  const fields = 'id,name,status,campaign_id,daily_budget,lifetime_budget,budget_remaining,optimization_goal,billing_event,effective_status,start_time';
  const insightFields = 'spend,impressions,reach,frequency,cpm,ctr,cpc,actions,action_values,cost_per_action_type,purchase_roas';

  const fetchParams: Record<string, string> = { fields, limit: '200' };
  if (!includeAll) {
    fetchParams.filtering = JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE'] }]);
  } else {
    fetchParams.filtering = JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE', 'PAUSED', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED', 'IN_PROCESS', 'WITH_ISSUES'] }]);
  }

  const adsets = await metaFetch(`/${accountId}/adsets`, fetchParams);

  const results = [];
  for (const adset of (adsets.data || [])) {
    try {
      const insightParams: Record<string, string> = { fields: insightFields };
      if (since && until) {
        insightParams.time_range = JSON.stringify({ since, until });
      } else {
        insightParams.date_preset = datePreset || 'today';
      }
      if (dailyBreakdown) {
        insightParams.time_increment = '1';
      }
      const insights = await metaFetch(`/${adset.id}/insights`, insightParams);
      results.push({ 
        ...adset, 
        insights: dailyBreakdown ? (insights.data || []) : (insights.data?.[0] || null),
        daily_insights: dailyBreakdown ? (insights.data || []) : undefined,
      });
    } catch {
      results.push({ ...adset, insights: dailyBreakdown ? [] : null, daily_insights: dailyBreakdown ? [] : undefined });
    }
  }

  return results;
}

async function listAds(accountId: string, datePreset: string, since?: string, until?: string, includeAll = false, dailyBreakdown = false) {
  const fields = 'id,name,status,adset_id,campaign_id,creative{title,body,thumbnail_url},effective_status';
  const insightFields = 'spend,impressions,reach,frequency,cpm,ctr,cpc,actions,action_values,cost_per_action_type,purchase_roas';

  const fetchParams: Record<string, string> = { fields, limit: '200' };
  if (!includeAll) {
    fetchParams.filtering = JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE'] }]);
  } else {
    fetchParams.filtering = JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE', 'PAUSED', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED', 'IN_PROCESS', 'WITH_ISSUES'] }]);
  }

  const ads = await metaFetch(`/${accountId}/ads`, fetchParams);

  const results = [];
  for (const ad of (ads.data || [])) {
    try {
      const insightParams: Record<string, string> = { fields: insightFields };
      if (since && until) {
        insightParams.time_range = JSON.stringify({ since, until });
      } else {
        insightParams.date_preset = datePreset || 'today';
      }
      if (dailyBreakdown) {
        insightParams.time_increment = '1';
      }
      const insights = await metaFetch(`/${ad.id}/insights`, insightParams);
      results.push({ 
        ...ad, 
        insights: dailyBreakdown ? (insights.data || []) : (insights.data?.[0] || null),
        daily_insights: dailyBreakdown ? (insights.data || []) : undefined,
      });
    } catch {
      results.push({ ...ad, insights: dailyBreakdown ? [] : null, daily_insights: dailyBreakdown ? [] : undefined });
    }
  }

  return results;
}

async function updateStatus(objectId: string, newStatus: string) {
  const token = Deno.env.get('META_ACCESS_TOKEN')!;
  const res = await fetch(`${META_API}/${objectId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `status=${newStatus}&access_token=${token}`,
  });
  return await res.json();
}

async function updateBudget(objectId: string, budgetType: string, amount: string) {
  const token = Deno.env.get('META_ACCESS_TOKEN')!;
  const res = await fetch(`${META_API}/${objectId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `${budgetType}=${amount}&access_token=${token}`,
  });
  return await res.json();
}

async function duplicateObject(objectId: string, objectType: string) {
  const token = Deno.env.get('META_ACCESS_TOKEN')!;
  const endpoint = objectType === 'campaign' ? 'copies' : 'copies';
  const res = await fetch(`${META_API}/${objectId}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `status_option=PAUSED&access_token=${token}`,
  });
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await authenticateUser(req);
    const { action, account_id, date_preset, since, until, object_id, new_status, budget_type, budget_amount, object_type, include_all, daily_breakdown } = await req.json();

    let result: any;

    switch (action) {
      case 'list_accounts':
        result = await listAccounts();
        break;
      case 'account_insights': {
        const insightFields = 'spend,impressions,reach,frequency,cpm,ctr,cpc,actions,action_values,cost_per_action_type,purchase_roas';
        const insightParams: Record<string, string> = { fields: insightFields };
        if (since && until) {
          insightParams.time_range = JSON.stringify({ since, until });
        } else {
          insightParams.date_preset = date_preset || 'today';
        }
        const insightsRes = await metaFetch(`/${account_id}/insights`, insightParams);
        result = insightsRes.data?.[0] || null;
        break;
      }
      case 'list_campaigns':
        result = await listCampaigns(account_id, date_preset, since, until, include_all, daily_breakdown);
        break;
      case 'list_adsets':
        result = await listAdSets(account_id, date_preset, since, until, include_all, daily_breakdown);
        break;
      case 'list_ads':
        result = await listAds(account_id, date_preset, since, until, include_all, daily_breakdown);
        break;
      case 'update_status':
        result = await updateStatus(object_id, new_status);
        break;
      case 'update_budget':
        result = await updateBudget(object_id, budget_type, budget_amount);
        break;
      case 'duplicate':
        result = await duplicateObject(object_id, object_type);
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errMsg = (error as Error)?.message || 'Unknown error';
    console.error('[meta-ads] Error:', errMsg);
    return new Response(JSON.stringify({ error: errMsg }), {
      status: errMsg === 'Unauthorized' || errMsg === 'Invalid token' ? 401 : errMsg === 'Forbidden' ? 403 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
