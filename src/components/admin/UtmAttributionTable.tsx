import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, Loader2, ChevronDown, ChevronUp } from "lucide-react";

interface UtmRow {
  source: string;
  campaign: string;
  medium: string;
  currency: string;
  count: number;
  revenue: number;
}

interface Props {
  /** Período em dias. Default 30. */
  days?: number;
  /** Quantas linhas exibir antes de "ver mais". Default 5. */
  initialRows?: number;
  /** Iniciar recolhido. Default false. */
  defaultCollapsed?: boolean;
}

const PERIOD_OPTIONS = [7, 30, 90] as const;

function formatMoney(value: number, currency: string) {
  const cur = (currency || "BRL").toUpperCase();
  try {
    return new Intl.NumberFormat(cur === "USD" ? "en-US" : "pt-BR", {
      style: "currency",
      currency: cur,
      minimumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${cur} ${value.toFixed(2)}`;
  }
}

export default function UtmAttributionTable({
  days: daysProp,
  initialRows = 5,
  defaultCollapsed = false,
}: Props = {}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<UtmRow[]>([]);
  const [days, setDays] = useState<number>(daysProp ?? 30);
  const [showAll, setShowAll] = useState(false);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  useEffect(() => {
    if (daysProp) setDays(daysProp);
  }, [daysProp]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      const { data, error } = await supabase.rpc("get_utm_attribution", {
        p_user_id: user.id,
        p_days: days,
      });
      if (cancelled) return;
      if (error) {
        console.error("[UtmAttribution] RPC error:", error);
        setRows([]);
      } else {
        setRows(
          (data || []).map((r: any) => ({
            source: r.source,
            campaign: r.campaign,
            medium: r.medium,
            currency: r.currency || "BRL",
            count: Number(r.count) || 0,
            revenue: Number(r.revenue) || 0,
          })),
        );
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, days]);

  // Total por moeda (suporta mistos BRL+USD na mesma conta)
  const totalsByCurrency = useMemo(() => {
    const m = new Map<string, { revenue: number; count: number }>();
    rows.forEach((r) => {
      const cur = m.get(r.currency) || { revenue: 0, count: 0 };
      cur.revenue += r.revenue;
      cur.count += r.count;
      m.set(r.currency, cur);
    });
    return Array.from(m.entries()); // [currency, totals]
  }, [rows]);

  const totalOrders = useMemo(() => rows.reduce((s, r) => s + r.count, 0), [rows]);
  const visibleRows = showAll ? rows : rows.slice(0, initialRows);
  const hiddenCount = Math.max(0, rows.length - initialRows);

  return (
    <div className="rounded-lg bg-slate-800/50 border border-slate-700/30 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/30 flex items-center gap-2.5">
        <BarChart3 className="w-4 h-4 text-indigo-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-slate-200">Atribuição de Vendas por UTM</h2>
          <p className="text-[10px] text-slate-500 truncate">
            {totalOrders} {totalOrders === 1 ? "venda" : "vendas"} aprovada{totalOrders === 1 ? "" : "s"}
            {totalsByCurrency.length > 0 && " · "}
            {totalsByCurrency
              .map(([cur, t]) => formatMoney(t.revenue, cur))
              .join(" + ")}
            {" · últimos "}
            {days}d
          </p>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-1">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => setDays(opt)}
              className={`text-[10px] px-2 py-1 rounded transition-colors ${
                days === opt
                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                  : "text-slate-500 hover:text-slate-300 border border-transparent"
              }`}
            >
              {opt}d
            </button>
          ))}
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="ml-1 p-1 text-slate-500 hover:text-slate-300 transition-colors"
            aria-label={collapsed ? "Expandir" : "Recolher"}
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center">
              <TrendingUp className="w-8 h-8 text-slate-600 mx-auto mb-3" />
              <p className="text-xs text-slate-500">
                Nenhuma venda com UTM registrada nos últimos {days} dias.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-700/30">
                      <th className="text-left px-4 py-2.5 font-medium text-slate-500">Fonte</th>
                      <th className="text-left px-4 py-2.5 font-medium text-slate-500">Campanha</th>
                      <th className="text-left px-4 py-2.5 font-medium text-slate-500">Conjunto</th>
                      <th className="text-right px-4 py-2.5 font-medium text-slate-500">Vendas</th>
                      <th className="text-right px-4 py-2.5 font-medium text-slate-500">Receita</th>
                      <th className="text-right px-4 py-2.5 font-medium text-slate-500">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/20">
                    {visibleRows.map((r, i) => {
                      const totalForCur =
                        totalsByCurrency.find(([c]) => c === r.currency)?.[1].revenue || 0;
                      const pct = totalForCur > 0 ? ((r.revenue / totalForCur) * 100).toFixed(1) : "0";
                      return (
                        <tr key={i} className="hover:bg-slate-700/20 transition-colors">
                          <td className="px-4 py-2.5">
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20"
                            >
                              {r.source}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 text-slate-300 font-mono text-[10px] max-w-[200px] truncate">
                            {r.campaign}
                          </td>
                          <td className="px-4 py-2.5 text-slate-500 text-[10px] max-w-[150px] truncate">
                            {r.medium}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium text-slate-300 tabular-nums">
                            {r.count}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium text-emerald-400 tabular-nums">
                            {formatMoney(r.revenue, r.currency)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-500 tabular-nums">{pct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {hiddenCount > 0 && (
                <div className="border-t border-slate-700/30 px-4 py-2 flex justify-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAll((v) => !v)}
                    className="h-7 text-[10px] text-slate-400 hover:text-slate-200"
                  >
                    {showAll
                      ? `Mostrar menos`
                      : `Ver mais ${hiddenCount} ${hiddenCount === 1 ? "linha" : "linhas"}`}
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
