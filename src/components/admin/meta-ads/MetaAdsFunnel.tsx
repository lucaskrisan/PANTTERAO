import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface FunnelStage {
  label: string;
  count: number;
  percent: number;
}

export function MetaAdsFunnel({ userId }: { userId?: string }) {
  const [stages, setStages] = useState<FunnelStage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFunnelData = useCallback(async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      let evQuery = supabase.from("pixel_events").select("event_name").gte("created_at", todayISO);
      let ordQuery = supabase.from("orders").select("status").gte("created_at", todayISO);
      if (userId) { evQuery = evQuery.eq("user_id", userId); ordQuery = ordQuery.eq("user_id", userId); }
      const [{ data: events }, { data: orders }] = await Promise.all([evQuery, ordQuery]);

      const ec: Record<string, number> = {};
      (events || []).forEach((e) => { ec[e.event_name] = (ec[e.event_name] || 0) + 1; });

      const cliques = Math.ceil((ec["ViewContent"] || 0) / 2);
      const visPages = Math.ceil((ec["PageView"] || 0) / 2);
      const ics = Math.ceil((ec["InitiateCheckout"] || 0) / 2);
      const allSales = (orders || []).filter((o) =>
        ["pending", "waiting_payment", "paid", "approved", "confirmed"].includes(o.status)
      ).length;
      const approvedSales = (orders || []).filter((o) =>
        ["paid", "approved", "confirmed"].includes(o.status)
      ).length;

      const maxVal = Math.max(cliques, visPages, 1);

      setStages([
        { label: "Cliques", count: cliques, percent: 100 },
        { label: "Vis. Página", count: visPages, percent: (visPages / maxVal) * 100 },
        { label: "ICs", count: ics, percent: (ics / maxVal) * 100 },
        { label: "Vendas Inic.", count: allSales, percent: (allSales / maxVal) * 100 },
        { label: "Vendas Apr.", count: approvedSales, percent: (approvedSales / maxVal) * 100 },
      ]);
    } catch (err) {
      console.error("Funnel error:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchFunnelData();
    const c1 = supabase.channel("funnel-px").on("postgres_changes", { event: "INSERT", schema: "public", table: "pixel_events" }, () => fetchFunnelData()).subscribe();
    const c2 = supabase.channel("funnel-or").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchFunnelData()).subscribe();
    return () => { supabase.removeChannel(c1); supabase.removeChannel(c2); };
  }, [fetchFunnelData]);

  const W = 960;
  const H = 200;
  const stageW = W / (stages.length || 5);
  const cy = H / 2;
  const maxH = 150;
  const minH = 3;

  const heights = stages.map((s) => Math.max((s.percent / 100) * maxH, minH));

  const buildPath = () => {
    if (!heights.length) return "";
    const pts = heights.map((h, i) => ({
      x: i * stageW + stageW / 2,
      t: cy - h / 2,
      b: cy + h / 2,
    }));

    let d = `M ${pts[0].x - stageW / 2} ${pts[0].t}`;
    pts.forEach((p, i) => {
      if (i === 0) { d += ` L ${p.x} ${p.t}`; return; }
      const prev = pts[i - 1];
      const mx = (prev.x + p.x) / 2;
      d += ` C ${mx} ${prev.t}, ${mx} ${p.t}, ${p.x} ${p.t}`;
    });
    const last = pts[pts.length - 1];
    d += ` L ${last.x + stageW / 2} ${last.t} L ${last.x + stageW / 2} ${last.b}`;
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      if (i === pts.length - 1) { d += ` L ${p.x} ${p.b}`; continue; }
      const next = pts[i + 1];
      const mx = (next.x + p.x) / 2;
      d += ` C ${mx} ${next.b}, ${mx} ${p.b}, ${p.x} ${p.b}`;
    }
    d += ` L ${pts[0].x - stageW / 2} ${pts[0].b} Z`;
    return d;
  };

  return (
    <Card className="bg-[hsl(222,30%,14%)] border-slate-700/50">
      <CardHeader className="pb-1 pt-4 px-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-slate-400">
            Funil de Conversão (Meta Ads)
          </CardTitle>
          <Tooltip>
            <TooltipTrigger><Info className="w-3.5 h-3.5 text-slate-600" /></TooltipTrigger>
            <TooltipContent><p className="text-xs max-w-[200px]">Dados em tempo real de hoje.</p></TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4 pt-0">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500 text-sm">Carregando funil...</div>
        ) : (
          <div className="w-full">
            <div className="flex w-full mb-1">
              {stages.map((s) => (
                <div key={s.label} className="flex-1 text-center">
                  <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{s.label}</span>
                </div>
              ))}
            </div>

            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
              <defs>
                <linearGradient id="fg" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="hsl(220, 85%, 55%)" stopOpacity="0.95" />
                  <stop offset="35%" stopColor="hsl(240, 70%, 50%)" stopOpacity="0.85" />
                  <stop offset="65%" stopColor="hsl(280, 60%, 45%)" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="hsl(330, 70%, 55%)" stopOpacity="0.55" />
                </linearGradient>
                <linearGradient id="lg" x1="0%" y2="0%"><stop offset="50%" stopColor="transparent" /><stop offset="100%" stopColor="hsl(330,80%,60%)" /></linearGradient>
              </defs>
              <path d={buildPath()} fill="url(#fg)" className="transition-all duration-700" />
              {stages.length > 2 && heights.slice(-2).every((h) => h < 10) && (
                <line x1={(stages.length - 2) * stageW} y1={cy} x2={W} y2={cy} stroke="url(#lg)" strokeWidth="2" opacity={0.8} />
              )}
              {stages.map((_, i) => i > 0 && (
                <line key={i} x1={i * stageW} y1={10} x2={i * stageW} y2={H - 10} stroke="hsl(220,20%,25%)" strokeWidth="1" strokeDasharray="3,5" opacity={0.6} />
              ))}
              {stages.map((s, i) => (
                <text key={i} x={i * stageW + stageW / 2} y={cy + 5} textAnchor="middle" fill="white" fontWeight="700" fontSize="18" opacity={0.95}>
                  {s.percent >= 0.05 ? `${s.percent.toFixed(1)}%` : "0%"}
                </text>
              ))}
            </svg>

            <div className="flex w-full mt-0">
              {stages.map((s) => (
                <div key={`c-${s.label}`} className="flex-1 text-center">
                  <span className="text-base font-bold text-slate-200">{s.count.toLocaleString("pt-BR")}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-1.5 mt-3 justify-end">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
              </span>
              <span className="text-[10px] text-slate-500">Tempo real</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
