import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import NinaWatermark from "./NinaWatermark";

interface DataPoint {
  label: string;
  total: number;
  purchases: number;
}

interface Props {
  data: DataPoint[];
  period: string;
  truncated?: boolean;
}

const PulseChart = ({ data, period, truncated = false }: Props) => {
  return (
    <div className="relative rounded-xl bg-muted/40 border border-border/20 p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#14B8A6] animate-pulse" />
          <p className="text-xs text-muted-foreground font-medium">
            Pulso de conversão · {period === "7d" ? "diário" : "por hora"}
          </p>
          {truncated && (
            <span
              title="Exibindo os 500 eventos mais recentes do período. Eventos mais antigos foram omitidos."
              className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-wide border"
              style={{
                color: "#D4AF37",
                borderColor: "rgba(212,175,55,0.4)",
                backgroundColor: "rgba(212,175,55,0.08)",
              }}
            >
              AMOSTRA · 500
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-0.5 bg-[#14B8A6]" /> Eventos
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-0.5 bg-[#D4AF37]" /> Compras
          </span>
        </div>
      </div>
      <div className="flex-1 min-h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#14B8A6" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#14B8A6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradPurchase" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#D4AF37" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
              stroke="hsl(var(--border))"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
              stroke="hsl(var(--border))"
              tickLine={false}
              axisLine={false}
              width={28}
            />
            <Tooltip
              cursor={{ stroke: "rgba(212,175,55,0.4)", strokeWidth: 1, strokeDasharray: "3 3" }}
              contentStyle={{
                backgroundColor: "rgba(13,15,26,0.95)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(212,175,55,0.3)",
                borderRadius: 8,
                fontSize: 11,
                color: "hsl(var(--foreground))",
                boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
              }}
              labelStyle={{ color: "hsl(var(--muted-foreground))", fontSize: 10, marginBottom: 4 }}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="#14B8A6"
              strokeWidth={1.5}
              fill="url(#gradTotal)"
              name="Eventos"
            />
            <Area
              type="monotone"
              dataKey="purchases"
              stroke="#D4AF37"
              strokeWidth={2}
              fill="url(#gradPurchase)"
              name="Compras"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <NinaWatermark />
    </div>
  );
};

export default PulseChart;
