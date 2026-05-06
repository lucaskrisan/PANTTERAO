// @ts-nocheck
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { subDays } from "date-fns";
import NinaWatermark from "./NinaWatermark";

interface Props {
  userId?: string;
  filterProduct: string;
}

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const ConversionHeatmap = ({ userId, filterProduct }: Props) => {
  const [grid, setGrid] = useState<number[][]>(() =>
    Array(7).fill(0).map(() => Array(24).fill(0)),
  );
  const [hover, setHover] = useState<{ d: number; h: number } | null>(null);

  const load = async () => {
    const since = subDays(new Date(), 7).toISOString();
    let q = supabase
      .from("pixel_events")
      .select("created_at")
      .eq("event_name", "Purchase")
      .gte("created_at", since)
      .limit(5000);
    if (userId) q = q.eq("user_id", userId);
    if (filterProduct !== "all") q = q.eq("product_id", filterProduct);
    const { data } = await q;

    const next: number[][] = Array(7).fill(0).map(() => Array(24).fill(0));
    (data || []).forEach((row: any) => {
      const d = new Date(row.created_at);
      next[d.getDay()][d.getHours()] += 1;
    });
    setGrid(next);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [userId, filterProduct]);

  const max = useMemo(() => {
    let m = 0;
    grid.forEach((row) => row.forEach((v) => { if (v > m) m = v; }));
    return Math.max(m, 1);
  }, [grid]);

  return (
    <div className="relative rounded-xl bg-muted/40 border border-border/20 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
          <p className="text-xs text-muted-foreground font-medium">
            Quando você vende mais · 7 dias
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
          <span>menos</span>
          <div className="flex gap-0.5">
            {[0.1, 0.3, 0.5, 0.75, 1].map((o) => (
              <div
                key={o}
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: `rgba(212, 175, 55, ${o})` }}
              />
            ))}
          </div>
          <span>mais</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Hour ruler */}
          <div className="flex pl-10 mb-1">
            {Array.from({ length: 24 }).map((_, h) => (
              <div
                key={h}
                className="flex-1 min-w-[14px] text-center text-[8px] text-muted-foreground/60 font-mono"
              >
                {h % 3 === 0 ? h.toString().padStart(2, "0") : ""}
              </div>
            ))}
          </div>

          {grid.map((row, d) => (
            <div key={d} className="flex items-center mb-0.5">
              <div className="w-10 text-[10px] text-muted-foreground font-bold text-center">
                {DAYS[d]}
              </div>
              {row.map((v, h) => {
                const intensity = v / max;
                const isHover = hover?.d === d && hover?.h === h;
                return (
                  <div
                    key={h}
                    className="flex-1 min-w-[14px] aspect-square m-px rounded-sm transition-all cursor-pointer relative"
                    style={{
                      backgroundColor:
                        v === 0
                          ? "rgba(255,255,255,0.03)"
                          : `rgba(212, 175, 55, ${0.12 + intensity * 0.88})`,
                      transform: isHover ? "scale(1.4)" : "scale(1)",
                      zIndex: isHover ? 10 : 1,
                      boxShadow: isHover
                        ? "0 4px 12px rgba(212, 175, 55, 0.5)"
                        : "none",
                    }}
                    onMouseEnter={() => setHover({ d, h })}
                    onMouseLeave={() => setHover(null)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {hover && (
        <div className="mt-3 text-[11px] text-foreground bg-card border border-[#D4AF37]/30 rounded-md px-3 py-1.5 inline-flex items-center gap-2">
          <span className="font-semibold text-[#D4AF37]">
            {DAY_NAMES[hover.d]} {hover.h.toString().padStart(2, "0")}h
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="tabular-nums">{grid[hover.d][hover.h]} compras</span>
        </div>
      )}
      <NinaWatermark />
    </div>
  );
};

export default ConversionHeatmap;
