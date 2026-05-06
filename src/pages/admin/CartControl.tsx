import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Mail, ShoppingCart, Clock, CheckCircle, XCircle, AlertTriangle,
  RefreshCcw, TrendingUp, Users, Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const DELAY_OPTIONS = [
  { value: "15", label: "15 minutos" },
  { value: "30", label: "30 minutos" },
  { value: "60", label: "1 hora" },
  { value: "120", label: "2 horas" },
  { value: "360", label: "6 horas" },
];

interface ProducerSetting {
  user_id: string;
  email_enabled: boolean;
  email_delay_minutes: number;
  producer_name: string | null;
  producer_email: string | null;
}

interface CartStats {
  total: number;
  recovered: number;
  emailSent: number;
  emailError: number;
  pending: number;
}

interface RecentRecovery {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  email_recovery_status: string | null;
  email_recovery_sent_at: string | null;
  created_at: string;
  recovered: boolean;
  product_name: string | null;
  producer_name: string | null;
}

const CartControl = () => {
  const { isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [producerSettings, setProducerSettings] = useState<ProducerSetting[]>([]);
  const [stats, setStats] = useState<CartStats>({ total: 0, recovered: 0, emailSent: 0, emailError: 0, pending: 0 });
  const [recentRecoveries, setRecentRecoveries] = useState<RecentRecovery[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);


  useEffect(() => {
    if (!isSuperAdmin) return;
    loadData();
  }, [isSuperAdmin, refreshKey]);

  const loadData = async () => {
    setLoading(true);

    // 1. Load all producer recovery settings with profiles
    const { data: settings } = await supabase
      .from("cart_recovery_settings")
      .select("*");

    // Get profile names for producers
    const userIds = (settings || []).map(s => s.user_id);
    let profileMap: Record<string, { full_name: string | null }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      (profiles || []).forEach(p => { profileMap[p.id] = p; });
    }

    // Get auth user emails via list-users if possible
    const enriched: ProducerSetting[] = (settings || []).map(s => ({
      user_id: s.user_id,
      email_enabled: s.email_enabled,
      email_delay_minutes: s.email_delay_minutes,
      producer_name: profileMap[s.user_id]?.full_name || null,
      producer_email: null,
    }));
    setProducerSettings(enriched);

    // 2. Load cart stats (all producers)
    const { data: allCarts } = await supabase
      .from("abandoned_carts")
      .select("recovered, email_recovery_status, email_recovery_sent_at")
      .limit(1000);

    const carts = allCarts || [];
    setStats({
      total: carts.length,
      recovered: carts.filter(c => c.recovered).length,
      emailSent: carts.filter(c => c.email_recovery_status === "sent").length,
      emailError: carts.filter(c => c.email_recovery_status === "error").length,
      pending: carts.filter(c => !c.recovered && !c.email_recovery_sent_at).length,
    });

    // 3. Load recent recovery attempts (last 50 with email sent)
    const { data: recent } = await supabase
      .from("abandoned_carts")
      .select("id, customer_name, customer_email, email_recovery_status, email_recovery_sent_at, created_at, recovered, product_id, user_id, products(name)")
      .not("email_recovery_sent_at", "is", null)
      .order("email_recovery_sent_at", { ascending: false })
      .limit(50);

    // Enrich with producer names
    const recentUserIds = [...new Set((recent || []).map(r => (r as any).user_id))];
    let recentProfileMap: Record<string, string> = {};
    if (recentUserIds.length > 0) {
      const { data: rProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", recentUserIds);
      (rProfiles || []).forEach(p => { recentProfileMap[p.id] = p.full_name || "Produtor"; });
    }

    setRecentRecoveries((recent || []).map((r: any) => ({
      id: r.id,
      customer_name: r.customer_name,
      customer_email: r.customer_email,
      email_recovery_status: r.email_recovery_status,
      email_recovery_sent_at: r.email_recovery_sent_at,
      created_at: r.created_at,
      recovered: r.recovered,
      product_name: r.products?.name || null,
      producer_name: recentProfileMap[r.user_id] || null,
    })));

    setLoading(false);
  };

  const recoveryRate = stats.total > 0 ? ((stats.recovered / stats.total) * 100).toFixed(1) : "0";

  if (!isSuperAdmin) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        <AlertTriangle className="w-10 h-10 mx-auto mb-3" />
        <p>Acesso restrito ao Super Admin.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-primary" />
            Controle de Carrinhos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitoramento em tempo real de carrinhos abandonados e recuperações em toda a plataforma
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => setRefreshKey(k => k + 1)}>
          <RefreshCcw className="w-4 h-4" />
          Atualizar
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-border bg-card">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <ShoppingCart className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wide">Total</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{loading ? "..." : stats.total}</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-xs uppercase tracking-wide">Recuperados</span>
            </div>
            <p className="text-2xl font-bold text-green-500">{loading ? "..." : stats.recovered}</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Mail className="w-4 h-4 text-blue-500" />
              <span className="text-xs uppercase tracking-wide">E-mails Enviados</span>
            </div>
            <p className="text-2xl font-bold text-blue-500">{loading ? "..." : stats.emailSent}</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <XCircle className="w-4 h-4 text-red-500" />
              <span className="text-xs uppercase tracking-wide">Erros E-mail</span>
            </div>
            <p className="text-2xl font-bold text-red-500">{loading ? "..." : stats.emailError}</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-xs uppercase tracking-wide">Taxa Recup.</span>
            </div>
            <p className="text-2xl font-bold text-primary">{loading ? "..." : `${recoveryRate}%`}</p>
          </CardContent>
        </Card>
      </div>

      {/* Producers with Recovery Settings */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Configurações por Produtor
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>
          ) : producerSettings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhum produtor configurou a recuperação de carrinhos ainda.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produtor</TableHead>
                    <TableHead>E-mail Automático</TableHead>
                    <TableHead>Delay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {producerSettings.map(s => (
                    <TableRow key={s.user_id}>
                      <TableCell>
                        <span className="text-sm font-medium text-foreground">
                          {s.producer_name || s.user_id.slice(0, 8)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.email_enabled ? "default" : "secondary"}>
                          {s.email_enabled ? "Ativado" : "Desativado"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {DELAY_OPTIONS.find(d => d.value === String(s.email_delay_minutes))?.label || `${s.email_delay_minutes} min`}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Recovery Attempts */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Últimas Recuperações Enviadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>
          ) : recentRecoveries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhum e-mail de recuperação enviado ainda.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Produtor</TableHead>
                    <TableHead>Enviado em</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Recuperado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentRecoveries.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium text-foreground">{r.customer_name || "—"}</p>
                          <p className="text-xs text-muted-foreground">{r.customer_email || "—"}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.product_name || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.producer_name || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.email_recovery_sent_at
                          ? format(new Date(r.email_recovery_sent_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            r.email_recovery_status === "sent" ? "bg-green-500" :
                            r.email_recovery_status === "error" ? "bg-red-500" : "bg-gray-400"
                          }`} />
                          <span className="text-xs text-muted-foreground capitalize">
                            {r.email_recovery_status === "sent" ? "Enviado" :
                             r.email_recovery_status === "error" ? "Erro" : "Pendente"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {r.recovered ? (
                          <Badge variant="default" className="bg-green-600 text-xs">Sim</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Não</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Carts (not yet contacted) */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-yellow-500" />
            Carrinhos Pendentes (sem e-mail)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-yellow-500">{loading ? "..." : stats.pending}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Carrinhos abandonados que ainda não receberam e-mail de recuperação
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default CartControl;
