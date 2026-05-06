import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Wallet, TrendingUp, DollarSign, CreditCard, ArrowDownLeft, BarChart3,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export interface GatewayConfig {
  id?: string;
  provider: "asaas" | "pagarme" | "mercadopago" | "stripe";
  name: string;
  environment: "sandbox" | "production";
  active: boolean;
  payment_methods: string[];
  config: Record<string, any>;
}

const providerLabels: Record<string, string> = {
  asaas: "Asaas",
  pagarme: "Pagar.me",
  mercadopago: "Mercado Pago",
  stripe: "Stripe",
};

interface RevenueSummary {
  totalRevenue: number;
  totalFees: number;
  totalPending: number;
  paidCount: number;
  pendingCount: number;
  totalRevenueUsd: number;
  totalFeesUsd: number;
  totalPendingUsd: number;
  paidCountUsd: number;
}

const Gateways = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [revenue, setRevenue] = useState<RevenueSummary>({
    totalRevenue: 0, totalFees: 0, totalPending: 0, paidCount: 0, pendingCount: 0,
    totalRevenueUsd: 0, totalFeesUsd: 0, totalPendingUsd: 0, paidCountUsd: 0,
  });
  const [recentPaid, setRecentPaid] = useState<any[]>([]);
  const [gateways, setGateways] = useState<GatewayConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      const [revenueRes, recentRes, gwRes] = await Promise.all([
        // Server-side aggregation instead of fetching ALL orders
        supabase.rpc("get_revenue_summary", { p_user_id: user.id }),
        // Only fetch 10 recent paid orders for the table
        supabase
          .from("orders")
          .select("id, created_at, amount, platform_fee_amount, payment_method")
          .in("status", ["paid", "approved"])
          .order("created_at", { ascending: false })
          .limit(10),
        supabase.from("payment_gateways").select("id, name, provider, active, environment, payment_methods, created_at, updated_at, user_id").order("created_at"),
      ]);

      if (revenueRes.data && revenueRes.data.length > 0) {
        const r = revenueRes.data[0];
        setRevenue({
          totalRevenue: Number(r.total_revenue),
          totalFees: Number(r.total_fees),
          totalPending: Number(r.total_pending),
          paidCount: Number(r.paid_count),
          pendingCount: Number(r.pending_count),
          totalRevenueUsd: Number((r as any).total_revenue_usd ?? 0),
          totalFeesUsd: Number((r as any).total_fees_usd ?? 0),
          totalPendingUsd: Number((r as any).total_pending_usd ?? 0),
          paidCountUsd: Number((r as any).paid_count_usd ?? 0),
        });
      }

      setRecentPaid(recentRes.data || []);

      if (gwRes.data) {
        setGateways(gwRes.data.map((g: any) => ({
          id: g.id, provider: g.provider, name: g.name, environment: g.environment,
          active: g.active, payment_methods: (g.payment_methods as string[]) || [],
          config: {},
        })));
      }
    } catch (error) {
      console.error("[gateways] loadData error:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const netRevenue = revenue.totalRevenue - revenue.totalFees;
  const netRevenueUsd = revenue.totalRevenueUsd - revenue.totalFeesUsd;
  const hasUsd = revenue.totalRevenueUsd > 0 || revenue.paidCountUsd > 0 || revenue.totalPendingUsd > 0;
  const fmtUsd = (n: number) => `US$ ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const activeGateways = gateways.filter(g => g.active);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-1">Resumo financeiro e transações recentes</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/admin/integrations")}>
          <CreditCard className="w-4 h-4 mr-2" /> Gerenciar Gateways
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-green-500" />
              </div>
              <span className="text-xs text-muted-foreground">Receita Total</span>
            </div>
            <p className="text-xl font-bold text-foreground">
              R$ {revenue.totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">{revenue.paidCount} vendas aprovadas</p>
            {hasUsd && (
              <p className="text-[11px] text-muted-foreground mt-1.5 pt-1.5 border-t border-border/40">
                + {fmtUsd(revenue.totalRevenueUsd)} <span className="opacity-60">({revenue.paidCountUsd} em USD)</span>
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-blue-500" />
              </div>
              <span className="text-xs text-muted-foreground">Receita Líquida</span>
            </div>
            <p className="text-xl font-bold text-foreground">
              R$ {netRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Após taxas da plataforma</p>
            {hasUsd && (
              <p className="text-[11px] text-muted-foreground mt-1.5 pt-1.5 border-t border-border/40">
                + {fmtUsd(netRevenueUsd)} <span className="opacity-60">líquido em USD</span>
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-yellow-500" />
              </div>
              <span className="text-xs text-muted-foreground">Pendente</span>
            </div>
            <p className="text-xl font-bold text-foreground">
              R$ {revenue.totalPending.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">{revenue.pendingCount} aguardando pagamento</p>
            {hasUsd && revenue.totalPendingUsd > 0 && (
              <p className="text-[11px] text-muted-foreground mt-1.5 pt-1.5 border-t border-border/40">
                + {fmtUsd(revenue.totalPendingUsd)} <span className="opacity-60">em USD</span>
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                <ArrowDownLeft className="w-4 h-4 text-red-500" />
              </div>
              <span className="text-xs text-muted-foreground">Taxas Plataforma</span>
            </div>
            <p className="text-xl font-bold text-foreground">
              R$ {revenue.totalFees.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Acumuladas no período</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Gateways summary */}
      {activeGateways.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <CreditCard className="w-4 h-4" /> Gateways Ativos
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-3">
              {activeGateways.map(gw => (
                <div key={gw.id} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm font-medium text-foreground">{gw.name}</span>
                  <Badge variant="outline" className="text-[10px]">{providerLabels[gw.provider]}</Badge>
                  {gw.payment_methods.map(m => (
                    <Badge key={m} variant="secondary" className="text-[10px]">
                      {m === "pix" ? "PIX" : m === "credit_card" ? "Cartão" : m}
                    </Badge>
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent transactions */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> Últimas Transações Aprovadas
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : recentPaid.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma transação aprovada ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs">Método</TableHead>
                  <TableHead className="text-xs text-right">Valor</TableHead>
                  <TableHead className="text-xs text-right">Taxa</TableHead>
                  <TableHead className="text-xs text-right">Líquido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentPaid.map(order => {
                  const fee = Number(order.platform_fee_amount || 0);
                  const net = Number(order.amount) - fee;
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="text-xs">
                        {new Date(order.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">
                          {order.payment_method === "pix" ? "PIX" : order.payment_method === "credit_card" ? "Cartão" : order.payment_method}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-right font-medium">
                        R$ {Number(order.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-xs text-right text-red-400">
                        -R$ {fee.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-xs text-right text-green-400 font-medium">
                        R$ {net.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Gateways;
