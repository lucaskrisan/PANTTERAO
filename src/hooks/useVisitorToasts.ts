import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SUPER_ADMIN_EMAIL = "trafegocomkrisan@gmail.com";
const SUPER_ADMIN_EMAILS = new Set([SUPER_ADMIN_EMAIL]);

const EVENT_LABELS: Record<string, { emoji: string; label: string }> = {
  PageView: { emoji: "👀", label: "acessou a página" },
  ViewContent: { emoji: "📖", label: "viu a oferta" },
  InitiateCheckout: { emoji: "🛒", label: "abriu o checkout" },
  Lead: { emoji: "✍️", label: "preencheu os dados" },
  AddPaymentInfo: { emoji: "💳", label: "informou pagamento" },
  Purchase: { emoji: "🎉", label: "comprou!" },
};

export function useVisitorToasts(userId: string | undefined, userEmail: string | undefined) {
  const lastToastRef = useRef(0);

  useEffect(() => {
    if (!userId) return;
    if (SUPER_ADMIN_EMAILS.has(userEmail ?? "")) return;

    const ch = supabase
      .channel("admin-visitor-toasts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pixel_events" }, (payload: any) => {
        const evt = payload.new;
        if (!evt || evt.visitor_id?.startsWith("sim_")) return;
        if (userId && evt.user_id !== userId) return;

        const now = Date.now();
        if (now - lastToastRef.current < 3000) return;
        lastToastRef.current = now;

        const cfg = EVENT_LABELS[evt.event_name];
        if (!cfg) return;

        const name = evt.customer_name?.split(" ")[0] || "Visitante";
        toast(`${cfg.emoji} ${name} ${cfg.label}`, {
          duration: 4000,
          position: "bottom-right",
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, userEmail]);
}
