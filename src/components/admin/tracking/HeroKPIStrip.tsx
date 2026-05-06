// @ts-nocheck
import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Activity, DollarSign, Target, TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { subDays, startOfDay, subHours, format } from "date-fns";
import NinaWatermark from "./NinaWatermark";

interface Props {
  userId?: string;
  filterProduct: string;
  recentEventsTimestamps: number[];
}

// ── EMQ Ring (gauge style) ──
const EMQRing = ({ score }: { score: number | null }) => {
  const radius = 32;
  const stroke = 6;
  const circumference = 2 * Math.PI * radius;
  const pct = score == null ? 0 : Math.min(score / 10, 1);
  const color =
    score == null ? "#64748b" : score >= 8 ? "#10b981" : score >= 6 ? "#fbbf24" : "#f87171";

  return (
    <div className="relative w-[80px] h-[80px] flex items-center justify-center shrink-0">
      <svg width="80" height="80" className="-rotate-90">
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - pct) }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold tabular-nums leading-none font-mono" style={{ color }}>
          {score != null ? score.toFixed(1) : "—"}
        </span>
        <span className="text-[8px] uppercase tracking-wider text-muted-foreground/70 mt-0.5">
          /10
        </span>
      </div>
    </div>
  );
};

// ── Sparkline (events / min last 10 minutes) ──
const Sparkline = ({ data, color = "#14B8A6" }: { data: number[]; color?: string }) => {
  if (data.length < 2) return <div className="h-5" />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 80;
  const h = 20;
  const step = w / (data.length - 1);
  const points = data
    .map((v, i) => `${i * step},${h - ((v - min) / range) * h}`)
    .join(" ");

  return (
    <svg width={w} height={h} className="overflow-visible">
      <defs>
        <linearGradient id={`spark-${color}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={`0,${h} ${points} ${w},${h}`}
        fill={`url(#spark-${color})`}
        stroke="none"
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={(data.length - 1) * step}
        cy={h - ((data[data.length - 1] - min) / range) * h}
        r={2}
        fill={color}
        style={{ filter: `drop-shadow(0 0 3px ${color})` }}
      />
    </svg>
  );
};

// ── Mini bar chart (last 7 days revenue) ──
const MiniBarChart = ({ data }: { data: number[] }) => {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[2px] h-5">
      {data.map((v, i) => {
        const isToday = i === data.length - 1;
        const pct = (v / max) * 100;
        return (
          <motion.div
            key={i}
            initial={{ height: 0 }}
            animate={{ height: `${Math.max(pct, 4)}%` }}
            transition={{ duration: 0.4, delay: i * 0.04 }}
            className="flex-1 rounded-sm"
            style={{
              backgroundColor: isToday ? "#D4AF37" : "rgba(212, 175, 55, 0.3)",
              minHeight: 2,
            }}
          />
        );
      })}
    </div>
  );
};

const HeroKPIStrip = ({ userId, filterProduct, recentEventsTimestamps }: Props) => {
  const [emqScore, setEmqScore] = useState<number | null>(null);
  const [emqPrevWeek, setEmqPrevWeek] = useState<number | null>(null);
  const [revenueToday, setRevenueToday] = useState(0);
  const [revenueYesterday, setRevenueYesterday] = useState(0);
  const [revenue7Days, setRevenue7Days] = useState<number[]>([]);

  // Events / min — current value + 10-bucket sparkline (1 min each)
  const eventsPerMin = useMemo(() => {
    const oneMinAgo = Date.now() - 60 * 1000;
    return recentEventsTimestamps.filter((t) => t >= oneMinAgo).length;
  }, [recentEventsTimestamps]);

  const sparklineData = useMemo(() => {
    const now = Date.now();
    const buckets: number[] = [];
    for (let i = 9; i >= 0; i--) {
      const start = now - (i + 1) * 60 * 1000;
      const end = now - i * 60 * 1000;
      buckets.push(recentEventsTimestamps.filter((t) => t >= start && t < end).length);
    }
    return buckets;
  }, [recentEventsTimestamps]);

  const trend = useMemo(() => {
    const now = Date.now();
    const last5 = recentEventsTimestamps.filter((t) => t >= now - 5 * 60 * 1000).length;
    const prev5 = recentEventsTimestamps.filter(
      (t) => t >= now - 10 * 60 * 1000 && t < now - 5 * 60 * 1000,
    ).length;
    if (prev5 === 0) return last5 > 0 ? "up" : "flat";
    return last5 > prev5 ? "up" : last5 < prev5 ? "down" : "flat";
  }, [recentEventsTimestamps]);

  const eventsAvg = useMemo(() => {
    if (sparklineData.length === 0) return 0;
    return sparklineData.reduce((s, v) => s + v, 0) / sparklineData.length;
  }, [sparklineData]);

  const eventsColor =
    eventsPerMin > eventsAvg * 1.2
      ? "#10b981"
      : eventsPerMin < eventsAvg * 0.5
        ? "#f87171"
        : "#fbbf24";

  useEffect(() => {
    const loadKpis = async () => {
      // EMQ últimos 7 dias
      let emqQuery = supabase
        .from("emq_snapshots")
        .select("emq_score, product_id")
        .gte("snapshot_date", subDays(new Date(), 7).toISOString().slice(0, 10));
      if (filterProduct !== "all") emqQuery = emqQuery.eq("product_id", filterProduct);
      const { data: emqData } = await emqQuery;
      if (emqData && emqData.length > 0) {
        const avg =
          emqData.reduce((s: number, r: any) => s + (Number(r.emq_score) || 0), 0) / emqData.length;
        setEmqScore(Number(avg.toFixed(1)));
      } else {
        setEmqScore(null);
      }

      // EMQ semana anterior
      let emqPrevQ = supabase
        .from("emq_snapshots")
        .select("emq_score, product_id")
        .gte("snapshot_date", subDays(new Date(), 14).toISOString().slice(0, 10))
        .lt("snapshot_date", subDays(new Date(), 7).toISOString().slice(0, 10));
      if (filterProduct !== "all") emqPrevQ = emqPrevQ.eq("product_id", filterProduct);
      const { data: emqPrevData } = await emqPrevQ;
      if (emqPrevData && emqPrevData.length > 0) {
        const avg =
          emqPrevData.reduce((s: number, r: any) => s + (Number(r.emq_score) || 0), 0) /
          emqPrevData.length;
        setEmqPrevWeek(Number(avg.toFixed(1)));
      } else {
        setEmqPrevWeek(null);
      }

      // Receita hoje
      const todayStart = startOfDay(new Date()).toISOString();
      let todayQuery = supabase
        .from("orders")
        .select("amount")
        .eq("status", "paid")
        .gte("created_at", todayStart);
      if (userId) todayQuery = todayQuery.eq("user_id", userId);
      if (filterProduct !== "all") todayQuery = todayQuery.eq("product_id", filterProduct);
      const { data: todayData } = await todayQuery;
      setRevenueToday((todayData || []).reduce((s: number, o: any) => s + Number(o.amount || 0), 0));

      // Receita ontem
      const yStart = startOfDay(subDays(new Date(), 1)).toISOString();
      const yEnd = startOfDay(new Date()).toISOString();
      let yQuery = supabase
        .from("orders")
        .select("amount")
        .eq("status", "paid")
        .gte("created_at", yStart)
        .lt("created_at", yEnd);
      if (userId) yQuery = yQuery.eq("user_id", userId);
      if (filterProduct !== "all") yQuery = yQuery.eq("product_id", filterProduct);
      const { data: yData } = await yQuery;
      setRevenueYesterday((yData || []).reduce((s: number, o: any) => s + Number(o.amount || 0), 0));

      // Receita últimos 7 dias (mini bar chart)
      const sevenStart = startOfDay(subDays(new Date(), 6)).toISOString();
      let weekQuery = supabase
        .from("orders")
        .select("amount, created_at")
        .eq("status", "paid")
        .gte("created_at", sevenStart);
      if (userId) weekQuery = weekQuery.eq("user_id", userId);
      if (filterProduct !== "all") weekQuery = weekQuery.eq("product_id", filterProduct);
      const { data: weekData } = await weekQuery;
      const buckets: number[] = Array(7).fill(0);
      (weekData || []).forEach((o: any) => {
        const day = new Date(o.created_at);
        const diff = Math.floor(
          (startOfDay(new Date()).getTime() - startOfDay(day).getTime()) / (1000 * 60 * 60 * 24),
        );
        const idx = 6 - diff;
        if (idx >= 0 && idx < 7) buckets[idx] += Number(o.amount || 0);
      });
      setRevenue7Days(buckets);
    };
    loadKpis();
    const interval = setInterval(loadKpis, 30000);
    return () => clearInterval(interval);
  }, [userId, filterProduct]);

  const revenueDelta = useMemo(() => {
    if (revenueYesterday === 0) return revenueToday > 0 ? 100 : 0;
    return Math.round(((revenueToday - revenueYesterday) / revenueYesterday) * 100);
  }, [revenueToday, revenueYesterday]);

  const emqDelta = useMemo(() => {
    if (emqScore == null || emqPrevWeek == null || emqPrevWeek === 0) return null;
    return Math.round(((emqScore - emqPrevWeek) / emqPrevWeek) * 100);
  }, [emqScore, emqPrevWeek]);

  const formatBRL = (v: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(v);

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Activity;
  const trendArrow = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";

  const emqLabel =
    emqScore == null
      ? "Sem dados"
      : emqScore >= 8
        ? "Excelente"
        : emqScore >= 6
          ? "Bom"
          : "Atenção";

  // ── Reusable card shell ──
  const cardClass =
    "relative overflow-hidden rounded-lg border p-4 transition-colors";
  const cardStyle = {
    backgroundColor: "#0d0f1a",
    borderColor: "rgba(255,255,255,0.06)",
  } as const;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {/* ── Card 1: Eventos / min ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={cardClass}
        style={cardStyle}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <Activity className="w-3 h-3" style={{ color: "#14B8A6" }} />
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-[0.12em]">
              Eventos / min
            </p>
          </div>
          <Sparkline data={sparklineData} color={eventsColor} />
        </div>
        <div className="flex items-baseline gap-2">
          <span
            className="text-[40px] font-bold font-mono tabular-nums leading-none"
            style={{ color: eventsColor, textShadow: `0 0 12px ${eventsColor}40` }}
          >
            {eventsPerMin}
          </span>
          <motion.span
            key={trend}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-lg font-bold leading-none"
            style={{ color: eventsColor }}
          >
            {trendArrow}
          </motion.span>
        </div>
        <p className="text-[10px] text-muted-foreground/70 font-mono mt-1.5">
          média 10min: {eventsAvg.toFixed(1)}
        </p>
        <NinaWatermark />
      </motion.div>

      {/* ── Card 2: EMQ Score ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className={cardClass}
        style={cardStyle}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <Target className="w-3 h-3" style={{ color: "#D4AF37" }} />
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-[0.12em]">
              EMQ Score
            </p>
          </div>
          {emqDelta !== null && (
            <span
              className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
              style={{
                color: emqDelta >= 0 ? "#10b981" : "#f87171",
                backgroundColor: emqDelta >= 0 ? "rgba(16,185,129,0.1)" : "rgba(248,113,113,0.1)",
              }}
            >
              {emqDelta >= 0 ? "+" : ""}
              {emqDelta}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <EMQRing score={emqScore} />
          <div className="flex flex-col">
            <span className="text-sm font-bold text-foreground leading-tight">{emqLabel}</span>
            <span className="text-[10px] text-muted-foreground mt-0.5">Event Match Quality</span>
            <span className="text-[10px] text-muted-foreground/60 mt-1 font-mono">
              meta: ≥ 8.0
            </span>
          </div>
        </div>
        <NinaWatermark />
      </motion.div>

      {/* ── Card 3: Receita hoje ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className={cardClass}
        style={cardStyle}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <DollarSign className="w-3 h-3" style={{ color: "#D4AF37" }} />
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-[0.12em]">
              Receita hoje
            </p>
          </div>
          <span
            className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded inline-flex items-center gap-1"
            style={{
              color: revenueDelta >= 0 ? "#10b981" : "#f87171",
              backgroundColor:
                revenueDelta >= 0 ? "rgba(16,185,129,0.1)" : "rgba(248,113,113,0.1)",
            }}
          >
            {revenueDelta >= 0 ? "↑" : "↓"} {Math.abs(revenueDelta)}%
          </span>
        </div>
        <p
          className="text-[32px] font-bold font-mono tabular-nums leading-none mb-2"
          style={{ color: "#D4AF37", textShadow: "0 0 12px rgba(212,175,55,0.25)" }}
        >
          {formatBRL(revenueToday)}
        </p>
        <div className="flex items-end justify-between gap-3">
          <div className="flex-1">
            <MiniBarChart data={revenue7Days.length === 7 ? revenue7Days : Array(7).fill(0)} />
          </div>
          <span className="text-[9px] text-muted-foreground/70 font-mono whitespace-nowrap">
            últimos 7d
          </span>
        </div>
        <NinaWatermark />
      </motion.div>
    </div>
  );
};

export default HeroKPIStrip;
