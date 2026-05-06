// @ts-nocheck
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  BarChart3,
  Eye,
  Activity,
  Loader2,
  TrendingUp,
  Globe,
  ShoppingCart,
  CreditCard,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  ResponsiveContainer,
} from "recharts";

const FUNNEL_STEPS = [
  {
    key: "PageView",
    label: "Visitante",
    icon: Eye,
    color: "hsl(220, 80%, 60%)",
  },
  {
    key: "ViewContent",
    label: "Viu Produto",
    icon: Globe,
    color: "hsl(200, 70%, 50%)",
  },
  {
    key: "InitiateCheckout",
    label: "Checkout",
    icon: ShoppingCart,
    color: "hsl(151, 70%, 45%)",
  },
  {
    key: "AddPaymentInfo",
    label: "Pagamento",
    icon: CreditCard,
    color: "hsl(40, 90%, 50%)",
  },
  {
    key: "Purchase",
    label: "Aprovado",
    icon: CheckCircle,
    color: "hsl(151, 100%, 35%)",
  },
];

const Analytics = () => {
  const { user, isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState("30days");

  const getDateFrom = (p) => {
    const now = new Date();
    if (p === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    if (p === "7days") {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d.toISOString();
    }
    if (p === "30days") {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return d.toISOString();
    }
    if (p === "90days") {
      const d = new Date(now);
      d.setDate(d.getDate() - 90);
      return d.toISOString();
    }
    return null;
  };

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      try {
        const dateFrom = getDateFrom(period);
        const { data: res, error } = await supabase.rpc("get_analytics_summary", {
          p_user_id: user.id,
          p_date_from: dateFrom,
          p_is_super_admin: isSuperAdmin,
        });

        if (error) throw error;
        setData(res);
      } catch (err) {
        console.error("[analytics] error:", err);
        toast.error("Erro ao carregar dados analíticos");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, period, isSuperAdmin]);

  const funnelData = useMemo(() => {
    const counts = data?.funnel || {};
    return FUNNEL_STEPS.map((step) => ({
      ...step,
      count: counts[step.key] || 0,
    }));
  }, [data]);

  const funnelMax = Math.max(...funnelData.map((f) => f.count), 1);
  const revenueByDay = data?.revenue_by_day || [];
  const totalRevenue = data?.total_revenue || 0;
  const paidCount = data?.paid_count || 0;
  const chargebackCount = data?.chargeback_count || 0;
  const uniqueVisitors = data?.unique_visitors || 0;

  const fmt = (v) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(v || 0);

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Panttera Analytics
          </h1>
          <p className="text-muted-foreground">
            Visão inteligente de performance
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[160px] bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="7days">7 dias</SelectItem>
            <SelectItem value="30days">30 dias</SelectItem>
            <SelectItem value="90days">90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Faturamento", value: fmt(totalRevenue), icon: TrendingUp },
          { label: "Vendas", value: paidCount, icon: ShoppingCart },
          { label: "Chargebacks", value: chargebackCount, icon: AlertTriangle, color: "text-red-500" },
          { label: "Visitantes", value: uniqueVisitors, icon: Eye },
          {
            label: "Conversão",
            value: uniqueVisitors > 0 ? `${((paidCount / uniqueVisitors) * 100).toFixed(1)}%` : "0%",
            icon: Activity,
          },
        ].map((kpi, i) => (
          <Card key={i} className="bg-gradient-to-br from-card to-card/50 shadow-sm border-border/50">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`p-3 bg-primary/10 rounded-xl ${kpi.color || 'text-primary'}`}>
                <kpi.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">{kpi.label}</p>
                <p className="text-lg font-bold">{kpi.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-2 bg-card/50 shadow-sm border-border/50">
          <CardHeader>
            <CardTitle>Faturamento diário</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueByDay}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} />
                <ReTooltip formatter={(v) => [fmt(v), ""]} />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card/50 shadow-sm border-border/50">
          <CardHeader>
            <CardTitle>Funil de Conversão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {funnelData.map((step) => (
              <div key={step.key}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="flex items-center gap-2 font-medium">
                    <step.icon className="w-4 h-4" style={{ color: step.color }} /> {step.label}
                  </span>
                  <span className="font-bold">{step.count}</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${funnelMax > 0 ? (step.count / funnelMax) * 100 : 0}%`,
                      backgroundColor: step.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Analytics;