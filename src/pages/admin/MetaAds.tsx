import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutGrid, Megaphone, Layers, FileImage, BarChart3, Table2, Bell } from "lucide-react";
import { useMetaAds } from "@/hooks/useMetaAds";
import { MetaAdsHeader } from "@/components/admin/meta-ads/MetaAdsHeader";
import { MetaDataTable } from "@/components/admin/meta-ads/MetaDataTable";
import { MetaAdsFunnel } from "@/components/admin/meta-ads/MetaAdsFunnel";
import { MetaAdsSummary } from "@/components/admin/meta-ads/MetaAdsSummary";
import { MetaAdsAlerts } from "@/components/admin/meta-ads/MetaAdsAlerts";
import { MetaBudgetCalculator } from "@/components/admin/meta-ads/MetaBudgetCalculator";
import { formatCurrency, getResults, getConversionValue } from "@/components/admin/meta-ads/MetaInsightsHelpers";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function MetaAds() {
  const { isSuperAdmin, user } = useAuth();
  const {
    accounts, selectedAccounts, setSelectedAccounts, toggleAccount, selectAllAccounts,
    campaigns, adsets, ads, accountInsights,
    loading, datePreset, setDatePreset,
    customRange, setCustomRange, lastRefresh,
    fetchAccounts, fetchCampaigns, fetchAdSets, fetchAds, fetchAccountInsights,
    toggleStatus, updateBudget, duplicate,
  } = useMetaAds();

  const [mainTab, setMainTab] = useState("resumo");
  const [dataTab, setDataTab] = useState("campaigns");

  useEffect(() => { if (isSuperAdmin) fetchAccounts(); }, [isSuperAdmin]);

  useEffect(() => {
    if (!isSuperAdmin || selectedAccounts.length === 0) return;
    fetchCampaigns();
    fetchAccountInsights();
  }, [isSuperAdmin, selectedAccounts, datePreset, customRange]);

  useEffect(() => {
    if (!isSuperAdmin || selectedAccounts.length === 0 || mainTab !== "campanhas") return;
    if (dataTab === "adsets") fetchAdSets();
    else if (dataTab === "ads") fetchAds();
  }, [isSuperAdmin, selectedAccounts, dataTab, mainTab, datePreset, customRange]);

  // Block access for non-super_admin users (after all hooks)
  if (!isSuperAdmin) {
    return <Navigate to="/admin" replace />;
  }

  const handleRefresh = () => {
    fetchCampaigns();
    fetchAccountInsights();
    if (mainTab === "campanhas") {
      if (dataTab === "adsets") fetchAdSets();
      else if (dataTab === "ads") fetchAds();
    }
  };

  // Use account-level insights (most accurate) with campaign fallback
  const summary = accountInsights
    ? {
        spend: parseFloat(accountInsights.spend || "0"),
        results: getResults(accountInsights),
        convValue: getConversionValue(accountInsights),
      }
    : campaigns.reduce(
        (acc, item) => {
          const ins = item.insights;
          if (!ins) return acc;
          acc.spend += parseFloat(ins.spend || "0");
          acc.results += getResults(ins);
          acc.convValue += getConversionValue(ins);
          return acc;
        },
        { spend: 0, results: 0, convValue: 0 }
      );

  const globalROAS = summary.spend > 0 ? summary.convValue / summary.spend : 0;

  return (
    <div className="space-y-4">
      <div className="bg-[hsl(222,30%,14%)] border border-slate-700/50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-200">Meta Ads</h2>
        </div>
        <MetaAdsHeader
          accounts={accounts}
          selectedAccounts={selectedAccounts}
          onToggleAccount={toggleAccount}
          onSelectAll={selectAllAccounts}
          datePreset={datePreset}
          onDatePreset={(v) => setDatePreset(v as any)}
          customRange={customRange}
          onCustomRange={setCustomRange}
          lastRefresh={lastRefresh}
          loading={loading}
          onRefresh={handleRefresh}
        />
      </div>

      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList className="bg-[hsl(222,30%,14%)] border border-slate-700/50 p-1 h-auto">
          <TabsTrigger
            value="resumo"
            className="gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 px-8 py-2.5 text-sm font-medium"
          >
            <BarChart3 className="w-4 h-4" /> Resumo
          </TabsTrigger>
          <TabsTrigger
            value="campanhas"
            className="gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 px-8 py-2.5 text-sm font-medium"
          >
            <Table2 className="w-4 h-4" /> Campanhas
          </TabsTrigger>
          <TabsTrigger
            value="alertas"
            className="gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 px-8 py-2.5 text-sm font-medium"
          >
            <Bell className="w-4 h-4" /> AntonyAD
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="mt-4 space-y-4">
          <MetaAdsSummary
            spend={summary.spend}
            conversionValue={summary.convValue}
            results={summary.results}
            roas={globalROAS}
          />
          <MetaAdsFunnel userId={user?.id} />
          <MetaBudgetCalculator currentCPA={summary.results > 0 ? summary.spend / summary.results : undefined} />
        </TabsContent>


        <TabsContent value="alertas" className="mt-4">
          <MetaAdsAlerts campaigns={campaigns} loading={loading} />
        </TabsContent>

        <TabsContent value="campanhas" className="mt-4 space-y-4">
          <Tabs value={dataTab} onValueChange={setDataTab}>
            <TabsList className="bg-[hsl(222,25%,16%)] border border-slate-700/50 p-1 h-auto">
              <TabsTrigger value="accounts" className="gap-1.5 data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400 px-5 py-2">
                <LayoutGrid className="w-4 h-4" /> Contas
              </TabsTrigger>
              <TabsTrigger value="campaigns" className="gap-1.5 data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400 px-5 py-2">
                <Megaphone className="w-4 h-4" /> Campanhas
              </TabsTrigger>
              <TabsTrigger value="adsets" className="gap-1.5 data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400 px-5 py-2">
                <Layers className="w-4 h-4" /> Conjuntos
              </TabsTrigger>
              <TabsTrigger value="ads" className="gap-1.5 data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400 px-5 py-2">
                <FileImage className="w-4 h-4" /> Anúncios
              </TabsTrigger>
            </TabsList>

            <TabsContent value="accounts" className="mt-4">
              <Card className="bg-[hsl(222,30%,14%)] border-slate-700/50">
                <CardHeader><CardTitle className="text-base text-slate-200">Contas de Anúncio</CardTitle></CardHeader>
                <CardContent>
                  {accounts.length === 0 ? (
                    <p className="text-slate-500 text-sm py-8 text-center">
                      {loading ? "Carregando contas..." : "Nenhuma conta encontrada. Verifique o token."}
                    </p>
                  ) : (
                    <div className="grid gap-3">
                      {accounts.map((acc) => {
                        const isSelected = selectedAccounts.includes(acc.id);
                        return (
                          <div
                            key={acc.id}
                            className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                              isSelected
                                ? "border-blue-500 bg-blue-500/10"
                                : "border-slate-700/50 hover:border-blue-500/50"
                            }`}
                            onClick={() => toggleAccount(acc.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold text-slate-200">{acc.name || acc.account_id}</p>
                                <p className="text-xs text-slate-500">ID: {acc.account_id} • {acc.currency}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-slate-500">Gasto total</p>
                                <p className="font-semibold text-slate-200">{formatCurrency(parseInt(acc.amount_spent || "0", 10) / 100)}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="campaigns" className="mt-4">
              <MetaDataTable
                data={campaigns}
                loading={loading}
                searchPlaceholder="Filtrar por nome..."
                showObjective
                accountName={selectedAccounts.length > 1 ? undefined : accounts.find((a) => a.id === selectedAccounts[0])?.name}
                onToggleStatus={toggleStatus}
                onUpdateBudget={updateBudget}
                onDuplicate={(id) => duplicate(id, "campaign")}
                onRefresh={fetchCampaigns}
              />
            </TabsContent>

            <TabsContent value="adsets" className="mt-4">
              <MetaDataTable
                data={adsets}
                loading={loading}
                searchPlaceholder="Filtrar por nome..."
                onToggleStatus={toggleStatus}
                onUpdateBudget={updateBudget}
                onDuplicate={(id) => duplicate(id, "adset")}
                onRefresh={fetchAdSets}
              />
            </TabsContent>

            <TabsContent value="ads" className="mt-4">
              <MetaDataTable
                data={ads}
                loading={loading}
                searchPlaceholder="Filtrar por nome..."
                onToggleStatus={toggleStatus}
                onUpdateBudget={updateBudget}
                onDuplicate={(id) => duplicate(id, "ad")}
                onRefresh={fetchAds}
              />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}
