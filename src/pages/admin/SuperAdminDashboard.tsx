// @ts-nocheck
import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthOrigin } from "@/lib/getAuthOrigin";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users, DollarSign, ShoppingCart, TrendingUp, Search, ShieldCheck, ShieldX, Loader2,
  Crown, Eye, ArrowLeft, CreditCard, AlertTriangle, Ban, CheckCircle, RefreshCcw,
  Activity, Webhook, Mail, Package, BarChart3, Wallet, Server, UserPlus, Trash2, Send,
  Globe, Shield, Clock,
} from "lucide-react";
import { useCheckoutPresence } from "@/hooks/useCheckoutPresence";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import SecurityScanner from "@/components/admin/SecurityScanner";

/* ─── Types ────────────────────────────────────── */
interface Producer {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  cpf: string | null;
  created_at: string;
  product_count: number;
  order_count: number;
  total_revenue: number;
  pending_revenue: number;
}

interface UserWithRoles {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  cpf: string | null;
  created_at: string;
  roles: string[];
}

interface BillingAccount {
  user_id: string;
  balance: number;
  credit_limit: number;
  credit_tier: string;
  blocked: boolean;
  card_last4: string | null;
  card_brand: string | null;
  producer_name?: string;
}

interface BillingTx {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
  order_id: string | null;
  producer_name?: string;
}

type Period = "today" | "7days" | "month" | "total";
const periodLabels: Record<Period, string> = {
  today: "Hoje", "7days": "7 dias", month: "Mês atual", total: "Total",
};

const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

