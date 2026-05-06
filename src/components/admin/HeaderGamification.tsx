import { useMemo } from "react";
import { motion } from "framer-motion";

interface Props {
  /** Total approved revenue in BRL (all-time) */
  totalRevenue: number;
}

const revenueMilestones = [
  { threshold: 1_000,       label: "R$1K" },
  { threshold: 5_000,       label: "R$5K" },
  { threshold: 10_000,      label: "R$10K" },
  { threshold: 50_000,      label: "R$50K" },
  { threshold: 100_000,     label: "R$100K" },
  { threshold: 250_000,     label: "R$250K" },
  { threshold: 500_000,     label: "R$500K" },
  { threshold: 1_000_000,   label: "R$1M" },
  { threshold: 5_000_000,   label: "R$5M" },
  { threshold: 10_000_000,  label: "R$10M" },
];

function formatRevenue(v: number): string {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1_000)     return `R$${(v / 1_000).toFixed(1).replace(".", ",")}K`;
  return `R$${v.toFixed(0)}`;
}

function getMedal(revenue: number): { emoji: string } {
  if (revenue >= 10_000_000) return { emoji: "🏆" };
  if (revenue >= 1_000_000)  return { emoji: "🥇" };
  if (revenue >= 100_000)    return { emoji: "🥈" };
  if (revenue >= 10_000)     return { emoji: "🥉" };
  return { emoji: "🎖️" };
}

export default function HeaderGamification({ totalRevenue }: Props) {
  const nextMilestone = useMemo(() => {
    return revenueMilestones.find((m) => m.threshold > totalRevenue)
      || revenueMilestones[revenueMilestones.length - 1];
  }, [totalRevenue]);

  const progress = useMemo(() => {
    if (!nextMilestone || totalRevenue >= nextMilestone.threshold) return 100;
    const prevIdx = revenueMilestones.findIndex((m) => m.threshold === nextMilestone.threshold) - 1;
    const prev = prevIdx >= 0 ? revenueMilestones[prevIdx].threshold : 0;
    const range = nextMilestone.threshold - prev;
    return Math.min(((totalRevenue - prev) / range) * 100, 100);
  }, [totalRevenue, nextMilestone]);

  const { emoji } = getMedal(totalRevenue);

  return (
    <div
      className="flex items-center gap-2"
      title={`Receita total aprovada: ${formatRevenue(totalRevenue)}`}
    >
      <span className="text-lg">{emoji}</span>
      <div className="flex items-center gap-2 min-w-[180px]">
        <div className="w-24 h-2 bg-white/20 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-white rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </div>
        <span className="text-xs font-semibold text-white whitespace-nowrap">
          {formatRevenue(totalRevenue)} / {nextMilestone?.label || "🏆"}
        </span>
      </div>
    </div>
  );
}
