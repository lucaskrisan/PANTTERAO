import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MetaAccount {
  id: string;
  name: string;
  account_id: string;
  currency: string;
  account_status: number;
  amount_spent: string;
}

export interface MetaInsights {
  spend: string;
  impressions: string;
  reach: string;
  frequency: string;
  cpm: string;
  ctr: string;
  cpc: string;
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
  cost_per_action_type?: Array<{ action_type: string; value: string }>;
  purchase_roas?: Array<{ action_type: string; value: string }>;
}

export interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  daily_budget?: string;
  lifetime_budget?: string;
  budget_remaining?: string;
  insights: MetaInsights | null;
  _account_id?: string;
  _account_name?: string;
}

export interface MetaAdSet {
  id: string;
  name: string;
  status: string;
  campaign_id: string;
  daily_budget?: string;
  lifetime_budget?: string;
  budget_remaining?: string;
  optimization_goal?: string;
  billing_event?: string;
  insights: MetaInsights | null;
  _account_id?: string;
}

export interface MetaAd {
  id: string;
  name: string;
  status: string;
  adset_id: string;
  campaign_id: string;
  creative?: { title?: string; body?: string; thumbnail_url?: string };
  insights: MetaInsights | null;
  _account_id?: string;
}

type DatePreset = "today" | "yesterday" | "last_7d" | "last_30d" | "custom";

