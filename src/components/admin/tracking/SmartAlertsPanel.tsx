// @ts-nocheck
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, AlertCircle, CheckCircle2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { subHours, subMinutes } from "date-fns";

interface Props {
  userId?: string;
  filterProduct: string;
}

interface Alert {
  id: string;
  level: "error" | "warning" | "ok";
  title: string;
  detail: string;
}

const SmartAlertsPanel = ({ userId, filterProduct }: Props) => {
  const [rawAlerts, setRawAlerts] = useState<Alert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const evaluate = async () => {
      const next: Alert[] = [];
      const now = new Date();

      // Volume drop check
      const buildQ = (since: string, until?: string) => {
        let q = supabase
          .from("pixel_events")
          .select("id", { count: "exact", head: true })
          .gte("created_at", since);
        if (until) q = q.lt("created_at", until);
        if (userId) q = q.eq("user_id", userId);
        if (filterProduct !== "all") q = q.eq("product_id", filterProduct);
        return q;
      };

      const lastHour = subHours(now, 1).toISOString();
      const prevHour = subHours(now, 2).toISOString();
      const [{ count: cur }, { count: prev }] = await Promise.all([
        buildQ(lastHour),
        buildQ(prevHour, lastHour),
      ]);
      const curN = cur || 0;
      const prevN = prev || 0;
      if (prevN >= 10 && curN < prevN * 0.5) {
        next.push({
          id: "volume_drop",
          level: "error",
          title: "Queda de volume detectada",
          detail: `${curN} eventos na última hora vs ${prevN} na anterior (-${Math.round(((prevN - curN) / prevN) * 100)}%)`,
        });
      }

      // CAPI offline check (sem eventos server nos últimos 5min com browser ativo)
      const fiveMinAgo = subMinutes(now, 5).toISOString();
      let serverQ = supabase
        .from("pixel_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", fiveMinAgo)
        .eq("source", "server");
      if (userId) serverQ = serverQ.eq("user_id", userId);
      if (filterProduct !== "all") serverQ = serverQ.eq("product_id", filterProduct);

      let browserQ = supabase
        .from("pixel_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", fiveMinAgo)
        .eq("source", "browser");
      if (userId) browserQ = browserQ.eq("user_id", userId);
      if (filterProduct !== "all") browserQ = browserQ.eq("product_id", filterProduct);

      const [{ count: srv }, { count: brw }] = await Promise.all([serverQ, browserQ]);
      if ((brw || 0) >= 5 && (srv || 0) === 0) {
        next.push({
          id: "capi_offline",
          level: "warning",
          title: "CAPI possivelmente offline",
          detail: `${brw} eventos do navegador nos últimos 5min, mas zero pelo servidor`,
        });
      }

      if (next.length === 0) {
        next.push({
          id: "ok",
          level: "ok",
          title: "Tudo operacional",
          detail: "Pixel e CAPI sincronizados, volume estável",
        });
      }

      setRawAlerts(next);
    };

    evaluate();
    const interval = setInterval(evaluate, 60000);
    return () => clearInterval(interval);
  }, [userId, filterProduct]);

  const alerts = rawAlerts.filter((a) => !dismissed.has(a.id));

  const dismiss = (id: string) => setDismissed((prev) => new Set(prev).add(id));

  const config = {
    error: { Icon: AlertCircle, color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.3)" },
    warning: { Icon: AlertTriangle, color: "#fbbf24", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.3)" },
    ok: { Icon: CheckCircle2, color: "#34d399", bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.3)" },
  };

  return (
    <div className="space-y-2">
      <AnimatePresence>
        {alerts.map((a) => {
          const cfg = config[a.level];
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="rounded-lg border px-3 py-2.5 flex items-center gap-2.5"
              style={{ backgroundColor: cfg.bg, borderColor: cfg.border }}
            >
              <cfg.Icon className="w-4 h-4 shrink-0" style={{ color: cfg.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">{a.title}</p>
                <p className="text-[10px] text-muted-foreground">{a.detail}</p>
              </div>
              {a.level !== "ok" && (
                <button
                  onClick={() => dismiss(a.id)}
                  className="p-0.5 rounded hover:bg-muted/50 text-muted-foreground"
                  aria-label="Dispensar alerta"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default SmartAlertsPanel;
