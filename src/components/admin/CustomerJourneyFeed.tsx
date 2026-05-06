import { useMemo } from "react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, ShoppingCart, UserCheck, CreditCard, MousePointerClick, TrendingUp, CheckCircle2, Loader2, BookOpen } from "lucide-react";

interface PixelEvent {
  id: string;
  product_id: string;
  event_name: string;
  source: string;
  created_at: string;
  customer_name: string | null;
  visitor_id: string | null;
}

interface Props {
  events: PixelEvent[];
  products: { id: string; name: string }[];
}

const FUNNEL_STEPS = [
  { key: "PageView", label: "PV", color: "#818cf8", icon: Eye },
  { key: "ViewContent", label: "VC", color: "#fb923c", icon: BookOpen },
  { key: "InitiateCheckout", label: "IC", color: "#fbbf24", icon: ShoppingCart },
  { key: "Lead", label: "Lead", color: "#60a5fa", icon: UserCheck },
  { key: "AddToCart", label: "Cart", color: "#f472b6", icon: MousePointerClick },
  { key: "AddPaymentInfo", label: "Pay", color: "#a78bfa", icon: CreditCard },
  { key: "Purchase", label: "🎉", color: "#34d399", icon: TrendingUp },
];

const EVENT_LABELS: Record<string, string> = {
  PageView: "Acessou a página",
  ViewContent: "Viu a oferta",
  InitiateCheckout: "Entrou no checkout",
  Lead: "Preencheu os dados",
  AddToCart: "Clicou em comprar",
  AddPaymentInfo: "Informou pagamento",
  Purchase: "Pagou! 🎉",
};

const JOURNEY_END = "Purchase";

/**
 * Mask product name to protect producer privacy.
 * Shows ~50% of each word, replacing the rest with asterisks.
 * Ex: "O Desafio de 14 Dias Que Arranca Você do Ciclo de Procrastinação"
 *  -> "O De***** de 14 D*** Que Arr**** V*** do Ci*** de Procr*********"
 */
const maskProductName = (name: string): string => {
  if (!name) return "";
  return name
    .split(" ")
    .map((word) => {
      if (word.length <= 2) return word;
      const visible = Math.max(1, Math.ceil(word.length / 2));
      return word.slice(0, visible) + "*".repeat(word.length - visible);
    })
    .join(" ");
};

