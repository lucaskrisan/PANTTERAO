import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Pencil, Check, X, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { MetaInsights } from "@/hooks/useMetaAds";
import {
  getResults, getCPA, getROAS, getConversionValue,
  formatCurrency, formatNumber, formatPercent, formatBudget,
} from "./MetaInsightsHelpers";

interface DataItem {
  id: string;
  name: string;
  status: string;
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  insights: MetaInsights | null;
}

interface Props {
  data: DataItem[];
  loading: boolean;
  searchPlaceholder?: string;
  onToggleStatus: (id: string, status: string) => Promise<string>;
  onUpdateBudget: (id: string, type: string, amount: string) => Promise<boolean>;
  onDuplicate: (id: string) => Promise<boolean>;
  onRefresh: () => void;
  showObjective?: boolean;
  accountName?: string;
}

export function MetaDataTable({
  data, loading, searchPlaceholder = "Buscar...",
  onToggleStatus, onUpdateBudget, onDuplicate, onRefresh, showObjective, accountName,
}: Props) {
  const [search, setSearch] = useState("");
  const [editingBudget, setEditingBudget] = useState<string | null>(null);
  const [budgetValue, setBudgetValue] = useState("");
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  const filtered = data.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggle = async (item: DataItem) => {
    setTogglingIds((prev) => new Set(prev).add(item.id));
    const newStatus = await onToggleStatus(item.id, item.status);
    item.status = newStatus;
    setTogglingIds((prev) => { const n = new Set(prev); n.delete(item.id); return n; });
    onRefresh();
  };

  const handleBudgetSave = async (item: DataItem) => {
    const cents = Math.round(parseFloat(budgetValue) * 100).toString();
    const type = item.daily_budget && item.daily_budget !== "0" ? "daily_budget" : "lifetime_budget";
    const ok = await onUpdateBudget(item.id, type, cents);
    if (ok) onRefresh();
    setEditingBudget(null);
  };

  const startEditBudget = (item: DataItem) => {
    setEditingBudget(item.id);
    const raw = item.daily_budget && item.daily_budget !== "0"
      ? parseInt(item.daily_budget, 10) / 100
      : item.lifetime_budget ? parseInt(item.lifetime_budget, 10) / 100 : 0;
    setBudgetValue(raw.toString());
  };

  // Totals
  const totals = filtered.reduce(
    (acc, item) => {
      const ins = item.insights;
      if (!ins) return acc;
      acc.spend += parseFloat(ins.spend || "0");
      acc.impressions += parseInt(ins.impressions || "0", 10);
      acc.reach += parseInt(ins.reach || "0", 10);
      acc.results += getResults(ins);
      acc.convValue += getConversionValue(ins);
      acc.clicks += (ins.actions?.find((a) => a.action_type === "link_click")?.value ? parseInt(ins.actions.find((a) => a.action_type === "link_click")!.value, 10) : 0);
      return acc;
    },
    { spend: 0, impressions: 0, reach: 0, results: 0, convValue: 0, clicks: 0 }
  );

  const tLucro = totals.convValue - totals.spend;
  const tRoas = totals.spend > 0 ? totals.convValue / totals.spend : 0;
  const tRoi = totals.spend > 0 ? tLucro / totals.spend : 0;
  const tMargem = totals.convValue > 0 ? (tLucro / totals.convValue) * 100 : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-[hsl(222,30%,14%)] border-slate-700/50 text-slate-200 placeholder:text-slate-500"
          />
        </div>
        <Badge variant="secondary" className="text-xs bg-slate-700/50 text-slate-300">
          {filtered.length} {filtered.length === 1 ? "item" : "itens"}
        </Badge>
      </div>

      <div className="border border-slate-700/50 rounded-lg overflow-x-auto bg-[hsl(222,30%,12%)]">
        <Table>
          <TableHeader>
            <TableRow className="bg-[hsl(222,25%,16%)] border-b border-slate-700/50 hover:bg-[hsl(222,25%,16%)]">
              <Th>Status</Th>
              <Th className="min-w-[180px]">Campanha</Th>
              {showObjective && <Th>CA</Th>}
              <Th right>Orçamento</Th>
              <Th right>Vendas</Th>
              <Th right>CPA</Th>
              <Th right>Gastos</Th>
              <Th right>Faturamento</Th>
              <Th right>Lucro</Th>
              <Th right>ROAS</Th>
              <Th right>ROI</Th>
              <Th right>Margem</Th>
              <Th right>CPM</Th>
              <Th right>CTR</Th>
              <Th right>CPC</Th>
              <Th right>Impressões</Th>
              <Th right>Cliques</Th>
              <Th right>Alcance</Th>
              <Th right>Frequência</Th>
              <Th right>Saturação</Th>
              <Th>Ações</Th>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && filtered.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={20} className="text-center py-8 text-slate-500">
                  Carregando dados do Meta...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={20} className="text-center py-8 text-slate-500">
                  Nenhum item encontrado
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((item) => {
                const ins = item.insights;
                const roas = getROAS(ins);
                const cpa = getCPA(ins);
                const cv = getConversionValue(ins);
                const sp = parseFloat(ins?.spend || "0");
                const lucro = cv - sp;
                const roi = sp > 0 ? lucro / sp : 0;
                const margem = cv > 0 ? (lucro / cv) * 100 : 0;
                const clicks = ins?.actions?.find((a) => a.action_type === "link_click")?.value || "0";

                return (
                  <TableRow key={item.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <TableCell>
                      <Switch
                        checked={item.status === "ACTIVE"}
                        disabled={togglingIds.has(item.id)}
                        onCheckedChange={() => handleToggle(item)}
                        className="data-[state=checked]:bg-blue-500"
                      />
                    </TableCell>
                    <TableCell className="font-medium text-sm text-slate-200 max-w-[200px] truncate" title={item.name}>
                      {item.name}
                    </TableCell>
                    {showObjective && (
                      <TableCell>
                        <span className="text-xs text-slate-400">
                          {accountName || item.objective?.replace(/_/g, " ").toLowerCase() || "—"}
                        </span>
                      </TableCell>
                    )}
                    <TableCell className="text-right text-slate-300">
                      {editingBudget === item.id ? (
                        <div className="flex items-center gap-1 justify-end">
                          <Input value={budgetValue} onChange={(e) => setBudgetValue(e.target.value)} className="w-24 h-7 text-xs bg-slate-800 border-slate-600" type="number" step="0.01" />
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleBudgetSave(item)}><Check className="w-3 h-3 text-emerald-400" /></Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingBudget(null)}><X className="w-3 h-3 text-red-400" /></Button>
                        </div>
                      ) : (
                        <span className="cursor-pointer hover:underline" onClick={() => startEditBudget(item)}>
                          {formatBudget(item.daily_budget, item.lifetime_budget)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-slate-200">{getResults(ins)}</TableCell>
                    <TableCell className="text-right text-slate-300">{cpa > 0 ? formatCurrency(cpa) : "N/A"}</TableCell>
                    <TableCell className="text-right text-slate-300">{formatCurrency(sp)}</TableCell>
                    <TableCell className="text-right text-slate-200 font-semibold">{cv > 0 ? formatCurrency(cv) : "R$ 0,00"}</TableCell>
                    <Colored value={lucro} />
                    <TableCell className={`text-right font-semibold ${roas >= 1 ? "text-emerald-400" : roas > 0 ? "text-red-400" : "text-slate-500"}`}>
                      {roas > 0 ? roas.toFixed(2) : "N/A"}
                    </TableCell>
                    <Colored value={roi} format="decimal" />
                    <TableCell className={`text-right text-sm ${margem >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {cv > 0 ? `${margem.toFixed(1).replace(".", ",")}%` : "N/A"}
                    </TableCell>
                    <TableCell className="text-right text-slate-400">{formatCurrency(ins?.cpm || "0")}</TableCell>
                    <TableCell className="text-right text-slate-400">{formatPercent(ins?.ctr || "0")}</TableCell>
                    <TableCell className="text-right text-slate-400">{formatCurrency(ins?.cpc || "0")}</TableCell>
                    <TableCell className="text-right text-slate-400">{formatNumber(ins?.impressions || "0")}</TableCell>
                    <TableCell className="text-right text-slate-400">{formatNumber(clicks)}</TableCell>
                    <TableCell className="text-right text-slate-400">{formatNumber(ins?.reach || "0")}</TableCell>
                    <TableCell className="text-right text-slate-400">
                      {ins?.frequency ? parseFloat(ins.frequency).toFixed(2).replace(".", ",") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <SaturationBadge insights={ins} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-0.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-slate-200" onClick={() => startEditBudget(item)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Editar orçamento</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-slate-200" onClick={async () => { if (await onDuplicate(item.id)) onRefresh(); }}>
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Duplicar</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
          {filtered.length > 0 && (
            <TableFooter>
              <TableRow className="bg-[hsl(222,25%,16%)] font-semibold border-t border-slate-700/50 hover:bg-[hsl(222,25%,16%)]">
                <TableCell />
                <TableCell className="text-slate-300">{filtered.length} campanhas</TableCell>
                {showObjective && <TableCell />}
                <TableCell />
                <TableCell className="text-right text-slate-200">{totals.results}</TableCell>
                <TableCell className="text-right text-slate-300">{totals.results > 0 ? formatCurrency(totals.spend / totals.results) : "—"}</TableCell>
                <TableCell className="text-right text-slate-300">{formatCurrency(totals.spend)}</TableCell>
                <TableCell className="text-right text-slate-200">{formatCurrency(totals.convValue)}</TableCell>
                <Colored value={tLucro} />
                <TableCell className={`text-right font-semibold ${tRoas >= 1 ? "text-emerald-400" : "text-red-400"}`}>{tRoas > 0 ? tRoas.toFixed(2) : "—"}</TableCell>
                <Colored value={tRoi} format="decimal" />
                <TableCell className={`text-right ${tMargem >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {totals.convValue > 0 ? `${tMargem.toFixed(1).replace(".", ",")}%` : "—"}
                </TableCell>
                <TableCell className="text-right text-slate-400">{totals.impressions > 0 ? formatCurrency((totals.spend / totals.impressions) * 1000) : "—"}</TableCell>
                <TableCell />
                <TableCell />
                <TableCell className="text-right text-slate-400">{formatNumber(totals.impressions)}</TableCell>
                <TableCell className="text-right text-slate-400">{formatNumber(totals.clicks)}</TableCell>
                <TableCell className="text-right text-slate-400">{formatNumber(totals.reach)}</TableCell>
                <TableCell />
                <TableCell />
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  );
}

// Helper components
function Th({ children, right, className = "" }: { children: React.ReactNode; right?: boolean; className?: string }) {
  return (
    <TableHead className={`text-[11px] font-semibold text-slate-400 uppercase tracking-wider ${right ? "text-right" : ""} ${className}`}>
      {children}
    </TableHead>
  );
}

function Colored({ value, format }: { value: number; format?: "decimal" }) {
  const color = value > 0 ? "text-emerald-400" : value < 0 ? "text-red-400" : "text-slate-500";
  const display = format === "decimal"
    ? (value !== 0 ? value.toFixed(2) : "0.00")
    : (value !== 0 ? formatCurrency(value) : "R$ 0,00");
  return <TableCell className={`text-right font-semibold ${color}`}>{display}</TableCell>;
}

function getSaturationScore(ins: MetaInsights | null): { score: number; signals: string[] } {
  if (!ins) return { score: 0, signals: [] };
  const signals: string[] = [];
  let score = 0;
  const freq = parseFloat(ins.frequency || "0");
  const ctr = parseFloat(ins.ctr || "0");
  const cpm = parseFloat(ins.cpm || "0");
  const spend = parseFloat(ins.spend || "0");
  const reach = parseInt(ins.reach || "0", 10);
  const impressions = parseInt(ins.impressions || "0", 10);

  if (freq > 3) { signals.push(`Freq ${freq.toFixed(1)}`); score += 30; }
  else if (freq > 2) { signals.push(`Freq ${freq.toFixed(1)}`); score += 15; }
  if (ctr < 0.6 && spend > 10) { signals.push(`CTR ${ctr.toFixed(2)}%`); score += 25; }
  if (cpm > 70) { signals.push(`CPM alto`); score += 20; }
  if (reach > 0 && impressions / reach > 4) { signals.push(`${(impressions / reach).toFixed(1)} imp/pessoa`); score += 20; }

  const roas = getROAS(ins);
  if (roas > 0 && roas < 0.8 && spend > 20) { signals.push(`ROAS ${roas.toFixed(2)}`); score += 25; }

  return { score: Math.min(100, score), signals };
}

function SaturationBadge({ insights }: { insights: MetaInsights | null }) {
  const { score, signals } = getSaturationScore(insights);
  if (score === 0) return <span className="text-slate-600 text-xs">—</span>;

  const color = score >= 70 ? "bg-red-500/15 text-red-400 border-red-500/30"
    : score >= 50 ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
    : score >= 25 ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
    : "bg-slate-500/15 text-slate-400 border-slate-500/30";

  const label = score >= 70 ? "🚨" : score >= 50 ? "⚠️" : score >= 25 ? "👀" : "✓";

  return (
    <Tooltip>
      <TooltipTrigger>
        <Badge variant="outline" className={`text-[10px] ${color} border cursor-help`}>
          {label} {score}%
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-[200px]">
        <p className="text-xs font-semibold mb-1">Saturação: {score}/100</p>
        {signals.map((s, i) => <p key={i} className="text-[10px] text-slate-400">• {s}</p>)}
        {score >= 70 && <p className="text-[10px] text-red-400 mt-1 font-medium">Pausar ou trocar público</p>}
        {score >= 50 && score < 70 && <p className="text-[10px] text-amber-400 mt-1 font-medium">Monitorar 24h</p>}
      </TooltipContent>
    </Tooltip>
  );
}