async function callMetaAds(payload: Record<string, any>) {
  const { data, error } = await supabase.functions.invoke("meta-ads", {
    body: payload,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data?.data;
}

export function useMetaAds() {
  const [accounts, setAccounts] = useState<MetaAccount[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [adsets, setAdsets] = useState<MetaAdSet[]>([]);
  const [ads, setAds] = useState<MetaAd[]>([]);
  const [accountInsights, setAccountInsights] = useState<MetaInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [customRange, setCustomRange] = useState<{ since: string; until: string } | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const getDateParams = useCallback(() => {
    if (datePreset === "custom" && customRange) {
      return { since: customRange.since, until: customRange.until };
    }
    return { date_preset: datePreset };
  }, [datePreset, customRange]);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callMetaAds({ action: "list_accounts" });
      setAccounts(data || []);
      if (data?.length > 0 && selectedAccounts.length === 0) {
        setSelectedAccounts([data[0].id]);
      }
    } catch (err: any) {
      toast.error("Erro ao buscar contas: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedAccounts.length]);

  const fetchForAccounts = useCallback(
    async (action: string, accountIds: string[], extraParams: Record<string, any> = {}) => {
      const results = await Promise.all(
        accountIds.map(async (accId) => {
          try {
            const data = await callMetaAds({
              action,
              account_id: accId,
              include_all: true,
              ...getDateParams(),
              ...extraParams,
            });
            const accName = accounts.find((a) => a.id === accId)?.name || accId;
            return (data || []).map((item: any) => ({
              ...item,
              _account_id: accId,
              _account_name: accName,
            }));
          } catch {
            return [];
          }
        })
      );
      return results.flat();
    },
    [getDateParams, accounts]
  );

  const fetchCampaigns = useCallback(async () => {
    if (selectedAccounts.length === 0) return;
    setLoading(true);
    try {
      const data = await Promise.all(
        selectedAccounts.map(async (accId) => {
          try {
            const d = await callMetaAds({
              action: "list_campaigns",
              account_id: accId,
              include_all: true,
              ...getDateParams(),
            });
            const accName = accounts.find((a) => a.id === accId)?.name || accId;
            return (d || []).map((item: any) => ({
              ...item,
              _account_id: accId,
              _account_name: accName,
            }));
          } catch {
            return [];
          }
        })
      );
      setCampaigns(data.flat());
      setLastRefresh(new Date());
    } catch (err: any) {
      toast.error("Erro ao buscar campanhas: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedAccounts, getDateParams, accounts]);

  const fetchAdSets = useCallback(async () => {
    if (selectedAccounts.length === 0) return;
    setLoading(true);
    try {
      const data = await fetchForAccounts("list_adsets", selectedAccounts);
      setAdsets(data);
      setLastRefresh(new Date());
    } catch (err: any) {
      toast.error("Erro ao buscar conjuntos: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedAccounts, fetchForAccounts]);

  const fetchAds = useCallback(async () => {
    if (selectedAccounts.length === 0) return;
    setLoading(true);
    try {
      const data = await fetchForAccounts("list_ads", selectedAccounts);
      setAds(data);
      setLastRefresh(new Date());
    } catch (err: any) {
      toast.error("Erro ao buscar anúncios: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedAccounts, fetchForAccounts]);

  const toggleStatus = useCallback(async (objectId: string, currentStatus: string) => {
    const newStatus = currentStatus === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try {
      await callMetaAds({ action: "update_status", object_id: objectId, new_status: newStatus });
      toast.success(newStatus === "ACTIVE" ? "Ativado!" : "Pausado!");
      return newStatus;
    } catch (err: any) {
      toast.error("Erro: " + err.message);
      return currentStatus;
    }
  }, []);

  const updateBudget = useCallback(async (objectId: string, budgetType: string, amount: string) => {
    try {
      await callMetaAds({ action: "update_budget", object_id: objectId, budget_type: budgetType, budget_amount: amount });
      toast.success("Orçamento atualizado!");
      return true;
    } catch (err: any) {
      toast.error("Erro: " + err.message);
      return false;
    }
  }, []);

  const duplicate = useCallback(async (objectId: string, objectType: string) => {
    try {
      await callMetaAds({ action: "duplicate", object_id: objectId, object_type: objectType });
      toast.success("Duplicado com sucesso!");
      return true;
    } catch (err: any) {
      toast.error("Erro: " + err.message);
      return false;
    }
  }, []);

  const toggleAccount = useCallback((accountId: string) => {
    setSelectedAccounts((prev) => {
      if (prev.includes(accountId)) {
        if (prev.length === 1) return prev; // keep at least one
        return prev.filter((id) => id !== accountId);
      }
      return [...prev, accountId];
    });
  }, []);

  const selectAllAccounts = useCallback(() => {
    setSelectedAccounts(accounts.map((a) => a.id));
  }, [accounts]);

  const fetchAccountInsights = useCallback(async () => {
    if (selectedAccounts.length === 0) return;
    try {
      const results = await Promise.all(
        selectedAccounts.map((accId) =>
          callMetaAds({ action: "account_insights", account_id: accId, ...getDateParams() })
        )
      );
      // Merge insights from all selected accounts
      const merged: MetaInsights = { spend: "0", impressions: "0", reach: "0", frequency: "0", cpm: "0", ctr: "0", cpc: "0", actions: [], action_values: [], cost_per_action_type: [], purchase_roas: [] };
      for (const ins of results) {
        if (!ins) continue;
        merged.spend = String(parseFloat(merged.spend) + parseFloat(ins.spend || "0"));
        merged.impressions = String(parseFloat(merged.impressions) + parseFloat(ins.impressions || "0"));
        merged.reach = String(parseFloat(merged.reach) + parseFloat(ins.reach || "0"));
        // Merge actions
        for (const a of (ins.actions || [])) {
          const existing = merged.actions!.find((e) => e.action_type === a.action_type);
          if (existing) existing.value = String(parseFloat(existing.value) + parseFloat(a.value));
          else merged.actions!.push({ ...a });
        }
        for (const a of (ins.action_values || [])) {
          const existing = merged.action_values!.find((e) => e.action_type === a.action_type);
          if (existing) existing.value = String(parseFloat(existing.value) + parseFloat(a.value));
          else merged.action_values!.push({ ...a });
        }
        for (const a of (ins.cost_per_action_type || [])) {
          const existing = merged.cost_per_action_type!.find((e) => e.action_type === a.action_type);
          if (existing) existing.value = String((parseFloat(existing.value) + parseFloat(a.value)) / 2);
          else merged.cost_per_action_type!.push({ ...a });
        }
        for (const a of (ins.purchase_roas || [])) {
          const existing = merged.purchase_roas!.find((e) => e.action_type === a.action_type);
          if (existing) existing.value = String(parseFloat(existing.value) + parseFloat(a.value));
          else merged.purchase_roas!.push({ ...a });
        }
      }
      setAccountInsights(merged);
    } catch {
      // fallback: keep null, page will use campaign aggregation
    }
  }, [selectedAccounts, getDateParams]);

  return {
    accounts, selectedAccounts, setSelectedAccounts, toggleAccount, selectAllAccounts,
    campaigns, adsets, ads, accountInsights,
    loading, datePreset, setDatePreset,
    customRange, setCustomRange,
    lastRefresh,
    fetchAccounts, fetchCampaigns, fetchAdSets, fetchAds, fetchAccountInsights,
    toggleStatus, updateBudget, duplicate,
  };
}
