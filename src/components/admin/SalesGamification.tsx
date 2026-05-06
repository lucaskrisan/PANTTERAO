import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Trophy, Target, Zap, Star, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  approvedToday: number;
  approvedTotal: number;
  totalRevenue: number;
}

const milestones = [
  { threshold: 1, label: "Primeira venda!", icon: Star, color: "text-yellow-500" },
  { threshold: 5, label: "5 vendas!", icon: Flame, color: "text-orange-500" },
  { threshold: 10, label: "10 vendas! 🔥", icon: Flame, color: "text-red-500" },
  { threshold: 25, label: "25 vendas!", icon: Zap, color: "text-purple-500" },
  { threshold: 50, label: "50 vendas!", icon: Trophy, color: "text-yellow-500" },
  { threshold: 100, label: "100 vendas! 🏆", icon: Trophy, color: "text-primary" },
];

const revenueMilestones = [
  { threshold: 1000, label: "R$ 1K" },
  { threshold: 5000, label: "R$ 5K" },
  { threshold: 10000, label: "R$ 10K" },
  { threshold: 50000, label: "R$ 50K" },
  { threshold: 100000, label: "R$ 100K" },
  { threshold: 500000, label: "R$ 500K" },
  { threshold: 1000000, label: "R$ 1M 💎" },
];

export default function SalesGamification({ approvedToday, approvedTotal, totalRevenue }: Props) {
  const streak = approvedToday;

  const currentMilestone = useMemo(() => {
    for (let i = milestones.length - 1; i >= 0; i--) {
      if (approvedTotal >= milestones[i].threshold) return milestones[i];
    }
    return null;
  }, [approvedTotal]);

  const nextMilestone = useMemo(() => {
    return milestones.find((m) => m.threshold > approvedTotal) || milestones[milestones.length - 1];
  }, [approvedTotal]);

  const progressToNext = useMemo(() => {
    if (!nextMilestone) return 100;
    const prev = currentMilestone?.threshold || 0;
    const range = nextMilestone.threshold - prev;
    return Math.min(((approvedTotal - prev) / range) * 100, 100);
  }, [approvedTotal, currentMilestone, nextMilestone]);

  const currentRevMilestone = useMemo(() => {
    for (let i = revenueMilestones.length - 1; i >= 0; i--) {
      if (totalRevenue >= revenueMilestones[i].threshold) return revenueMilestones[i];
    }
    return null;
  }, [totalRevenue]);

  const nextRevMilestone = useMemo(() => {
    return revenueMilestones.find((m) => m.threshold > totalRevenue);
  }, [totalRevenue]);

  const revProgress = useMemo(() => {
    if (!nextRevMilestone) return 100;
    const prev = currentRevMilestone?.threshold || 0;
    const range = nextRevMilestone.threshold - prev;
    return Math.min(((totalRevenue - prev) / range) * 100, 100);
  }, [totalRevenue, currentRevMilestone, nextRevMilestone]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {/* Daily Streak */}
      <Card className="border border-border shadow-none overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <AnimatePresence>
              {streak > 0 && (
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  className="relative"
                >
                  <Flame className={`w-6 h-6 ${streak >= 10 ? "text-red-500" : streak >= 5 ? "text-orange-500" : "text-yellow-500"}`} />
                  {streak >= 5 && (
                    <motion.div
                      className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ repeat: Infinity, duration: 1 }}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            <div>
              <p className="text-xs text-muted-foreground">Vendas hoje</p>
              <p className="text-2xl font-bold text-foreground">{streak}</p>
            </div>
          </div>
          {streak === 0 && (
            <p className="text-xs text-muted-foreground">Faça sua primeira venda hoje! 🎯</p>
          )}
          {streak > 0 && streak < 10 && (
            <p className="text-xs text-muted-foreground">
              Faltam <strong>{10 - streak}</strong> para o streak de 🔥10!
            </p>
          )}
          {streak >= 10 && (
            <motion.p
              className="text-xs font-semibold text-red-500"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              🔥 Streak on fire! {streak} vendas hoje!
            </motion.p>
          )}
        </CardContent>
      </Card>

      {/* Sales Milestone */}
      <Card className="border border-border shadow-none overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-5 h-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Meta de vendas</p>
              <p className="text-sm font-semibold text-foreground">
                {approvedTotal} / {nextMilestone?.threshold || "∞"}
              </p>
            </div>
          </div>
          <div className="w-full bg-muted rounded-full h-2 mb-1.5">
            <motion.div
              className="bg-primary h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressToNext}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {currentMilestone ? (
              <>✅ {currentMilestone.label} — próximo: <strong>{nextMilestone?.label}</strong></>
            ) : (
              <>Próximo: <strong>{nextMilestone?.label}</strong></>
            )}
          </p>
        </CardContent>
      </Card>

      {/* Revenue Milestone */}
      <Card className="border border-border shadow-none overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Meta de faturamento</p>
              <p className="text-sm font-semibold text-foreground">
                {currentRevMilestone?.label || "R$ 0"} → {nextRevMilestone?.label || "🏆"}
              </p>
            </div>
          </div>
          <div className="w-full bg-muted rounded-full h-2 mb-1.5">
            <motion.div
              className="bg-gradient-to-r from-primary to-green-400 h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${revProgress}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {nextRevMilestone
              ? <>Faltam <strong>R$ {((nextRevMilestone.threshold - totalRevenue) / 100).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")},00</strong> para {nextRevMilestone.label}</>
              : "🏆 Todas as metas atingidas!"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
