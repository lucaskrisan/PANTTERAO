import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency } from "./MetaInsightsHelpers";

interface Props {
  spend: number;
  conversionValue: number;
  results: number;
  roas: number;
}

export function MetaAdsSummary({ spend, conversionValue, results, roas }: Props) {
  const [orderMetrics, setOrderMetrics] = useState({
    pendingAmount: 0,
    chargebackAmount: 0,
    refundedAmount: 0,
  });

  const fetchOrderMetrics = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data: orders } = await supabase
      .from("orders")
      .select("status, amount")
      .gte("created_at", today.toISOString());

    if (!orders) return;

    const pending = orders.filter((o) => o.status === "pending" || o.status === "waiting_payment").reduce((s, o) => s + Number(o.amount), 0);
    const chargeback = orders.filter((o) => o.status === "chargeback").reduce((s, o) => s + Number(o.amount), 0);
    const refunded = orders.filter((o) => o.status === "refunded").reduce((s, o) => s + Number(o.amount), 0);

    setOrderMetrics({ pendingAmount: pending, chargebackAmount: chargeback, refundedAmount: refunded });
  }, []);

  useEffect(() => {
    fetchOrderMetrics();
    const ch = supabase
      .channel("summary-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchOrderMetrics())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchOrderMetrics]);

  const lucro = conversionValue - spend;
  const roi = spend > 0 ? lucro / spend : 0;
  const margem = conversionValue > 0 ? (lucro / conversionValue) * 100 : 0;
  const arpu = results > 0 ? conversionValue / results : 0;

  const isNeg = (v: number) => v < 0;

  return (
    <div className="space-y-4">
      {/* Current period cards */}
      <div className="grid grid-cols-12 gap-3">
        <MetricCard label="Faturamento Líquido" value={formatCurrency(conversionValue)} className="col-span-6 md:col-span-3" />
        <MetricCard label="Gastos com anúncios" value={formatCurrency(spend)} className="col-span-6 md:col-span-3" />
        <MetricCard label="ROAS" value={roas > 0 ? roas.toFixed(2) : "0.00"} valueColor={roas >= 1 ? "text-emerald-400" : "text-red-400"} className="col-span-6 md:col-span-3" />
        <MetricCard label="Lucro" value={formatCurrency(lucro)} valueColor={isNeg(lucro) ? "text-red-400" : "text-emerald-400"} className="col-span-6 md:col-span-3" />

        <MetricCard label="ROI" value={roi !== 0 ? roi.toFixed(2) : "0.00"} valueColor={isNeg(roi) ? "text-red-400" : "text-emerald-400"} className="col-span-4 md:col-span-2" />
        <MetricCard label="ARPU" value={formatCurrency(arpu)} className="col-span-4 md:col-span-2" />
        <MetricCard label="Margem" value={`${margem.toFixed(1).replace(".", ",")}%`} valueColor={isNeg(margem) ? "text-red-400" : "text-emerald-400"} className="col-span-4 md:col-span-2" />
        <MetricCard label="Vendas Pendentes" value={formatCurrency(orderMetrics.pendingAmount)} className="col-span-4 md:col-span-2" />
        <MetricCard label="Vendas chargeback" value={formatCurrency(orderMetrics.chargebackAmount)} className="col-span-4 md:col-span-2" />
        <MetricCard label="Vendas Reembolsadas" value={formatCurrency(orderMetrics.refundedAmount)} className="col-span-4 md:col-span-2" />
      </div>

    </div>
  );
}

function MetricCard({
  label,
  value,
  valueColor,
  className = "",
  icon,
  subValue,
  subColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
  className?: string;
  icon?: React.ReactNode;
  subValue?: string;
  subColor?: string;
}) {
  return (
    <Card className={`bg-[hsl(222,30%,14%)] border-slate-700/50 ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{label}</span>
          {icon || (
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-3 h-3 text-slate-600" />
              </TooltipTrigger>
              <TooltipContent><p className="text-xs">{label}</p></TooltipContent>
            </Tooltip>
          )}
        </div>
        <p className={`text-xl font-bold ${valueColor || "text-slate-100"}`}>{value}</p>
        {subValue && (
          <p className={`text-xs mt-0.5 ${subColor || "text-slate-500"}`}>{subValue}</p>
        )}
      </CardContent>
    </Card>
  );
}
