import { useEffect, useRef, useState } from "react";
import { motion, useSpring, useTransform } from "framer-motion";

interface Props {
  /** Recent event timestamps (ms since epoch) — used to compute events/min over the last 5 min. */
  timestamps: number[];
}

/**
 * Live "events per minute" counter — counts events from the last 300s and divides by 5.
 * Recomputes every 5s so the rate stays fresh even without new events.
 * Animates digits with framer-motion useSpring; green if above rolling baseline, red if below.
 */
const EventsPerMin = ({ timestamps }: Props) => {
  const [tick, setTick] = useState(0);
  // Histórico das últimas N=12 medições (≈60s) para baseline por mediana — mais robusto a outliers
  // e evita falsos alarmes de "queda" logo após o dashboard abrir (problema do EMA 0.85/0.15).
  const historyRef = useRef<number[]>([]);
  const HISTORY_SIZE = 12;

  // refresh every 5s so the rolling window slides
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const windowMs = 5 * 60 * 1000;
  const recent = timestamps.filter((t) => now - t <= windowMs).length;
  const rate = Math.round((recent / 5) * 10) / 10; // events per minute, 1 decimal

  // Atualiza histórico de rates (apenas valores positivos contam para o baseline)
  useEffect(() => {
    if (rate <= 0) return;
    const h = historyRef.current;
    h.push(rate);
    if (h.length > HISTORY_SIZE) h.shift();
  }, [rate, tick]);

  // Mediana do histórico — baseline estável que ignora picos isolados
  const baseline = (() => {
    const h = historyRef.current;
    if (h.length === 0) return rate;
    const sorted = [...h].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  })();
  const trendUp = rate >= baseline;
  const color = rate === 0 ? "#64748b" : trendUp ? "#10b981" : "#ef4444";
  const glow =
    rate === 0
      ? "none"
      : trendUp
        ? "0 0 12px rgba(16,185,129,0.45)"
        : "0 0 12px rgba(239,68,68,0.4)";

  // animated number
  const spring = useSpring(rate, { stiffness: 90, damping: 18 });
  useEffect(() => {
    spring.set(rate);
  }, [rate, spring]);
  const display = useTransform(spring, (v) => {
    const n = Math.max(0, v);
    return n >= 10 ? Math.round(n).toString() : n.toFixed(1);
  });

  return (
    <span
      className="inline-flex items-baseline gap-1 font-mono tabular-nums leading-none"
      title={`${recent} eventos nos últimos 5 min`}
    >
      <motion.span
        className="text-base font-bold"
        style={{ color, textShadow: glow }}
      >
        {display}
      </motion.span>
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70">
        /min
      </span>
    </span>
  );
};

export default EventsPerMin;
