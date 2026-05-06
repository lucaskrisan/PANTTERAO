// @ts-nocheck
import { memo, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin } from "lucide-react";

const STATE_NAMES: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AM: "Amazonas", AP: "Amapá",
  BA: "Bahia", CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo",
  GO: "Goiás", MA: "Maranhão", MG: "Minas Gerais", MS: "Mato Grosso do Sul",
  MT: "Mato Grosso", PA: "Pará", PB: "Paraíba", PE: "Pernambuco",
  PI: "Piauí", PR: "Paraná", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RO: "Rondônia", RR: "Roraima", RS: "Rio Grande do Sul", SC: "Santa Catarina",
  SE: "Sergipe", SP: "São Paulo", TO: "Tocantins",
};

interface Props {
  salesByState: Record<string, { count: number; revenue: number }>;
  fmt: (v: number) => string;
}

const DashboardStateMap = memo(function DashboardStateMap({ salesByState, fmt }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  const sorted = useMemo(() => {
    return Object.entries(salesByState)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8);
  }, [salesByState]);

  const maxCount = sorted.length > 0 ? sorted[0][1].count : 1;

  if (sorted.length === 0) {
    return (
      <Card className="border border-white/[0.06] bg-card/70 backdrop-blur-md shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] h-full">
        <CardContent className="p-4 flex flex-col items-center justify-center h-full">
          <MapPin className="w-8 h-8 text-muted-foreground/20 mb-2" />
          <p className="text-xs text-muted-foreground text-center">Sem dados de<br/>localização ainda</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-white/[0.06] bg-card/70 backdrop-blur-md shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04),0_2px_12px_-4px_rgba(0,0,0,0.4)] h-full">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      <CardContent className="p-4 relative">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <h3 className="text-xs font-semibold text-foreground">Top Estados</h3>
          <span className="text-[11px] text-muted-foreground ml-auto">{Object.keys(salesByState).length} UFs</span>
        </div>
        <div className="space-y-2.5 max-h-[210px] overflow-y-auto scrollbar-thin pr-1">
          {sorted.map(([uf, data], i) => {
            const pct = (data.count / maxCount) * 100;
            const isSelected = selected === uf;
            const isTop3 = i < 3;
            return (
              <button
                key={uf}
                onClick={() => setSelected(prev => prev === uf ? null : uf)}
                className="w-full text-left group"
              >
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold w-6 ${isTop3 ? "text-primary" : "text-foreground"}`}>{uf}</span>
                    <span className="text-[11px] text-muted-foreground hidden sm:inline truncate max-w-[90px]">
                      {STATE_NAMES[uf]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isSelected && (
                      <span className="text-[11px] text-primary font-medium animate-in fade-in slide-in-from-right-2 duration-200">
                        {fmt(data.revenue)}
                      </span>
                    )}
                    <span className={`text-xs font-bold ${isTop3 ? "text-primary" : "text-foreground"}`}>{data.count}</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isTop3 
                        ? "bg-gradient-to-r from-primary/60 to-primary group-hover:from-primary group-hover:to-primary shadow-sm shadow-primary/20" 
                        : "bg-gradient-to-r from-primary/25 to-primary/45 group-hover:from-primary/45 group-hover:to-primary/65"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
});

export default DashboardStateMap;