/* ─── Component ────────────────────────────────── */
const SuperAdminDashboard = () => {
  const { isSuperAdmin, isCollaborator, user } = useAuth();

  // Data state — declared early so useMemo can reference products
  const [products, setProducts] = useState<any[]>([]);

  // Super admin sees only visitors on THEIR OWN checkouts (empty array while loading = 0)
  const myProductIds = useMemo(
    () => (user ? products.filter((p) => p.user_id === user.id).map((p) => p.id) : []),
    [products, user],
  );
  const liveVisitors = useCheckoutPresence("watch", undefined, myProductIds);

  // Data state
  const [producers, setProducers] = useState<Producer[]>([]);
  const [allUsers, setAllUsers] = useState<UserWithRoles[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [billingAccounts, setBillingAccounts] = useState<BillingAccount[]>([]);
  const [billingTxs, setBillingTxs] = useState<BillingTx[]>([]);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
   const [webhookEndpoints, setWebhookEndpoints] = useState<any[]>([]);
   const [rateLimitHits, setRateLimitHits] = useState<any[]>([]);
   const [allGateways, setAllGateways] = useState<any[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [period, setPeriod] = useState<Period>("today");
  const [selectedProducerId, setSelectedProducerId] = useState<string | null>(null);
  const [feePercent, setFeePercent] = useState(4.99);
  const [showAddProducer, setShowAddProducer] = useState(false);
  const [addType, setAddType] = useState<"admin" | "collaborator">("admin");
  const [newProducer, setNewProducer] = useState({ full_name: "", email: "" });
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [selectedUser, setSelectedUser] = useState<(UserWithRoles & { product_count?: number; order_count?: number; total_revenue?: number }) | null>(null);

  useEffect(() => {
    if (isSuperAdmin || isCollaborator) loadAll();
  }, [isSuperAdmin, isCollaborator]);

  const loadAll = useCallback(async () => {
    // Se for colaborador, pode haver restrições de permissão no RLS dependendo da política
    // mas aqui o dashboard tenta carregar tudo o que o usuário tem acesso.
    setLoading(true);
    const [
      { data: rolesData },
      { data: profilesData },
      { data: ordersData },
      { data: productsData },
      { data: settingsData },
      { data: billingData },
      { data: txData },
      { data: emailData },
      { data: webhooksData },
      { data: rateLimitData },
      { data: gatewaysData },
    ] = await Promise.all([
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("products").select("*"),
      supabase.from("platform_settings").select("*").limit(1).single(),
      supabase.from("billing_accounts").select("*"),
      supabase.from("billing_transactions").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("email_logs").select("id, email_type, status, to_email, to_name, subject, created_at, user_id, cost_estimate").order("created_at", { ascending: false }).limit(100),
      supabase.from("webhook_endpoints").select("*"),
      supabase.from("rate_limit_hits").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("payment_gateways").select("id, active, environment, provider, name, user_id"),
    ]);

    // Fetch emails from auth.users via edge function
    let emailMap: Record<string, string> = {};
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-users`, {
        headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
      });
      if (res.ok) {
        const result = await res.json();
        emailMap = result.emails || {};
      }
    } catch (e) {
      console.warn("Failed to fetch user emails:", e);
    }

    const fee = (settingsData as any)?.platform_fee_percent || 4.99;
    setFeePercent(fee);

    // Build role map
    const roleMap = new Map<string, string[]>();
    (rolesData || []).forEach((r: any) => {
      if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, []);
      roleMap.get(r.user_id)!.push(r.role);
    });

    // Profile detail map
    const profileMap = new Map<string, any>();
    (profilesData || []).forEach((p: any) => profileMap.set(p.id, p));

    // All users
    const users: UserWithRoles[] = (profilesData || []).map((p: any) => ({
      id: p.id, full_name: p.full_name, email: emailMap[p.id] || "", phone: p.phone || null, cpf: p.cpf || null, created_at: p.created_at, roles: roleMap.get(p.id) || [],
    }));
    setAllUsers(users);

    // Profile name map
    const nameMap = new Map<string, string>();
    (profilesData || []).forEach((p: any) => nameMap.set(p.id, p.full_name || "Sem nome"));

    // Producers
    const adminIds = new Set((rolesData || []).filter((r: any) => r.role === "admin" || r.role === "super_admin").map((r: any) => r.user_id));
    const producerMap = new Map<string, Producer>();
    adminIds.forEach((uid) => {
      const profile = profileMap.get(uid);
      producerMap.set(uid, {
        id: uid, full_name: nameMap.get(uid) || "Sem nome", email: emailMap[uid] || "", phone: profile?.phone || null, cpf: profile?.cpf || null, created_at: profile?.created_at || "",
        product_count: 0, order_count: 0, total_revenue: 0, pending_revenue: 0,
      });
    });
    (productsData || []).forEach((p: any) => {
      if (p.user_id && producerMap.has(p.user_id)) producerMap.get(p.user_id)!.product_count++;
    });
    (ordersData || []).forEach((o: any) => {
      if (o.user_id && producerMap.has(o.user_id)) {
        const prod = producerMap.get(o.user_id)!;
        prod.order_count++;
        const s = String(o.status).toLowerCase();
        if (s === "paid" || s === "approved") prod.total_revenue += Number(o.amount);
        if (s === "pending") prod.pending_revenue += Number(o.amount);
      }
    });
    setProducers(Array.from(producerMap.values()));
    setOrders(ordersData || []);
    setProducts(productsData || []);

    // Billing
    setBillingAccounts((billingData || []).map((b: any) => ({ ...b, producer_name: nameMap.get(b.user_id) || "Sem nome" })));
    setBillingTxs((txData || []).map((t: any) => ({ ...t, producer_name: nameMap.get(t.user_id) || "Sem nome" })));

    // Logs
    setEmailLogs((emailData || []).map((e: any) => ({ ...e, producer_name: nameMap.get(e.user_id) || "—" })));
    setWebhookEndpoints(webhooksData || []);
    setRateLimitHits(rateLimitData || []);
    setAllGateways(gatewaysData || []);

    setLoading(false);
  }, []);

  /* ─── Actions ─── */
  const promoteToAdmin = async (userId: string) => {
    if (userId === user?.id) return;
    setActionLoading(userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" as any });
    if (error) toast.error("Erro: " + error.message);
    else { toast.success("Promovido a Produtor!"); await loadAll(); }
    setActionLoading(null);
  };

  const demoteFromAdmin = async (userId: string) => {
    if (userId === user?.id) return;
    setActionLoading(userId);
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin" as any);
    if (error) toast.error("Erro: " + error.message);
    else { toast.success("Acesso removido!"); await loadAll(); }
    setActionLoading(null);
  };

  const handleCreateUser = async () => {
    const { full_name, email } = newProducer;
    if (!full_name.trim() || !email.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }
    setActionLoading("new-producer");
    const { data: sessionData } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-producer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session?.access_token}`,
      },
      body: JSON.stringify({ email: email.trim(), full_name: full_name.trim(), role: addType }),
    });
    const result = await res.json();
    if (!res.ok) {
      toast.error(result.error || "Erro ao criar usuário");
    } else {
      toast.success(`Convite enviado para "${email}"! O ${addType === "admin" ? "produtor" : "colaborador"} receberá um email para definir a senha.`);
      setShowAddProducer(false);
      setNewProducer({ full_name: "", email: "" });
      await loadAll();
    }
    setActionLoading(null);
  };

  const handleDeleteProducer = async (producerId: string) => {
    setActionLoading(producerId);
    const { data: sessionData } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-producer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session?.access_token}`,
      },
      body: JSON.stringify({ producer_id: producerId }),
    });
    const result = await res.json();
    if (!res.ok) {
      toast.error(result.error || "Erro ao excluir produtor");
    } else {
      toast.success("Produtor excluído com sucesso!");
      setDeleteTarget(null);
      if (selectedProducerId === producerId) setSelectedProducerId(null);
      await loadAll();
    }
    setActionLoading(null);
  };

  const handleResendInvite = async (producerEmail: string) => {
    if (!producerEmail) { toast.error("Email não encontrado"); return; }
    setActionLoading("resend-" + producerEmail);
    const { error } = await supabase.auth.resetPasswordForEmail(producerEmail, {
      redirectTo: `${getAuthOrigin()}/login`,
    });
    if (error) {
      toast.error("Erro ao reenviar: " + error.message);
    } else {
      toast.success(`Link de acesso enviado para ${producerEmail}!`);
    }
    setActionLoading(null);
  };

  /* ─── Computed ─── */
  const filterByPeriod = useCallback((items: any[]) => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return items.filter((item) => {
      const d = new Date(item.created_at);
      switch (period) {
        case "today": return d >= startOfDay;
        case "7days": { const w = new Date(startOfDay); w.setDate(w.getDate() - 7); return d >= w; }
        case "month": return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        case "total": return true;
        default: return true;
      }
    });
  }, [period]);

  const paidStatuses = useMemo(() => new Set(["paid", "approved"]), []);
  const periodOrders = useMemo(() => filterByPeriod(orders), [orders, filterByPeriod]);
  const periodApproved = useMemo(() => periodOrders.filter((o) => paidStatuses.has(String(o.status).toLowerCase())), [periodOrders]);

  const totalRevenue = periodApproved.reduce((s, o) => s + Number(o.amount), 0);
  const totalPlatformFees = totalRevenue * (feePercent / 100);
  const totalOrders = periodOrders.length;
  const approvedCount = periodApproved.length;

  // Chart
  const chartData = useMemo(() => {
    const days: Record<string, { revenue: number; fees: number }> = {};
    const now = new Date();
    const numDays = period === "today" ? 1 : period === "7days" ? 7 : 30;
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      days[d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })] = { revenue: 0, fees: 0 };
    }
    periodApproved.forEach((o) => {
      const key = new Date(o.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      if (days[key] !== undefined) {
        const amt = Number(o.amount);
        days[key].revenue += amt;
        days[key].fees += amt * (feePercent / 100);
      }
    });
    return Object.entries(days).map(([name, v]) => ({ name, ...v }));
  }, [periodApproved, period, feePercent]);

  // Monthly accumulated fees chart (last 12 months)
  const monthlyFeesChart = useMemo(() => {
    const months: Record<string, { revenue: number; fees: number; feeCount: number }> = {};
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      months[key] = { revenue: 0, fees: 0, feeCount: 0 };
    }
    // Use billing transactions for actual fees charged
    billingTxs.filter(t => t.type === "fee").forEach((tx) => {
      const d = new Date(tx.created_at);
      const key = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      if (months[key] !== undefined) {
        months[key].fees += Number(tx.amount);
        months[key].feeCount++;
      }
    });
    // Revenue from approved orders
    orders.filter(o => ["paid", "approved"].includes(String(o.status).toLowerCase())).forEach((o) => {
      const d = new Date(o.created_at);
      const key = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      if (months[key] !== undefined) {
        months[key].revenue += Number(o.amount);
      }
    });
    return Object.entries(months).map(([name, v]) => ({ name, ...v }));
  }, [orders, billingTxs]);

  // Automatic alerts
  const platformAlerts = useMemo(() => {
    const alerts: { id: string; icon: typeof AlertTriangle; message: string; variant: "error" | "warning" }[] = [];

    // Producers with negative balance
    const negativeAccounts = billingAccounts.filter(b => b.balance < 0);
    if (negativeAccounts.length > 0) {
      alerts.push({
        id: "negative-balance",
        icon: DollarSign,
        message: `${negativeAccounts.length} produtor(es) com saldo negativo: ${negativeAccounts.map(b => b.producer_name).join(", ")}`,
        variant: "error",
      });
    }

    // Blocked producers
    const blockedAccounts = billingAccounts.filter(b => b.blocked);
    if (blockedAccounts.length > 0) {
      alerts.push({
        id: "blocked-producers",
        icon: Ban,
        message: `${blockedAccounts.length} produtor(es) bloqueado(s): ${blockedAccounts.map(b => b.producer_name).join(", ")}`,
        variant: "error",
      });
    }

    // Producers with NO active gateway but with active products
    const producersWithGateway = new Set((allGateways || []).filter(g => g.active).map(g => g.user_id));
    const producersWithProducts = producers.filter(p => p.product_count > 0 && !producersWithGateway.has(p.id) && p.id !== user?.id);
    if (producersWithProducts.length > 0) {
      alerts.push({
        id: "no-gateway",
        icon: CreditCard,
        message: `${producersWithProducts.length} produtor(es) sem gateway ativo: ${producersWithProducts.map(p => p.full_name || "Sem nome").join(", ")}`,
        variant: "warning",
      });
    }

    // All active gateways in sandbox mode
    const activeGateways = (allGateways || []).filter(g => g.active);
    const allSandbox = activeGateways.length > 0 && activeGateways.every(g => g.environment === "sandbox");
    if (allSandbox) {
      alerts.push({
        id: "all-sandbox",
        icon: AlertTriangle,
        message: "Todos os gateways ativos estão em modo sandbox. Pagamentos reais não serão processados.",
        variant: "warning",
      });
    }

    return alerts;
  }, [billingAccounts, allGateways, producers, user?.id]);

  // Producer drill-down
  const selectedProducer = useMemo(() => producers.find((p) => p.id === selectedProducerId), [producers, selectedProducerId]);
  const producerOrders = useMemo(() => {
    if (!selectedProducerId) return [];
    return filterByPeriod(orders.filter((o) => o.user_id === selectedProducerId));
  }, [orders, selectedProducerId, filterByPeriod]);
  const producerProducts = useMemo(() => {
    if (!selectedProducerId) return [];
    return products.filter((p) => p.user_id === selectedProducerId);
  }, [products, selectedProducerId]);

  if (!isSuperAdmin) {
    return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Acesso restrito ao Super Admin.</p></div>;
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const filteredProducers = producers.filter((p) => (p.full_name || "").toLowerCase().includes(search.toLowerCase()) || (p.email || "").toLowerCase().includes(search.toLowerCase()));
  const filteredUsers = allUsers.filter((u) => (u.full_name || "").toLowerCase().includes(userSearch.toLowerCase()) || (u.email || "").toLowerCase().includes(userSearch.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Crown className="w-6 h-6 text-primary" />
        <h1 className="font-display text-2xl font-bold text-foreground">Painel CEO — Super Admin</h1>
        <Button variant="ghost" size="sm" onClick={() => loadAll()} className="ml-auto gap-1.5">
          <RefreshCcw className="w-4 h-4" /> Atualizar
        </Button>
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-2">
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-[150px] h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(periodLabels) as Period[]).map((p) => <SelectItem key={p} value={p}>{periodLabels[p]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* ═══ AUTOMATIC ALERTS ═══ */}
      {platformAlerts.length > 0 && (
        <div className="space-y-2">
          {platformAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-center gap-3 rounded-lg border p-3 ${
                alert.variant === "error"
                  ? "border-destructive/50 bg-destructive/5"
                  : "border-yellow-500/50 bg-yellow-500/5"
              }`}
            >
              <alert.icon
                className={`w-4 h-4 shrink-0 ${
                  alert.variant === "error" ? "text-destructive" : "text-yellow-500"
                }`}
              />
              <span className="text-sm text-foreground flex-1">{alert.message}</span>
              <Badge variant={alert.variant === "error" ? "destructive" : "outline"} className="text-[10px] shrink-0">
                {alert.variant === "error" ? "Crítico" : "Atenção"}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Global KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { icon: Users, label: "Produtores", value: String(producers.length), color: "text-primary" },
          { icon: Globe, label: "Ao Vivo", value: String(liveVisitors), color: "text-emerald-500" },
          { icon: ShoppingCart, label: "Pedidos", value: String(totalOrders), color: "text-primary" },
          { icon: CheckCircle, label: "Aprovados", value: String(approvedCount), color: "text-emerald-500" },
          { icon: DollarSign, label: "Receita Total", value: fmt(totalRevenue), color: "text-primary" },
          { icon: TrendingUp, label: `Comissão (${feePercent}%)`, value: fmt(totalPlatformFees), color: "text-amber-500" },
        ].map((kpi, i) => (
          <Card key={i}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted"><kpi.icon className={`w-5 h-5 ${kpi.color}`} /></div>
              <div>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className="text-lg font-bold text-foreground">{kpi.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart */}
      <Card>
        <CardContent className="p-5">
          <p className="text-sm font-medium text-muted-foreground mb-3">Receita vs Comissão</p>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gFee" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#gRev)" strokeWidth={2} name="Receita" />
                <Area type="monotone" dataKey="fees" stroke="#f59e0b" fill="url(#gFee)" strokeWidth={2} name="Comissão" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="producers" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="producers"><Users className="w-4 h-4 mr-1.5" />Produtores</TabsTrigger>
          <TabsTrigger value="financial"><Wallet className="w-4 h-4 mr-1.5" />Financeiro</TabsTrigger>
          <TabsTrigger value="security"><Shield className="w-4 h-4 mr-1.5" />Segurança</TabsTrigger>
          <TabsTrigger value="logs"><Activity className="w-4 h-4 mr-1.5" />Logs & Auditoria</TabsTrigger>
          <TabsTrigger value="api-costs"><Server className="w-4 h-4 mr-1.5" />Custos APIs</TabsTrigger>
          <TabsTrigger value="users"><ShieldCheck className="w-4 h-4 mr-1.5" />Gerenciar Usuários</TabsTrigger>
        </TabsList>

        {/* ═══ PRODUCERS TAB ═══ */}
        <TabsContent value="producers">
          {selectedProducerId ? (
            /* ─── Producer Drill-down ─── */
            <div className="space-y-4">
              <Button variant="ghost" size="sm" onClick={() => setSelectedProducerId(null)} className="gap-1.5">
                <ArrowLeft className="w-4 h-4" /> Voltar para lista
              </Button>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary" />
                Dashboard de: {selectedProducer?.full_name || "Produtor"}
              </h2>

              {/* Producer KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Produtos", value: String(producerProducts.length), icon: Package },
                  { label: "Pedidos (período)", value: String(producerOrders.length), icon: ShoppingCart },
                  { label: "Receita aprovada", value: fmt(producerOrders.filter((o) => paidStatuses.has(String(o.status).toLowerCase())).reduce((s, o) => s + Number(o.amount), 0)), icon: DollarSign },
                  { label: "Pendentes", value: fmt(producerOrders.filter((o) => o.status === "pending").reduce((s, o) => s + Number(o.amount), 0)), icon: AlertTriangle },
                ].map((k, i) => (
                  <Card key={i}><CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted"><k.icon className="w-5 h-5 text-muted-foreground" /></div>
                    <div><p className="text-xs text-muted-foreground">{k.label}</p><p className="text-lg font-bold text-foreground">{k.value}</p></div>
                  </CardContent></Card>
                ))}
              </div>

              {/* Producer Products */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Produtos</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Nome</TableHead><TableHead className="text-right">Preço</TableHead><TableHead className="text-center">Ativo</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {producerProducts.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="text-right">{fmt(Number(p.price))}</TableCell>
                          <TableCell className="text-center">{p.active ? <Badge variant="default" className="text-xs">Sim</Badge> : <Badge variant="outline" className="text-xs">Não</Badge>}</TableCell>
                        </TableRow>
                      ))}
                      {producerProducts.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">Nenhum produto</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Producer Orders */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Últimos Pedidos</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>ID</TableHead><TableHead>Status</TableHead><TableHead>Método</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Data</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {producerOrders.slice(0, 20).map((o) => (
                        <TableRow key={o.id}>
                          <TableCell className="text-xs font-mono">{o.id.slice(0, 8)}</TableCell>
                          <TableCell><Badge variant={paidStatuses.has(o.status) ? "default" : o.status === "pending" ? "secondary" : "destructive"} className="text-xs">{o.status}</Badge></TableCell>
                          <TableCell className="text-xs">{o.payment_method}</TableCell>
                          <TableCell className="text-right font-semibold">{fmt(Number(o.amount))}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("pt-BR")}</TableCell>
                        </TableRow>
                      ))}
                      {producerOrders.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">Nenhum pedido no período</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          ) : (
            /* ─── Producer List ─── */
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Produtores Ativos</CardTitle>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-center">Produtos</TableHead>
                    <TableHead className="text-center">Pedidos</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                    <TableHead className="text-right">Sua Comissão</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {filteredProducers.map((p) => {
                      const isSelf = p.id === user?.id;
                      return (
                        <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedUser({ ...p, roles: isSelf ? ["super_admin"] : ["admin"], product_count: p.product_count, order_count: p.order_count, total_revenue: p.total_revenue })}>
                          <TableCell className="font-medium">
                            {p.full_name || "Sem nome"}
                            {isSelf && <Badge variant="outline" className="ml-2 text-xs">Você</Badge>}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{p.email || "—"}</TableCell>
                          <TableCell className="text-center">{p.product_count}</TableCell>
                          <TableCell className="text-center">{p.order_count}</TableCell>
                          <TableCell className="text-right font-semibold">{fmt(p.total_revenue)}</TableCell>
                          <TableCell className="text-right text-primary font-semibold">{fmt(p.total_revenue * (feePercent / 100))}</TableCell>
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-1 justify-center">
                              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setSelectedProducerId(p.id)}>
                                <Eye className="w-3 h-3" /> Ver
                              </Button>
                              {!isSelf && (
                                <>
                                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={actionLoading === "resend-" + p.email} onClick={() => handleResendInvite(p.email)}>
                                    {actionLoading === "resend-" + p.email ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Reenviar
                                  </Button>
                                  <Button size="sm" variant="destructive" className="h-7 text-xs gap-1" disabled={actionLoading === p.id} onClick={() => demoteFromAdmin(p.id)}>
                                    {actionLoading === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldX className="w-3 h-3" />} Remover
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={() => setDeleteTarget({ id: p.id, name: p.full_name || "Sem nome" })}>
                                    <Trash2 className="w-3 h-3" /> Excluir
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredProducers.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum produtor</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══ FINANCIAL TAB ═══ */}
        <TabsContent value="financial">
          <div className="space-y-4">
            {/* Monthly accumulated fees chart */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-amber-500" /> Receita da Plataforma — Taxas Acumuladas (12 meses)
                </CardTitle>
                <p className="text-xs text-muted-foreground">Taxas de R$0,99 cobradas por venda aprovada. Visão mensal acumulada.</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  {(() => {
                    const totalFees = monthlyFeesChart.reduce((s, m) => s + m.fees, 0);
                    const totalRev = monthlyFeesChart.reduce((s, m) => s + m.revenue, 0);
                    const totalCount = monthlyFeesChart.reduce((s, m) => s + m.feeCount, 0);
                    const avgMonthly = totalFees / Math.max(monthlyFeesChart.filter(m => m.fees > 0).length, 1);
                    return [
                      { label: "Total Taxas (12m)", value: fmt(totalFees), color: "text-amber-500" },
                      { label: "GMV Total (12m)", value: fmt(totalRev), color: "text-primary" },
                      { label: "Vendas Taxadas", value: String(totalCount), color: "text-foreground" },
                      { label: "Média Mensal", value: fmt(avgMonthly), color: "text-muted-foreground" },
                    ].map((kpi, i) => (
                      <div key={i} className="p-3 rounded-lg bg-muted/50 border">
                        <p className="text-xs text-muted-foreground">{kpi.label}</p>
                        <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
                      </div>
                    ));
                  })()}
                </div>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyFeesChart}>
                      <defs>
                        <linearGradient id="gMonthFee" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gMonthRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          return (
                            <div className="bg-card/95 backdrop-blur-xl border border-border rounded-lg px-4 py-2.5 shadow-xl">
                              <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
                              <p className="text-sm font-bold text-amber-500">Taxas: {fmt(payload[0]?.value as number || 0)}</p>
                              <p className="text-sm font-bold text-primary">GMV: {fmt(payload[1]?.value as number || 0)}</p>
                              <p className="text-[11px] text-muted-foreground">{payload[0]?.payload?.feeCount || 0} vendas taxadas</p>
                            </div>
                          );
                        }}
                      />
                      <Area type="monotone" dataKey="fees" stroke="#f59e0b" fill="url(#gMonthFee)" strokeWidth={2} name="Taxas" />
                      <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#gMonthRev)" strokeWidth={1.5} name="GMV" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Billing accounts overview */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-lg flex items-center gap-2"><Wallet className="w-5 h-5" /> Contas de Billing dos Produtores</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Produtor</TableHead>
                    <TableHead className="text-center">Tier</TableHead>
                    <TableHead className="text-right">Saldo Devedor</TableHead>
                    <TableHead className="text-right">Limite</TableHead>
                    <TableHead className="text-center">Cartão</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {billingAccounts.map((b) => (
                      <TableRow key={b.user_id}>
                        <TableCell className="font-medium">{b.producer_name}</TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className="text-xs uppercase">{b.credit_tier}</Badge></TableCell>
                        <TableCell className="text-right font-semibold">{fmt(b.balance)}</TableCell>
                        <TableCell className="text-right">{fmt(b.credit_limit)}</TableCell>
                        <TableCell className="text-center text-xs">{b.card_last4 ? `${b.card_brand || "•"} ****${b.card_last4}` : "—"}</TableCell>
                        <TableCell className="text-center">
                          {b.blocked
                            ? <Badge variant="destructive" className="text-xs gap-1"><Ban className="w-3 h-3" /> Bloqueado</Badge>
                            : <Badge variant="default" className="text-xs gap-1"><CheckCircle className="w-3 h-3" /> Ativo</Badge>
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                    {billingAccounts.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma conta</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Recent billing transactions */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-lg flex items-center gap-2"><CreditCard className="w-5 h-5" /> Últimas Transações de Billing</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Produtor</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {billingTxs.slice(0, 50).map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="text-sm">{tx.producer_name}</TableCell>
                        <TableCell><Badge variant={tx.type === "fee" ? "secondary" : tx.type === "payment" ? "default" : "outline"} className="text-xs">{tx.type}</Badge></TableCell>
                        <TableCell className="text-right font-semibold">{fmt(tx.amount)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{tx.description || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleString("pt-BR")}</TableCell>
                      </TableRow>
                    ))}
                    {billingTxs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma transação</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══ SECURITY TAB ═══ */}
        <TabsContent value="security">
          <div className="space-y-4">
            {/* Security Scanner */}
            <SecurityScanner
              userId={user?.id || ""}
              rateLimitHits={rateLimitHits}
              allUsers={allUsers}
              orders={orders}
              products={products}
            />

            {/* Security KPIs */}
            {(() => {
              const now = new Date();
              const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              const last24h = rateLimitHits.filter(h => new Date(h.created_at) >= todayStart);
              const blockedToday = last24h.filter(h => h.blocked);
              const totalAttemptsToday = last24h.length;

              // Top blocked IPs
              const ipCounts: Record<string, number> = {};
              blockedToday.forEach(h => { ipCounts[h.identifier] = (ipCounts[h.identifier] || 0) + 1; });
              const topIps = Object.entries(ipCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

              // By action
              const actionCounts: Record<string, { total: number; blocked: number }> = {};
              last24h.forEach(h => {
                if (!actionCounts[h.action]) actionCounts[h.action] = { total: 0, blocked: 0 };
                actionCounts[h.action].total++;
                if (h.blocked) actionCounts[h.action].blocked++;
              });

              // Recent blocked
              const recentBlocked = rateLimitHits.filter(h => h.blocked).slice(0, 50);

              return (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { icon: Shield, label: "Requisições Hoje", value: String(totalAttemptsToday), color: "text-primary" },
                      { icon: Ban, label: "Bloqueios Hoje", value: String(blockedToday.length), color: blockedToday.length > 0 ? "text-destructive" : "text-emerald-500" },
                      { icon: AlertTriangle, label: "IPs Suspeitos", value: String(topIps.length), color: topIps.length > 0 ? "text-amber-500" : "text-emerald-500" },
                      { icon: CheckCircle, label: "Taxa de Bloqueio", value: totalAttemptsToday > 0 ? `${((blockedToday.length / totalAttemptsToday) * 100).toFixed(1)}%` : "0%", color: "text-muted-foreground" },
                    ].map((kpi, i) => (
                      <Card key={i}>
                        <CardContent className="p-4 flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-muted"><kpi.icon className={`w-5 h-5 ${kpi.color}`} /></div>
                          <div>
                            <p className="text-xs text-muted-foreground">{kpi.label}</p>
                            <p className="text-lg font-bold text-foreground">{kpi.value}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* By endpoint */}
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Activity className="w-4 h-4" /> Requisições por Endpoint (Hoje)</CardTitle></CardHeader>
                    <CardContent>
                      {Object.keys(actionCounts).length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma requisição registrada hoje</p>
                      ) : (
                        <Table>
                          <TableHeader><TableRow>
                            <TableHead>Endpoint</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">Bloqueados</TableHead>
                            <TableHead className="text-right">Taxa</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {Object.entries(actionCounts).sort((a, b) => b[1].blocked - a[1].blocked).map(([action, counts]) => (
                              <TableRow key={action}>
                                <TableCell className="font-mono text-xs">{action}</TableCell>
                                <TableCell className="text-right">{counts.total}</TableCell>
                                <TableCell className="text-right">
                                  <Badge variant={counts.blocked > 0 ? "destructive" : "secondary"} className="text-xs">{counts.blocked}</Badge>
                                </TableCell>
                                <TableCell className="text-right text-xs text-muted-foreground">
                                  {counts.total > 0 ? `${((counts.blocked / counts.total) * 100).toFixed(1)}%` : "0%"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>

                  {/* Top blocked IPs */}
                  {topIps.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Ban className="w-4 h-4 text-destructive" /> IPs Mais Bloqueados (Hoje)</CardTitle></CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader><TableRow>
                            <TableHead>IP</TableHead>
                            <TableHead className="text-right">Bloqueios</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {topIps.map(([ip, count]) => (
                              <TableRow key={ip}>
                                <TableCell className="font-mono text-xs">{ip}</TableCell>
                                <TableCell className="text-right"><Badge variant="destructive" className="text-xs">{count}</Badge></TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}

                  {/* Recent blocked attempts */}
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Clock className="w-4 h-4" /> Últimos Bloqueios</CardTitle></CardHeader>
                    <CardContent>
                      {recentBlocked.length === 0 ? (
                        <div className="text-center py-8">
                          <CheckCircle className="w-10 h-10 mx-auto mb-2 text-emerald-500" />
                          <p className="text-sm text-muted-foreground">Nenhum bloqueio registrado — sistema seguro ✅</p>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader><TableRow>
                            <TableHead>Quando</TableHead>
                            <TableHead>IP / Identificador</TableHead>
                            <TableHead>Endpoint</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {recentBlocked.map((h: any) => (
                              <TableRow key={h.id}>
                                <TableCell className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</TableCell>
                                <TableCell className="font-mono text-xs">{h.identifier}</TableCell>
                                <TableCell className="text-xs"><Badge variant="outline">{h.action}</Badge></TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </>
              );
            })()}
          </div>
        </TabsContent>

        {/* ═══ LOGS & AUDIT TAB ═══ */}
        <TabsContent value="logs">
          <div className="space-y-4">
            {/* Email logs */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-lg flex items-center gap-2"><Mail className="w-5 h-5" /> Últimos Emails Enviados</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Produtor</TableHead>
                    <TableHead>Para</TableHead>
                    <TableHead>Assunto</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {emailLogs.slice(0, 30).map((e: any) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-xs">{e.producer_name}</TableCell>
                        <TableCell className="text-xs">{e.to_email}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{e.subject}</TableCell>
                        <TableCell className="text-center"><Badge variant={e.status === "delivered" ? "default" : e.status === "bounced" ? "destructive" : "secondary"} className="text-xs">{e.status}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString("pt-BR")}</TableCell>
                      </TableRow>
                    ))}
                    {emailLogs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum email</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Webhooks */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-lg flex items-center gap-2"><Webhook className="w-5 h-5" /> Webhooks Cadastrados</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>URL</TableHead>
                    <TableHead>Eventos</TableHead>
                    <TableHead className="text-center">Ativo</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {webhookEndpoints.map((w: any) => (
                      <TableRow key={w.id}>
                        <TableCell className="text-xs font-mono max-w-[300px] truncate">{w.url}</TableCell>
                        <TableCell><div className="flex gap-1 flex-wrap">{(w.events || []).map((ev: string) => <Badge key={ev} variant="outline" className="text-xs">{ev}</Badge>)}</div></TableCell>
                        <TableCell className="text-center">{w.active ? <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" /> : <Ban className="w-4 h-4 text-destructive mx-auto" />}</TableCell>
                      </TableRow>
                    ))}
                    {webhookEndpoints.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Nenhum webhook</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Platform stats summary */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-lg flex items-center gap-2"><BarChart3 className="w-5 h-5" /> Resumo da Plataforma</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><p className="text-muted-foreground">Total Usuários</p><p className="text-xl font-bold">{allUsers.length}</p></div>
                  <div><p className="text-muted-foreground">Produtores</p><p className="text-xl font-bold">{producers.length}</p></div>
                  <div><p className="text-muted-foreground">Produtos Cadastrados</p><p className="text-xl font-bold">{products.length}</p></div>
                  <div><p className="text-muted-foreground">Pedidos Totais</p><p className="text-xl font-bold">{orders.length}</p></div>
                  <div><p className="text-muted-foreground">Webhooks</p><p className="text-xl font-bold">{webhookEndpoints.length}</p></div>
                  <div><p className="text-muted-foreground">Emails Enviados</p><p className="text-xl font-bold">{emailLogs.length}</p></div>
                  <div><p className="text-muted-foreground">Contas Billing</p><p className="text-xl font-bold">{billingAccounts.length}</p></div>
                  <div><p className="text-muted-foreground">Bloqueados</p><p className="text-xl font-bold text-destructive">{billingAccounts.filter((b) => b.blocked).length}</p></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══ API COSTS TAB ═══ */}
        <TabsContent value="api-costs">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Server className="w-5 h-5" /> Todas as APIs Pagas — Controle de Custos
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Visão completa de todas as APIs que geram custo. Mantenha saldo em dia para evitar interrupções.
                </p>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Serviço</TableHead>
                      <TableHead>Função</TableHead>
                      <TableHead>Modelo de Cobrança</TableHead>
                      <TableHead className="text-center">Free Tier</TableHead>
                      <TableHead className="text-right">Custo Estimado</TableHead>
                      <TableHead className="text-center">Status Config</TableHead>
                      <TableHead>Onde Recarregar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Resend */}
                    <TableRow>
                      <TableCell className="font-medium">Resend</TableCell>
                      <TableCell className="text-xs text-muted-foreground">Envio de emails transacionais (acesso, recuperação, notificações)</TableCell>
                      <TableCell className="text-xs">Por email enviado</TableCell>
                      <TableCell className="text-center"><Badge variant="default" className="text-xs">100/dia grátis</Badge></TableCell>
                      <TableCell className="text-right text-xs">~$0.001/email após free tier<br/><span className="text-muted-foreground">({emailLogs.length} emails registrados)</span></TableCell>
                      <TableCell className="text-center"><Badge variant="default" className="text-xs gap-1"><CheckCircle className="w-3 h-3" /> Configurado</Badge></TableCell>
                      <TableCell className="text-xs"><a href="https://resend.com/overview" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">resend.com/overview</a></TableCell>
                    </TableRow>

                    {/* Asaas */}
                    <TableRow>
                      <TableCell className="font-medium">Asaas</TableCell>
                      <TableCell className="text-xs text-muted-foreground">Gateway de pagamento (PIX, cartão, boleto)</TableCell>
                      <TableCell className="text-xs">Taxa por transação aprovada</TableCell>
                      <TableCell className="text-center"><Badge variant="outline" className="text-xs">Sem free tier</Badge></TableCell>
                      <TableCell className="text-right text-xs">PIX: R$0,99/tx<br/>Cartão: 3,49% + R$0,49<br/>Boleto: R$1,99</TableCell>
                      <TableCell className="text-center"><Badge variant="default" className="text-xs gap-1"><CheckCircle className="w-3 h-3" /> Configurado</Badge></TableCell>
                      <TableCell className="text-xs"><a href="https://www.asaas.com/financial/balance" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">asaas.com/financial</a></TableCell>
                    </TableRow>

                    {/* Pagar.me */}
                    <TableRow>
                      <TableCell className="font-medium">Pagar.me</TableCell>
                      <TableCell className="text-xs text-muted-foreground">Gateway de pagamento alternativo (split/marketplace)</TableCell>
                      <TableCell className="text-xs">Taxa por transação aprovada</TableCell>
                      <TableCell className="text-center"><Badge variant="outline" className="text-xs">Sem free tier</Badge></TableCell>
                      <TableCell className="text-right text-xs">PIX: 0,99%<br/>Cartão: 3,19% + R$0,39<br/>Boleto: R$3,49</TableCell>
                      <TableCell className="text-center"><Badge variant="default" className="text-xs gap-1"><CheckCircle className="w-3 h-3" /> Configurado</Badge></TableCell>
                      <TableCell className="text-xs"><a href="https://dashboard.pagar.me" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">dashboard.pagar.me</a></TableCell>
                    </TableRow>

                    {/* Meta / Facebook CAPI */}
                    <TableRow>
                      <TableCell className="font-medium">Meta (Facebook CAPI)</TableCell>
                      <TableCell className="text-xs text-muted-foreground">Conversions API — rastreamento server-side de eventos</TableCell>
                      <TableCell className="text-xs">Gratuito (usa Meta token)</TableCell>
                      <TableCell className="text-center"><Badge variant="default" className="text-xs">100% grátis</Badge></TableCell>
                      <TableCell className="text-right text-xs">$0 — sem custo direto<br/><span className="text-muted-foreground">(custo está no Ad Spend)</span></TableCell>
                      <TableCell className="text-center"><Badge variant="default" className="text-xs gap-1"><CheckCircle className="w-3 h-3" /> Configurado</Badge></TableCell>
                      <TableCell className="text-xs"><a href="https://business.facebook.com/settings" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">business.facebook.com</a></TableCell>
                    </TableRow>

                    {/* OneSignal */}
                    <TableRow>
                      <TableCell className="font-medium">OneSignal</TableCell>
                      <TableCell className="text-xs text-muted-foreground">Push notifications web/mobile para clientes</TableCell>
                      <TableCell className="text-xs">Por subscriber ativo/mês</TableCell>
                      <TableCell className="text-center"><Badge variant="default" className="text-xs">10K subs grátis</Badge></TableCell>
                      <TableCell className="text-right text-xs">Free: até 10K subs<br/>Growth: a partir de $9/mês</TableCell>
                      <TableCell className="text-center"><Badge variant="default" className="text-xs gap-1"><CheckCircle className="w-3 h-3" /> Configurado</Badge></TableCell>
                      <TableCell className="text-xs"><a href="https://dashboard.onesignal.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">dashboard.onesignal.com</a></TableCell>
                    </TableRow>

                    {/* PushAlert */}
                    <TableRow>
                      <TableCell className="font-medium">PushAlert</TableCell>
                      <TableCell className="text-xs text-muted-foreground">Push notifications alternativo</TableCell>
                      <TableCell className="text-xs">Por subscriber/mês</TableCell>
                      <TableCell className="text-center"><Badge variant="default" className="text-xs">3K subs grátis</Badge></TableCell>
                      <TableCell className="text-right text-xs">Free: até 3K subs<br/>Business: $12/mês</TableCell>
                      <TableCell className="text-center"><Badge variant="default" className="text-xs gap-1"><CheckCircle className="w-3 h-3" /> Configurado</Badge></TableCell>
                      <TableCell className="text-xs"><a href="https://pushalert.co/dashboard" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">pushalert.co/dashboard</a></TableCell>
                    </TableRow>

                    {/* Cloudflare Turnstile */}
                    <TableRow>
                      <TableCell className="font-medium">Cloudflare Turnstile</TableCell>
                      <TableCell className="text-xs text-muted-foreground">Captcha anti-bot no login e checkout</TableCell>
                      <TableCell className="text-xs">Gratuito ilimitado</TableCell>
                      <TableCell className="text-center"><Badge variant="default" className="text-xs">Ilimitado grátis</Badge></TableCell>
                      <TableCell className="text-right text-xs">$0 — sempre gratuito</TableCell>
                      <TableCell className="text-center"><Badge variant="default" className="text-xs gap-1"><CheckCircle className="w-3 h-3" /> Configurado</Badge></TableCell>
                      <TableCell className="text-xs"><a href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">dash.cloudflare.com</a></TableCell>
                    </TableRow>

                    {/* Lovable AI */}
                    <TableRow>
                      <TableCell className="font-medium">Lovable AI</TableCell>
                      <TableCell className="text-xs text-muted-foreground">Geração de copy de emails com IA</TableCell>
                      <TableCell className="text-xs">Incluso no plano Lovable</TableCell>
                      <TableCell className="text-center"><Badge variant="default" className="text-xs">Incluso</Badge></TableCell>
                      <TableCell className="text-right text-xs">$0 — incluso no plano</TableCell>
                      <TableCell className="text-center"><Badge variant="default" className="text-xs gap-1"><CheckCircle className="w-3 h-3" /> Configurado</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">Gerenciado automaticamente</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Resumo de custos */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">💡 Resumo Rápido de Custos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <p className="text-xs text-muted-foreground font-medium mb-1">🟢 APIs Gratuitas (sem custo)</p>
                    <ul className="text-xs space-y-0.5 text-foreground">
                      <li>• Meta CAPI — sempre grátis</li>
                      <li>• Cloudflare Turnstile — sempre grátis</li>
                      <li>• Lovable AI — incluso no plano</li>
                    </ul>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <p className="text-xs text-muted-foreground font-medium mb-1">🟡 APIs com Free Tier (monitorar)</p>
                    <ul className="text-xs space-y-0.5 text-foreground">
                      <li>• Resend — 100 emails/dia grátis</li>
                      <li>• OneSignal — 10K subscribers grátis</li>
                      <li>• PushAlert — 3K subscribers grátis</li>
                    </ul>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <p className="text-xs text-muted-foreground font-medium mb-1">🔴 APIs Pagas (custo por transação)</p>
                    <ul className="text-xs space-y-0.5 text-foreground">
                      <li>• Asaas — taxa por venda aprovada</li>
                      <li>• Pagar.me — taxa por venda aprovada</li>
                      <li className="text-muted-foreground italic">Custo coberto pelo split do produtor</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══ USERS TAB ═══ */}
        <TabsContent value="users">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-lg">Todos os Usuários</CardTitle>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-9 gap-1.5 text-xs font-semibold" onClick={() => { setAddType("collaborator"); setShowAddProducer(true); }}>
                    <UserPlus className="w-4 h-4" /> Adicionar Colaborador
                  </Button>
                  <Button size="sm" className="h-9 gap-1.5 text-xs font-semibold" onClick={() => { setAddType("admin"); setShowAddProducer(true); }}>
                    <UserPlus className="w-4 h-4" /> Adicionar Produtor
                  </Button>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Buscar..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="pl-9 h-9" />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead className="text-center">Telefone</TableHead>
                  <TableHead className="text-center">Cadastro</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => {
                    const isSelf = u.id === user?.id;
                    const isAdmin = u.roles.includes("admin");
                    const isSA = u.roles.includes("super_admin");
                    const isCollab = u.roles.includes("collaborator");
                    return (
                      <TableRow key={u.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedUser(u)}>
                        <TableCell className="font-medium">
                          {u.full_name || "Sem nome"}
                          {isSelf && <Badge variant="outline" className="ml-2 text-xs">Você</Badge>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{u.email || "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {u.roles.map((r) => (
                              <Badge key={r} variant={r === "super_admin" ? "default" : r === "admin" ? "secondary" : "outline"} className="text-xs">
                                {r === "super_admin" ? "Super Admin" : r === "admin" ? "Produtor" : r === "collaborator" ? "Colaborador" : "Comprador"}
                              </Badge>
                            ))}
                            {u.roles.length === 0 && <Badge variant="outline" className="text-xs">Sem role</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">{u.phone || "—"}</TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          {isSelf || isSA ? null : (
                            <div className="flex gap-2 justify-center">
                              {isAdmin ? (
                                <Button size="sm" variant="destructive" className="h-7 text-xs gap-1" disabled={actionLoading === u.id} onClick={() => demoteFromAdmin(u.id)}>
                                  {actionLoading === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldX className="w-3 h-3" />} Rebaixar
                                </Button>
                              ) : (
                                <Button size="sm" variant="default" className="h-7 text-xs gap-1" disabled={actionLoading === u.id} onClick={() => promoteToAdmin(u.id)}>
                                  {actionLoading === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />} Promover Produtor
                                </Button>
                              )}

                              {isCollab ? (
                                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={actionLoading === u.id} onClick={async () => {
                                  setActionLoading(u.id);
                                  await supabase.from("user_roles").delete().eq("user_id", u.id).eq("role", "collaborator" as any);
                                  toast.success("Acesso colaborador removido!");
                                  await loadAll();
                                  setActionLoading(null);
                                }}>
                                  Remover Colaborador
                                </Button>
                              ) : (
                                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={actionLoading === u.id} onClick={async () => {
                                  setActionLoading(u.id);
                                  await supabase.from("user_roles").insert({ user_id: u.id, role: "collaborator" as any });
                                  toast.success("Promovido a Colaborador!");
                                  await loadAll();
                                  setActionLoading(null);
                                }}>
                                  Promover Colaborador
                                </Button>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredUsers.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum usuário</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Producer Dialog */}
      <Dialog open={showAddProducer} onOpenChange={setShowAddProducer}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" /> 
              Adicionar {addType === "admin" ? "Produtor" : "Colaborador"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nome completo</Label>
              <Input value={newProducer.full_name} onChange={(e) => setNewProducer(p => ({ ...p, full_name: e.target.value }))} placeholder="Ex: João Silva" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Email</Label>
              <Input type="email" value={newProducer.email} onChange={(e) => setNewProducer(p => ({ ...p, email: e.target.value }))} placeholder="usuario@email.com" className="h-9" />
            </div>
            <Button onClick={() => handleCreateUser()} disabled={actionLoading === "new-producer"} className="w-full gap-2">
              {actionLoading === "new-producer" ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              {actionLoading === "new-producer" ? "Enviando convite..." : "Enviar Convite"}
            </Button>
            <p className="text-[10px] text-muted-foreground text-center">O {addType === "admin" ? "produtor" : "colaborador"} receberá um email com link para definir a própria senha e acessar o painel.</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Producer Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produtor permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os dados de <strong>{deleteTarget?.name}</strong> serão excluídos permanentemente: produtos, pedidos, cursos, alunos, configurações e conta. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={actionLoading === deleteTarget?.id}
              onClick={() => deleteTarget && handleDeleteProducer(deleteTarget.id)}
            >
              {actionLoading === deleteTarget?.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* User Detail Modal */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              Detalhes do Usuário
            </DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Nome</p>
                  <p className="text-sm font-semibold text-foreground">{selectedUser.full_name || "Sem nome"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Email</p>
                  <p className="text-sm text-foreground">{selectedUser.email || "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Telefone</p>
                  <p className="text-sm text-foreground">{selectedUser.phone || "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">CPF</p>
                  <p className="text-sm text-foreground">{selectedUser.cpf || "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Cadastro</p>
                  <p className="text-sm text-foreground">{new Date(selectedUser.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Roles</p>
                  <div className="flex gap-1 flex-wrap">
                    {selectedUser.roles.map((r) => (
                      <Badge key={r} variant={r === "super_admin" ? "default" : r === "admin" ? "secondary" : "outline"} className="text-xs">
                        {r === "super_admin" ? "Super Admin" : r === "admin" ? "Produtor" : "Comprador"}
                      </Badge>
                    ))}
                    {selectedUser.roles.length === 0 && <Badge variant="outline" className="text-xs">Sem role</Badge>}
                  </div>
                </div>
              </div>

              {/* Producer-specific stats */}
              {(selectedUser.product_count != null || selectedUser.order_count != null || selectedUser.total_revenue != null) && (
                <div className="border-t pt-3 mt-3">
                  <p className="text-xs text-muted-foreground font-medium mb-2">Estatísticas do Produtor</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-2 rounded-lg bg-muted/50 text-center">
                      <p className="text-lg font-bold text-foreground">{selectedUser.product_count ?? 0}</p>
                      <p className="text-[10px] text-muted-foreground">Produtos</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50 text-center">
                      <p className="text-lg font-bold text-foreground">{selectedUser.order_count ?? 0}</p>
                      <p className="text-[10px] text-muted-foreground">Pedidos</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50 text-center">
                      <p className="text-lg font-bold text-foreground">{fmt(selectedUser.total_revenue ?? 0)}</p>
                      <p className="text-[10px] text-muted-foreground">Receita</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t">
                {selectedUser.roles.includes("admin") && selectedUser.id !== user?.id && (
                  <>
                    <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => { setSelectedProducerId(selectedUser.id); setSelectedUser(null); }}>
                      <Eye className="w-3 h-3" /> Ver Dashboard
                    </Button>
                    <Button size="sm" variant="destructive" className="gap-1 text-xs" onClick={() => { setDeleteTarget({ id: selectedUser.id, name: selectedUser.full_name || "Sem nome" }); setSelectedUser(null); }}>
                      <Trash2 className="w-3 h-3" /> Excluir
                    </Button>
                  </>
                )}
              </div>

              <p className="text-[10px] text-muted-foreground font-mono">ID: {selectedUser.id}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminDashboard;