const CustomerJourneyFeed = ({ events, products }: Props) => {
  const journeys = useMemo(() => {
    const map = new Map<string, PixelEvent[]>();

    events.forEach((e) => {
      const key = e.visitor_id || (e.customer_name ? `name:${e.customer_name.trim().toLowerCase()}` : null);
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });

    // Merge groups that share the same customer_name (e.g. webhook events without visitor_id
    // and browser events with visitor_id both belonging to the same person)
    const nameToKey = new Map<string, string>();
    const mergeTargets = new Map<string, string>();

    for (const [key, evts] of map) {
      const named = evts.find((e) => e.customer_name);
      if (!named) continue;
      const normName = named.customer_name!.trim().toLowerCase();
      if (nameToKey.has(normName)) {
        // Mark this key to merge into the existing one
        mergeTargets.set(key, nameToKey.get(normName)!);
      } else {
        nameToKey.set(normName, key);
      }
    }

    for (const [sourceKey, targetKey] of mergeTargets) {
      const sourceEvts = map.get(sourceKey) || [];
      const targetEvts = map.get(targetKey) || [];
      targetEvts.push(...sourceEvts);
      map.delete(sourceKey);
    }

    const engagedVisitorIds = new Set<string>();
    events.forEach((e) => {
      if (
        e.visitor_id &&
        e.event_name !== "PageView" &&
        e.event_name !== "ViewContent"
      ) {
        engagedVisitorIds.add(e.visitor_id);
      }
    });

    const result = Array.from(map.entries())
      .map(([key, evts]) => {
        const sorted = [...evts].sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const namedEvent = sorted.find((e) => e.customer_name);
        const displayName = namedEvent?.customer_name || "Visitante";
        const firstName = displayName.split(" ")[0];
        const lastEvent = sorted[sorted.length - 1];
        const completed = sorted.some((e) => e.event_name === JOURNEY_END);
        const productName = products.find(
          (p) => p.id === sorted[0].product_id
        )?.name;

        const seenTypes = new Set<string>();
        const uniqueSteps = sorted.filter((e) => {
          if (seenTypes.has(e.event_name)) return false;
          seenTypes.add(e.event_name);
          return true;
        });

        const reachedSteps = new Set(uniqueSteps.map((e) => e.event_name));
        let maxIndex = -1;
        FUNNEL_STEPS.forEach((step, i) => {
          if (reachedSteps.has(step.key)) maxIndex = i;
        });
        const progress =
          FUNNEL_STEPS.length > 1
            ? Math.round((maxIndex / (FUNNEL_STEPS.length - 1)) * 100)
            : 0;

        const lastActivity = new Date(lastEvent.created_at).getTime();
        const now = Date.now();
        const tenMinutesAgo = now - 10 * 60 * 1000;
        const oneHourAgo = now - 60 * 60 * 1000;
        const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

        // Regra sugerida:
        // - Purchase: 24h
        // - Checkout/Lead: 1h
        // - PageView: 10 min
        let isVisible = false;
        if (completed) {
          isVisible = lastActivity > twentyFourHoursAgo;
        } else if (reachedSteps.has('InitiateCheckout') || reachedSteps.has('Lead') || reachedSteps.has('AddPaymentInfo')) {
          isVisible = lastActivity > oneHourAgo;
        } else {
          isVisible = lastActivity > tenMinutesAgo;
        }

        return {
          key,
          displayName,
          firstName,
          events: uniqueSteps,
          reachedSteps,
          lastEvent,
          completed,
          productName,
          progress,
          lastActivity,
          isEngaged: key.startsWith("name:") || (key && engagedVisitorIds.has(key)),
          isVisible
        };
      })
      .filter((j) => j.isVisible && (j.isEngaged || j.completed))
      .sort((a, b) => b.lastActivity - a.lastActivity);

    return result.slice(0, 100);
  }, [events, products]);

  if (journeys.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <motion.div animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 3, repeat: Infinity }}>
          <UserCheck className="w-8 h-8 text-muted-foreground/50" />
        </motion.div>
        <p className="text-sm text-muted-foreground font-medium">Nenhuma jornada no período selecionado</p>
        <p className="text-[11px] text-muted-foreground/70">PageView, ViewContent e checkout aparecem aqui quando chegam com visitor_id</p>
      </div>
    );
  }

  const completedCount = journeys.filter((j) => j.completed).length;
  const pendingCount = journeys.length - completedCount;

  return (
    <div>
      {/* Summary */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border/40">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/50 border border-border/30">
          <UserCheck className="w-3 h-3 text-muted-foreground" />
          <span className="text-[11px] font-semibold text-foreground">{journeys.length}</span>
          <span className="text-[10px] text-muted-foreground">visitantes</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20">
          <Loader2 className="w-3 h-3 text-amber-400" />
          <span className="text-[11px] font-semibold text-amber-400">{pendingCount}</span>
          <span className="text-[10px] text-amber-400/60">aguardando</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          <span className="text-[11px] font-semibold text-emerald-400">{completedCount}</span>
          <span className="text-[10px] text-emerald-400/60">convertidos</span>
        </div>
        {journeys.length > 0 && (
          <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/50 border border-border/30">
            <TrendingUp className="w-3 h-3 text-cyan-400" />
            <span className="text-[11px] font-semibold text-cyan-400">
              {((completedCount / journeys.length) * 100).toFixed(0)}%
            </span>
            <span className="text-[10px] text-muted-foreground">taxa</span>
          </div>
        )}
      </div>

      <div className="divide-y divide-border/40">
        <AnimatePresence mode="popLayout">
          {journeys.map((journey) => (
            <motion.div
              key={journey.key}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="px-5 py-4 hover:bg-muted/20 transition-colors"
            >
              {/* Header */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    journey.completed
                      ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
                      : "bg-muted text-muted-foreground ring-1 ring-border/30"
                  }`}
                >
                  {journey.firstName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-foreground truncate">
                      {journey.firstName}
                    </span>
                    {journey.completed ? (
                      <span className="flex items-center gap-1 text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-2.5 h-2.5" /> COMPROU
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" /> AGUARDANDO
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {journey.productName && (
                      <span className="text-[10px] text-muted-foreground truncate" title="Nome ocultado para sua privacidade">{maskProductName(journey.productName)}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground/60">
                      · {format(new Date(journey.lastEvent.created_at), "HH:mm:ss")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Funnel Progress Bar */}
              <div className="ml-10 mb-2">
                <div className="flex items-center gap-0">
                  {FUNNEL_STEPS.map((step, i) => {
                    const reached = journey.reachedSteps.has(step.key);
                    const Icon = step.icon;
                    const isLast = i === FUNNEL_STEPS.length - 1;
                    return (
                      <div key={step.key} className="flex items-center">
                        <div
                          className="flex items-center justify-center w-6 h-6 rounded-full transition-all relative group/step"
                          style={{
                            backgroundColor: reached ? `${step.color}25` : "hsl(var(--muted))",
                            border: `1.5px solid ${reached ? step.color : "hsl(var(--border))"}`,
                          }}
                          title={EVENT_LABELS[step.key] || step.key}
                        >
                          <Icon
                            className="w-2.5 h-2.5"
                            style={{ color: reached ? step.color : "hsl(var(--muted-foreground))" }}
                          />
                          {reached && step.key === "Purchase" && (
                            <motion.div
                              className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400"
                              animate={{ scale: [1, 1.4, 1] }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                            />
                          )}
                        </div>
                        {!isLast && (
                          <div
                            className="w-3 h-[2px] transition-colors"
                            style={{
                              backgroundColor: reached && journey.reachedSteps.has(FUNNEL_STEPS[i + 1]?.key)
                                ? step.color
                                : "hsl(var(--border))",
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                  <span className="ml-2 text-[10px] font-mono font-semibold tabular-nums" style={{
                    color: journey.completed ? "#34d399" : "#fbbf24"
                  }}>
                    {journey.progress}%
                  </span>
                </div>
              </div>

              {/* Last action label */}
              <div className="ml-10">
                <span className="text-[10px] text-muted-foreground italic">
                  Último: {EVENT_LABELS[journey.lastEvent.event_name] || journey.lastEvent.event_name}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CustomerJourneyFeed;
