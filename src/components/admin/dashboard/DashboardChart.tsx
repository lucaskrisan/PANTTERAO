import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Props {
  data: { name: string; total: number }[];
  fmt: (v: number) => string;
  currencyPrefix?: string;
  title?: string;
  subtitle?: string;
  highlightValue?: string;
  /** When provided, shows a minimal BRL/USD toggle in the corner */
  currencyToggle?: {
    value: "BRL" | "USD";
    onChange: (c: "BRL" | "USD") => void;
  };
}

const CustomTooltip = ({ active, payload, label, fmt }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card/95 backdrop-blur-xl border border-white/[0.08] rounded-lg px-4 py-2.5 shadow-2xl shadow-black/50">
      <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
      <p className="text-base font-bold text-primary">{fmt(payload[0].value)}</p>
    </div>
  );
};

const DashboardChart = memo(function DashboardChart({ data, fmt, currencyPrefix = "R$", title = "Receita Diária", subtitle, highlightValue, currencyToggle }: Props) {
  const hasData = data.some(d => d.total > 0);
  const totalRevenue = data.reduce((s, d) => s + d.total, 0);
  const avgPerDay = data.length > 0 ? totalRevenue / data.length : 0;

  return (
    <Card className="border border-white/[0.06] bg-card/70 backdrop-blur-md shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04),0_2px_20px_-4px_rgba(0,0,0,0.5)] h-full overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      <CardContent className="p-4 relative">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <div>
              <h3 className="text-xs font-semibold text-foreground">{title}</h3>
              {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {currencyToggle && (
              <div className="flex items-center rounded-md border border-white/[0.06] bg-background/40 p-0.5">
                {(["BRL", "USD"] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => currencyToggle.onChange(c)}
                    className={`px-2 py-0.5 text-[10px] font-mono rounded-sm transition-colors ${
                      currencyToggle.value === c
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
            {highlightValue && (
              <p className="text-lg font-bold text-primary">{highlightValue}</p>
            )}
          </div>
        </div>
        <div className="h-[210px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(160 84% 39%)" stopOpacity={0.3} />
                  <stop offset="60%" stopColor="hsl(160 84% 39%)" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="hsl(160 84% 39%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 12% 14%)" vertical={false} opacity={0.6} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "hsl(215 10% 48%)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(215 10% 48%)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${currencyPrefix} ${v}`}
                width={65}
              />
              <Tooltip content={<CustomTooltip fmt={fmt} />} />
              <Area
                type="monotone"
                dataKey="total"
                stroke="hsl(160 84% 39%)"
                fill="url(#colorRevGrad)"
                strokeWidth={2}
                dot={hasData ? { r: 3, fill: "hsl(160 84% 39%)", stroke: "hsl(220 20% 4%)", strokeWidth: 2 } : false}
                activeDot={{
                  r: 5,
                  fill: "hsl(160 84% 39%)",
                  stroke: "hsl(220 20% 4%)",
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {/* Summary bar */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/[0.04]">
          <span className="text-[11px] text-muted-foreground">Receita total</span>
          <span className="text-sm font-bold text-primary">{fmt(totalRevenue)}</span>
          <span className="text-[11px] text-muted-foreground">Média</span>
          <span className="text-sm font-bold text-foreground">{fmt(avgPerDay)}</span>
        </div>
      </CardContent>
    </Card>
  );
});

export default DashboardChart;
