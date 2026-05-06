// @ts-nocheck
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Wallet, ArrowUpRight, ArrowDownLeft, Users, Ban, CheckCircle, Settings2, Save, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

interface TierRow {
  id: string;
  key: string;
  label: string;
  credit_limit: number;
  level: number;
  color: string;
}

interface BillingAccount {
  id: string;
  user_id: string;
  balance: number;
  credit_tier: string;
  credit_limit: number;
  blocked: boolean;
  card_last4: string | null;
  card_brand: string | null;
  created_at: string;
  full_name?: string;
  monthly_sales?: number;
}

interface BillingTransaction {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  description: string | null;
  order_id: string | null;
  created_at: string;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const Billing = () => {
  const { user, isSuperAdmin, loading: authLoading } = useAuth();
  const [accounts, setAccounts] = useState<BillingAccount[]>([]);
  const [transactions, setTransactions] = useState<BillingTransaction[]>([]);
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [editingTiers, setEditingTiers] = useState<TierRow[]>([]);
  const [showTierEditor, setShowTierEditor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [savingTiers, setSavingTiers] = useState(false);

  useEffect(() => {
    if (!user?.id || !isSuperAdmin) return;
    loadTiers();
    loadAccounts();
  }, [user?.id, isSuperAdmin]);

  useEffect(() => {
    if (selectedUserId) loadTransactions(selectedUserId);
  }, [selectedUserId]);

  const loadTiers = async () => {
    const { data } = await supabase
      .from("billing_tiers")
      .select("*")
      .order("level", { ascending: true });
    const rows = (data || []) as unknown as TierRow[];
    setTiers(rows);
    setEditingTiers(rows.map((t) => ({ ...t })));
  };

  const loadAccounts = async () => {
    setLoading(true);
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "super_admin"]);

    const adminUserIds = [...new Set((roles || []).map((r: any) => r.user_id))];
    if (adminUserIds.length === 0) { setAccounts([]); setLoading(false); return; }

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [{ data: accs }, { data: profiles }, { data: monthlyOrders }] = await Promise.all([
      supabase.from("billing_accounts").select("*").in("user_id", adminUserIds),
      supabase.from("profiles").select("id, full_name").in("id", adminUserIds),
      supabase.from("orders").select("user_id, amount").in("user_id", adminUserIds)
        .in("status", ["paid", "approved"])
        .gte("created_at", monthStart.toISOString()),
    ]);

    const billingMap = new Map((accs || []).map((a: any) => [a.user_id, a]));
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name]));
    const salesMap = new Map<string, number>();
    (monthlyOrders || []).forEach((o: any) => {
      salesMap.set(o.user_id, (salesMap.get(o.user_id) || 0) + Number(o.amount));
    });

    const merged: BillingAccount[] = adminUserIds.map((uid) => {
      const billing = billingMap.get(uid);
      return {
        id: billing?.id || uid,
        user_id: uid,
        balance: billing?.balance ?? 0,
        credit_tier: billing?.credit_tier ?? "iron",
        credit_limit: billing?.credit_limit ?? 5,
        blocked: billing?.blocked ?? false,
        card_last4: billing?.card_last4 ?? null,
        card_brand: billing?.card_brand ?? null,
        created_at: billing?.created_at ?? new Date().toISOString(),
        full_name: profileMap.get(uid) || "Sem nome",
        monthly_sales: salesMap.get(uid) || 0,
      };
    });

    merged.sort((a, b) => b.balance - a.balance);
    setAccounts(merged);
    setLoading(false);
  };

  const loadTransactions = async (userId: string) => {
    const { data } = await supabase
      .from("billing_transactions").select("*").eq("user_id", userId)
      .order("created_at", { ascending: false }).limit(50);
    setTransactions((data as unknown as BillingTransaction[]) || []);
  };

  const tierMap = Object.fromEntries(tiers.map((t) => [t.key, t]));

  const ensureBillingAccount = async (userId: string) => {
    await supabase.from("billing_accounts").upsert(
      { user_id: userId },
      { onConflict: "user_id", ignoreDuplicates: true }
    );
  };

  const handleChangeTier = async (_accountId: string, userId: string, newTier: string) => {
    const t = tierMap[newTier];
    const newLimit = t?.credit_limit || 5;
    await ensureBillingAccount(userId);
    const { error } = await supabase
      .from("billing_accounts")
      .update({ credit_tier: newTier, credit_limit: newLimit, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) toast.error("Erro ao alterar tier");
    else { 
      toast.success(`Tier alterado para ${t?.label || newTier}`); 
      
      // Notify GatFlow about the plan change if applicable
      try {
        await supabase.functions.invoke("gatflow-billing-webhook", {
          body: { 
            user_id: userId, 
            plan_name: t?.label || newTier,
            status: "active"
          }
        });
      } catch (webhookErr) {
        console.error("GatFlow webhook notification failed:", webhookErr);
      }
      
      loadAccounts(); 
    }
  };

  const handleToggleBlock = async (_accountId: string, userId: string, blocked: boolean) => {
    await ensureBillingAccount(userId);
    const { error } = await supabase
      .from("billing_accounts")
      .update({ blocked: !blocked, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) toast.error("Erro");
    else { toast.success(blocked ? "Desbloqueado" : "Bloqueado"); loadAccounts(); }
  };

  const handleResetBalance = async (_accountId: string, userId: string) => {
    if (!confirm("Zerar o saldo devedor deste produtor?")) return;
    const account = accounts.find((a) => a.user_id === userId);
    if (!account || account.balance <= 0) return;
    await ensureBillingAccount(userId);
    await supabase.from("billing_transactions").insert({
      user_id: userId, type: "credit", amount: -account.balance,
      description: "Saldo zerado pelo Super Admin",
    });
    await supabase.from("billing_accounts")
      .update({ balance: 0, blocked: false, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    toast.success("Saldo zerado");
    loadAccounts();
    if (selectedUserId === userId) loadTransactions(userId);
  };

  const handleSaveTiers = async () => {
    setSavingTiers(true);
    for (const t of editingTiers) {
      await supabase.from("billing_tiers")
        .update({ label: t.label, credit_limit: t.credit_limit, updated_at: new Date().toISOString() })
        .eq("id", t.id);
    }
    toast.success("Tiers atualizados!");
    await loadTiers();
    setSavingTiers(false);
    setShowTierEditor(false);
  };

  if (authLoading) return null;
  if (!isSuperAdmin) return <Navigate to="/admin" replace />;

  const totalOwed = accounts.reduce((s, a) => s + Math.max(a.balance, 0), 0);
  const totalMonthlySales = accounts.reduce((s, a) => s + (a.monthly_sales || 0), 0);
  const blockedCount = accounts.filter((a) => a.blocked).length;
  const selectedAccount = accounts.find((a) => a.user_id === selectedUserId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground">Billing — Gestão de Produtores</h1>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowTierEditor(!showTierEditor)}>
          <Settings2 className="w-4 h-4" /> {showTierEditor ? "Fechar Tiers" : "Editar Tiers"}
        </Button>
      </div>

      {/* Tier Editor */}
      {showTierEditor && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Configuração dos Níveis de Crédito</CardTitle>
            <CardDescription>Edite os nomes e limites de cada tier. Os produtores verão essas mudanças automaticamente.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {editingTiers.map((t, i) => (
                <div key={t.id} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-6">{t.level}</span>
                  <Input
                    className="w-32 h-8 text-sm"
                    value={t.label}
                    onChange={(e) => {
                      const copy = [...editingTiers];
                      copy[i] = { ...copy[i], label: e.target.value };
                      setEditingTiers(copy);
                    }}
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">R$</span>
                    <Input
                      className="w-24 h-8 text-sm"
                      type="number"
                      value={t.credit_limit}
                      onChange={(e) => {
                        const copy = [...editingTiers];
                        copy[i] = { ...copy[i], credit_limit: parseFloat(e.target.value) || 0 };
                        setEditingTiers(copy);
                      }}
                    />
                  </div>
                </div>
              ))}
              <Button size="sm" className="gap-2 mt-2" onClick={handleSaveTiers} disabled={savingTiers}>
                <Save className="w-4 h-4" /> {savingTiers ? "Salvando..." : "Salvar Tiers"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Vendas do Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{fmt(totalMonthlySales)}</p>
            <p className="text-xs text-muted-foreground mt-1">Total aprovado no mês atual</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="w-4 h-4" /> Total a Receber
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{fmt(totalOwed)}</p>
            <p className="text-xs text-muted-foreground mt-1">Taxas acumuladas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4" /> Produtores
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold text-foreground">{accounts.length}</p></CardContent>
        </Card>
        <Card className={blockedCount > 0 ? "border-destructive/50" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Ban className="w-4 h-4" /> Bloqueados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${blockedCount > 0 ? "text-destructive" : "text-foreground"}`}>{blockedCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Accounts Table */}
      <Card>
        <CardHeader><CardTitle className="text-base">Contas de Billing</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>
          ) : accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum produtor encontrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produtor</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Vendas Mês</TableHead>
                  <TableHead className="text-right">Saldo Devedor</TableHead>
                  <TableHead className="text-right">Limite</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((acc) => {
                  const usagePercent = acc.credit_limit > 0 ? Math.min(100, (acc.balance / acc.credit_limit) * 100) : 0;
                  return (
                    <TableRow key={acc.user_id} className={`cursor-pointer ${selectedUserId === acc.user_id ? "bg-muted/50" : ""}`}
                      onClick={() => setSelectedUserId(acc.user_id)}>
                      <TableCell>
                        <p className="font-medium text-sm text-foreground">{acc.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{acc.user_id}</p>
                      </TableCell>
                      <TableCell>
                        <Select value={acc.credit_tier} onValueChange={(v) => handleChangeTier(acc.id, acc.user_id, v)}>
                          <SelectTrigger className="w-[110px] h-8 text-xs" onClick={(e) => e.stopPropagation()}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {tiers.map((t) => (
                              <SelectItem key={t.key} value={t.key}>{t.label} ({fmt(t.credit_limit)})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium text-primary">{fmt(acc.monthly_sales || 0)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={acc.balance > acc.credit_limit ? "text-destructive font-bold" : "font-medium"}>{fmt(acc.balance)}</span>
                        <div className="w-full h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                          <div className={`h-full rounded-full ${usagePercent > 80 ? "bg-destructive" : usagePercent > 50 ? "bg-yellow-500" : "bg-primary"}`}
                            style={{ width: `${usagePercent}%` }} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{fmt(acc.credit_limit)}</TableCell>
                      <TableCell>
                        {acc.blocked ? (
                          <Badge variant="destructive" className="gap-1"><Ban className="w-3 h-3" /> Bloqueado</Badge>
                        ) : (
                          <Badge variant="default" className="gap-1"><CheckCircle className="w-3 h-3" /> Ativo</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="outline" size="sm" className="text-xs h-7"
                            onClick={() => handleToggleBlock(acc.id, acc.user_id, acc.blocked)}>
                            {acc.blocked ? "Desbloquear" : "Bloquear"}
                          </Button>
                          <Button variant="ghost" size="sm" className="text-xs h-7"
                            onClick={() => handleResetBalance(acc.id, acc.user_id)}>Zerar</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Transactions */}
      {selectedAccount && (
        <Card>
          <CardHeader><CardTitle className="text-base">Transações — {selectedAccount.full_name}</CardTitle></CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma transação.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <Badge variant={tx.type === "fee" ? "secondary" : "default"} className="gap-1">
                          {tx.type === "fee" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                          {tx.type === "fee" ? "Taxa" : "Crédito"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">{tx.description || "-"}</TableCell>
                      <TableCell className={`text-right font-medium ${tx.type === "fee" ? "text-destructive" : "text-primary"}`}>
                        {tx.type === "fee" ? "+" : "-"}{fmt(Math.abs(tx.amount))}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {new Date(tx.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Billing;
