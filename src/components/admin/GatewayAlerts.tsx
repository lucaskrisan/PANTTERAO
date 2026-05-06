import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CreditCard, ShieldAlert, Wrench } from "lucide-react";

interface Alert {
  id: string;
  icon: typeof AlertTriangle;
  message: string;
  action: string;
  path: string;
  variant: "warning" | "error";
}

const GatewayAlerts = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    if (!user) return;

    const check = async () => {
      const result: Alert[] = [];

      // 1. Check if any gateway is configured and active
      const { data: gateways } = await supabase
        .from("payment_gateways")
        .select("id, active, environment, provider, name");

      const hasAny = gateways && gateways.length > 0;
      const hasActive = gateways?.some((g) => g.active);

      if (!hasAny) {
        result.push({
          id: "no-gateway",
          icon: CreditCard,
          message: "Configure seu gateway de pagamento para começar a vender.",
          action: "Configurar agora →",
          path: "/admin/gateway-management",
          variant: "error",
        });
      } else if (!hasActive) {
        result.push({
          id: "no-active-gateway",
          icon: CreditCard,
          message: "Nenhum gateway está ativo. Seus clientes não conseguirão pagar.",
          action: "Ativar gateway →",
          path: "/admin/gateway-management",
          variant: "error",
        });
      }

      // 2. Check sandbox gateways — only warn if ALL active gateways are sandbox (no production one exists)
      const activeGateways = gateways?.filter((g) => g.active) || [];
      const hasProductionGateway = activeGateways.some((g) => g.environment === "production");
      const hasSandboxGateway = activeGateways.some((g) => g.environment === "sandbox");

      if (hasSandboxGateway && !hasProductionGateway && activeGateways.length > 0) {
        const { data: products } = await supabase
          .from("products")
          .select("id")
          .eq("active", true)
          .eq("user_id", user.id)
          .limit(1);

        if (products && products.length > 0) {
          result.push({
            id: "sandbox-warning",
            icon: ShieldAlert,
            message: "Todos os seus gateways ativos estão em modo teste (sandbox). Clientes reais não conseguirão pagar.",
            action: "Mudar para produção →",
            path: "/admin/gateway-management",
            variant: "warning",
          });
        }
      }

      // 3. Only show gateway failure alerts if the producer has NO active gateway at all
      //    (if they have at least one working active gateway, these old tasks are noise)
      if (!hasActive) {
        const { data: recentAlerts } = await supabase
          .from("internal_tasks")
          .select("id, title, description")
          .eq("category", "gateway_error")
          .eq("status", "todo")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(3);

        if (recentAlerts && recentAlerts.length > 0) {
          result.push({
            id: "gateway-failure",
            icon: Wrench,
            message: `${recentAlerts.length} falha(s) de gateway detectada(s). Verifique sua configuração.`,
            action: "Corrigir configuração →",
            path: "/admin/gateway-management",
            variant: "error",
          });
        }
      }

      setAlerts(result);
    };

    check();
  }, [user]);

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
            alert.variant === "error"
              ? "border-destructive/50 bg-destructive/5 hover:bg-destructive/10"
              : "border-yellow-500/50 bg-yellow-500/5 hover:bg-yellow-500/10"
          }`}
          onClick={() => navigate(alert.path)}
        >
          <alert.icon
            className={`w-4 h-4 shrink-0 ${
              alert.variant === "error" ? "text-destructive" : "text-yellow-500"
            }`}
          />
          <span className="text-sm text-foreground flex-1">{alert.message}</span>
          <span
            className={`text-xs font-medium whitespace-nowrap ${
              alert.variant === "error" ? "text-destructive" : "text-yellow-600"
            }`}
          >
            {alert.action}
          </span>
        </div>
      ))}
    </div>
  );
};

export default GatewayAlerts;
