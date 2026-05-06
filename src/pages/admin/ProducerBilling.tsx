// @ts-nocheck
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  CreditCard, Loader2, ClipboardCopy, CheckCircle2, Zap, TrendingUp,
  Wallet, DollarSign, Plus, Receipt, ExternalLink, Globe,
} from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import CardPreview3D, { type CardPreviewFocus } from "@/components/ui/card-preview-3d";

// ── Types ──────────────────────────────────────────
interface TierRow { key: string; label: string; credit_limit: number; level: number; color: string; }
interface BillingAccount {
  id: string; balance: number; credit_tier: string; credit_limit: number; blocked: boolean;
  card_last4: string | null; card_brand: string | null;
  auto_recharge_enabled: boolean; auto_recharge_amount: number; auto_recharge_threshold: number;
}
interface BillingTransaction { id: string; type: string; amount: number; description: string | null; created_at: string; }

// ── Helpers ────────────────────────────────────────
const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const toSales = (reais: number) => Math.max(0, Math.floor(reais / 0.99));
const formatCardNumber = (v: string) => v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
const formatCpf = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};
const getErrorMessage = (error: unknown, fallback: string): string => {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message || fallback;
  if (Array.isArray(error)) return error.map((i) => getErrorMessage(i, "")).filter(Boolean).join(" ") || fallback;
  if (typeof error === "object") {
    const r = error as Record<string, unknown>;
    return getErrorMessage(r.description ?? r.message ?? r.error, "") || Object.values(r).map((v) => getErrorMessage(v, "")).filter(Boolean).join(" ") || fallback;
  }
  return fallback;
};

const TIER_META: Record<string, { title: string }> = {
  iron: { title: "Iron" }, bronze: { title: "Bronze" }, silver: { title: "Silver" },
  gold: { title: "Gold" }, platinum: { title: "Platinum" }, diamond: { title: "Diamond" },
};

const RECHARGE_AMOUNTS = [
  { value: 10, sales: "10" },
  { value: 20, sales: "20" },
  { value: 50, sales: "50" },
  { value: 100, sales: "101" },
];

// ── Component ──────────────────────────────────────
const ProducerBilling = () => {
  const { user } = useAuth();
  const [account, setAccount] = useState<BillingAccount | null>(null);
  const [transactions, setTransactions] = useState<BillingTransaction[]>([]);
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [totalRevenue, setTotalRevenue] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [pixAmount, setPixAmount] = useState(50);
  const [pixLoading, setPixLoading] = useState(false);
  const [pixResult, setPixResult] = useState<{ pix_code: string | null; qr_code_url: string | null; amount: number } | null>(null);
  const [copying, setCopying] = useState(false);
  const [cardAmount, setCardAmount] = useState(50);
  const [cardLoading, setCardLoading] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [showPixModal, setShowPixModal] = useState(false);
  const [showTierPanel, setShowTierPanel] = useState(false);
  const [cardValidating, setCardValidating] = useState(false);
  const [cardForm, setCardForm] = useState({ number: "", name: "", expiryMonth: "", expiryYear: "", cvv: "", cpf: "" });
  const [cardFocus, setCardFocus] = useState<CardPreviewFocus>(null);

  useEffect(() => { if (user?.id) loadData(); }, [user?.id]);

  const loadData = async () => {
    setLoading(true);
    const [{ data: accs }, { data: txs }, { data: tierData }, { data: revenueData }] = await Promise.all([
      supabase.from("billing_accounts").select("id, balance, credit_tier, credit_limit, blocked, card_last4, card_brand, auto_recharge_enabled, auto_recharge_amount, auto_recharge_threshold, user_id").eq("user_id", user!.id).limit(1),
      supabase.from("billing_transactions").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("billing_tiers").select("*").order("level", { ascending: true }),
      supabase.rpc("get_revenue_summary", { p_user_id: user!.id }),
    ]);
    setAccount((accs?.[0] as unknown as BillingAccount) ?? null);
    setTransactions((txs as unknown as BillingTransaction[]) ?? []);
    setTiers((tierData as unknown as TierRow[]) ?? []);
    const rev = Array.isArray(revenueData) ? revenueData[0] : revenueData;
    setTotalRevenue(Number(rev?.total_revenue ?? 0));
    setLoading(false);
  };

  // ── Handlers ──
  const handleValidateCard = async () => {
    if (!cardForm.number || !cardForm.name || !cardForm.expiryMonth || !cardForm.expiryYear || !cardForm.cvv || !cardForm.cpf) {
      toast.error("Preencha todos os campos"); return;
    }
    setCardValidating(true);
    try {
      const { data, error } = await supabase.functions.invoke('billing-validate-card', {
        body: { card_number: cardForm.number.replace(/\s/g, ''), card_name: cardForm.name, card_expiry_month: cardForm.expiryMonth, card_expiry_year: cardForm.expiryYear, card_cvv: cardForm.cvv, card_cpf: cardForm.cpf.replace(/\D/g, '') },
      });
      const fe = (data as any)?.error;
      if (error || fe || !data?.success) throw new Error(getErrorMessage(fe ?? error, 'Erro ao validar'));
      toast.success(`Cartão •••• ${data.card_last4} validado!`);
      await supabase.from("billing_accounts").update({ auto_recharge_enabled: true }).eq("user_id", user!.id);
      setShowCardModal(false);
      setCardForm({ number: "", name: "", expiryMonth: "", expiryYear: "", cvv: "", cpf: "" });
      loadData();
    } catch (err: unknown) { toast.error(getErrorMessage(err, 'Erro ao validar')); }
    finally { setCardValidating(false); }
  };

  const handleChargeCard = async () => {
    setCardLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('billing-recharge', { body: { amount: cardAmount, method: 'card' } });
      const fe = (data as any)?.error;
      if (error || fe || !data?.success) {
        if ((data as any)?.needs_card) { setShowCardModal(true); return; }
        throw new Error(getErrorMessage(fe ?? error, 'Erro'));
      }
      toast.success(`+${toSales(cardAmount)} vendas adicionadas!`);
      loadData();
    } catch (err: unknown) { toast.error(getErrorMessage(err, 'Erro')); }
    finally { setCardLoading(false); }
  };

  const handleToggleAutoRecharge = async (enabled: boolean) => {
    if (!account) return;
    if (enabled && !account.card_last4) { toast.error("Cadastre um cartão primeiro"); setShowCardModal(true); return; }
    try {
      const { error } = await supabase.from("billing_accounts").update({ auto_recharge_enabled: enabled }).eq("user_id", user!.id);
      if (error) throw error;
      toast.success(enabled ? "Cobrança automática ativada" : "Cobrança automática desativada");
      loadData();
    } catch { toast.error("Erro ao salvar"); }
  };

  const handleUpdateAutoRecharge = async (field: string, value: number) => {
    try {
      const { error } = await supabase.from("billing_accounts").update({ [field]: value }).eq("user_id", user!.id);
      if (error) throw error; loadData();
    } catch { toast.error("Erro ao salvar"); }
  };

  const handleGeneratePix = async () => {
    setPixLoading(true); setPixResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('billing-recharge', { body: { amount: pixAmount, method: 'pix' } });
      const fe = (data as any)?.error;
      if (error || fe || !data?.success) throw new Error(getErrorMessage(fe ?? error, 'Erro'));
      setPixResult(data); toast.success('QR Code gerado!');
    } catch (err: unknown) { toast.error(getErrorMessage(err, 'Erro')); }
    finally { setPixLoading(false); }
  };

  const handleCopyPix = async () => {
    if (!pixResult?.pix_code) return;
    setCopying(true);
    try { await navigator.clipboard.writeText(pixResult.pix_code); toast.success('Copiado!'); }
    catch { toast.error('Erro ao copiar'); }
    finally { setTimeout(() => setCopying(false), 2000); }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  // ── Derived state ──
  const balance = account?.balance ?? 0;
  const creditLimit = account?.credit_limit ?? 5;
  const hasCard = !!account?.card_last4;
  const currentTierKey = account?.credit_tier ?? "iron";
  const tierMeta = TIER_META[currentTierKey] ?? TIER_META.iron;

  // Credit usage (how much of the limit is consumed)
  const usedCredit = Math.max(0, -balance); // negative balance = debt
  const toleranceLimit = creditLimit * 1.15; // 15% tolerance
  const usagePercent = toleranceLimit > 0 ? Math.min(100, (usedCredit / toleranceLimit) * 100) : 0;

  // Fees accumulated (total fees this period)
  const totalFees = transactions.filter(t => t.type === "fee").reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const inputClass = "h-11 bg-background border-border text-foreground placeholder:text-muted-foreground rounded-lg focus:border-primary focus:ring-primary";

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Billing</h1>
          <p className="text-sm text-muted-foreground">Gerencie suas taxas e pagamentos</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => setShowPixModal(true)}>
          <Plus className="w-4 h-4" /> Adicionar Crédito
        </Button>
      </div>

      {/* ── Platform Fees Info ── */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-background to-background border border-primary/20 p-8 shadow-2xl group hover:border-primary/40 transition-all duration-500">
        <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
          <Zap className="w-48 h-48 text-primary" />
        </div>
        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0 shadow-[0_0_30px_rgba(var(--primary),0.3)] transform group-hover:scale-110 transition-transform duration-500">
            <Globe className="w-10 h-10 text-white" />
          </div>
          <div className="space-y-3 flex-1 text-center md:text-left">
            <h3 className="text-2xl font-black text-foreground tracking-tight">Taxas da Plataforma</h3>
            <p className="text-base text-muted-foreground leading-relaxed max-w-2xl font-medium">
              Nossa taxa é transparente e focada no seu crescimento. Cobramos apenas <span className="text-primary font-bold">R$ 0,99 fixo</span> sobre cada venda aprovada. 
              Sem porcentagens abusivas, sem mensalidades e sem surpresas.
            </p>
          </div>
          <Button variant="outline" className="border-primary/30 hover:bg-primary/10 hover:border-primary/60 px-6 h-12 rounded-xl font-bold transition-all" asChild>
            <a href="https://ajuda.plataforma.com" target="_blank" rel="noreferrer">
              Ver mais detalhes
              <ExternalLink className="ml-2 w-4 h-4" />
            </a>
          </Button>
        </div>
      </section>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Taxas a Pagar */}
        <Card className="border border-white/10 bg-card/40 backdrop-blur-md hover:border-destructive/30 transition-all duration-300 overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-destructive/5 blur-3xl -mr-8 -mt-8 group-hover:bg-destructive/10 transition-colors" />
          <CardContent className="pt-6 pb-6 relative z-10">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Taxas a Pagar</p>
                <p className="text-3xl font-black tabular-nums text-foreground">{fmt(Math.max(0, -balance))}</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <Badge variant="outline" className="text-[10px] bg-destructive/5 text-destructive border-destructive/20 py-0">Aguardando</Badge>
                  <span className="text-[10px] text-muted-foreground">Acumuladas no período</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Crédito Disponível */}
        <Card className="border border-white/10 bg-card/40 backdrop-blur-md hover:border-primary/30 transition-all duration-300 overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 blur-3xl -mr-8 -mt-8 group-hover:bg-primary/10 transition-colors" />
          <CardContent className="pt-6 pb-6 relative z-10">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Crédito Disponível</p>
                <p className={`text-3xl font-black tabular-nums ${balance >= 0 ? "text-primary shadow-[0_0_20px_rgba(var(--primary),0.1)]" : "text-destructive"}`}>
                  {fmt(Math.max(0, balance))}
                </p>
                <div className="flex items-center gap-1.5 mt-2">
                  <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20 py-0">Pré-pago</Badge>
                  <span className="text-[10px] text-muted-foreground">Saldo via PIX/Cartão</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Nível de Crédito */}
        <Card className="border border-white/10 bg-card/40 backdrop-blur-md hover:border-amber-500/30 transition-all duration-300 overflow-hidden relative group cursor-pointer" onClick={() => setShowTierPanel(!showTierPanel)}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 blur-3xl -mr-8 -mt-8 group-hover:bg-amber-500/10 transition-colors" />
          <CardContent className="pt-6 pb-6 relative z-10">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Nível de Crédito</p>
                <p className="text-3xl font-black text-foreground">{tierMeta.title}</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <Badge variant="outline" className="text-[10px] bg-amber-500/5 text-amber-500 border-amber-500/20 py-0">Limite: {fmt(creditLimit)}</Badge>
                  <span className="text-[10px] text-muted-foreground">Clique para detalhes</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Main Content + Tier Panel side by side ── */}
      <div className={`grid gap-4 ${showTierPanel ? "grid-cols-1 lg:grid-cols-[1fr_320px]" : "grid-cols-1"}`}>
        {/* Left: Credit Usage + Tabs + History */}
        <div className="space-y-6">
          {/* Sales Available Bar */}
          <Card className="border border-white/10 bg-card/40 backdrop-blur-md overflow-hidden relative group">
            <CardContent className="pt-6 pb-6 relative z-10">
              <div className="flex items-start justify-between mb-4">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-foreground flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    Vendas Disponíveis
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {balance > 0
                      ? `Você possui aproximadamente ~${toSales(balance)} vendas garantidas com seu saldo pré-pago.`
                      : usedCredit < toleranceLimit
                        ? `Atenção: ~${toSales(toleranceLimit - usedCredit)} vendas restantes antes do bloqueio do checkout.`
                        : "Limite crítico atingido — o checkout foi pausado para evitar pendências."
                    }
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="text-[10px] border-primary/20 bg-primary/5 text-primary">
                    {usagePercent.toFixed(0)}% Utilizado
                  </Badge>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Limite: {fmt(creditLimit)}
                  </p>
                </div>
              </div>
              
              <div className="relative h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                <div 
                  className={`absolute top-0 left-0 h-full transition-all duration-1000 ease-out rounded-full ${
                    usagePercent > 90 ? "bg-destructive shadow-[0_0_10px_rgba(var(--destructive),0.5)]" : 
                    usagePercent > 70 ? "bg-amber-500 shadow-[0_0_10px_rgba(var(--amber-500),0.3)]" : 
                    "bg-primary shadow-[0_0_10px_rgba(var(--primary),0.3)]"
                  }`}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>

              <div className="flex justify-between mt-3 items-center">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Uso: <span className="text-foreground">{fmt(usedCredit)}</span>
                </p>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Capacidade: <span className="text-foreground">{fmt(creditLimit)}</span>
                </p>
              </div>
            </CardContent>
          </Card>

      {/* ── Cartão / PIX Tabs ── */}
      <Tabs defaultValue="card" className="w-full">
        <TabsList className="w-auto bg-white/5 border border-white/10 p-1 rounded-xl mb-6">
          <TabsTrigger value="card" className="gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-300">
            <CreditCard className="w-4 h-4" /> Cartão de Crédito
          </TabsTrigger>
          <TabsTrigger value="pix" className="gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-300">
            <DollarSign className="w-4 h-4" /> Recarga via PIX
          </TabsTrigger>
        </TabsList>

        {/* ── Card Tab ── */}
        <TabsContent value="card">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cartão de Crédito</CardTitle>
              <CardDescription>Cartão para cobrança automática de taxas</CardDescription>
            </CardHeader>
            <CardContent>
              {hasCard ? (
                <div className="space-y-5">
                  {/* Card info */}
                  <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border border-border">
                    <CreditCard className="w-8 h-8 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        {account?.card_brand?.toUpperCase()} •••• {account?.card_last4}
                      </p>
                      <p className="text-xs text-muted-foreground">Cartão cadastrado</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setShowCardModal(true)}>Trocar</Button>
                  </div>

                  {/* Auto recharge */}
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Cobrança automática</p>
                      <p className="text-xs text-muted-foreground">
                        {account?.auto_recharge_enabled
                          ? `Cobra ${fmt(account?.auto_recharge_amount ?? 50)} quando saldo ≤ ${fmt(account?.auto_recharge_threshold ?? 5)}`
                          : "Ative para nunca parar de vender"
                        }
                      </p>
                    </div>
                    <Switch
                      checked={!!account?.auto_recharge_enabled}
                      onCheckedChange={handleToggleAutoRecharge}
                    />
                  </div>

                  {account?.auto_recharge_enabled && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Cobrar quando saldo atingir</p>
                        <div className="flex gap-2 flex-wrap">
                          {[3, 5, 10, 20].map((v) => (
                            <button
                              key={v}
                              onClick={() => handleUpdateAutoRecharge('auto_recharge_threshold', v)}
                              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                account?.auto_recharge_threshold === v
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted/50 border border-border text-foreground hover:bg-muted"
                              }`}
                            >
                              {fmt(v)}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Valor da recarga</p>
                        <div className="flex gap-2 flex-wrap">
                          {[20, 50, 100, 200].map((v) => (
                            <button
                              key={v}
                              onClick={() => handleUpdateAutoRecharge('auto_recharge_amount', v)}
                              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                account?.auto_recharge_amount === v
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted/50 border border-border text-foreground hover:bg-muted"
                              }`}
                            >
                              {fmt(v)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Quick charge */}
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs font-medium text-muted-foreground mb-3">Recarga rápida no cartão</p>
                    <div className="flex gap-2 items-center">
                      {[20, 50, 100, 200].map((v) => (
                        <button
                          key={v}
                          onClick={() => setCardAmount(v)}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            cardAmount === v
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted/50 border border-border text-foreground hover:bg-muted"
                          }`}
                        >
                          {fmt(v)}
                        </button>
                      ))}
                      <Button size="sm" className="ml-auto gap-1.5" onClick={handleChargeCard} disabled={cardLoading}>
                        {cardLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                        Recarregar
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CreditCard className="w-10 h-10 text-muted-foreground/40 mb-4" />
                  <p className="text-sm text-muted-foreground mb-4">Nenhum cartão cadastrado</p>
                  <Button variant="outline" onClick={() => setShowCardModal(true)}>Adicionar Cartão</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── PIX Tab ── */}
        <TabsContent value="pix">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recarga via PIX</CardTitle>
              <CardDescription>Adicione créditos pré-pagos instantaneamente</CardDescription>
            </CardHeader>
            <CardContent>
              {!pixResult ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {RECHARGE_AMOUNTS.map(({ value, sales }) => (
                      <button
                        key={value}
                        onClick={() => setPixAmount(value)}
                        className={`p-4 rounded-lg text-center transition-colors ${
                          pixAmount === value
                            ? "bg-primary/10 border-2 border-primary"
                            : "bg-muted/30 border border-border hover:border-primary/30"
                        }`}
                      >
                        <p className={`text-xl font-bold ${pixAmount === value ? "text-primary" : "text-foreground"}`}>
                          {fmt(value)}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">~{sales} vendas</p>
                      </button>
                    ))}
                  </div>
                  <Button className="w-full font-semibold" onClick={handleGeneratePix} disabled={pixLoading}>
                    {pixLoading
                      ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Gerando...</>
                      : <>Gerar PIX · {fmt(pixAmount)}</>
                    }
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 py-4">
                  {pixResult.qr_code_url && (
                    <div className="p-3 bg-white rounded-xl">
                      <img src={pixResult.qr_code_url} alt="QR Code PIX" className="w-44 h-44 rounded" />
                    </div>
                  )}
                  <div className="text-center">
                    <p className="text-xl font-bold text-foreground">{fmt(pixResult.amount)}</p>
                    <p className="text-xs text-muted-foreground mt-1">~{toSales(pixResult.amount)} vendas · Creditado em até 1 min</p>
                  </div>
                  {pixResult.pix_code && (
                    <Button variant="outline" className="w-full gap-2 font-semibold" onClick={handleCopyPix}>
                      {copying
                        ? <><CheckCircle2 className="w-4 h-4 text-primary" /> Copiado!</>
                        : <><ClipboardCopy className="w-4 h-4" /> Copiar código PIX</>
                      }
                    </Button>
                  )}
                  <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setPixResult(null)}>
                    Gerar novo código
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Histórico de Faturas ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de Faturas</CardTitle>
          <CardDescription>Suas faturas de cobrança de taxas</CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <DollarSign className="w-10 h-10 text-muted-foreground/40 mb-4" />
              <p className="text-sm text-muted-foreground">Nenhuma fatura encontrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Tipo</TableHead>
                  <TableHead className="text-xs">Descrição</TableHead>
                  <TableHead className="text-xs text-right">Valor</TableHead>
                  <TableHead className="text-xs text-right">Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="py-3">
                      <Badge variant={tx.type === "fee" ? "secondary" : "default"} className="text-[10px]">
                        {tx.type === "fee" ? "Taxa" : "Crédito"}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3">
                      <span className="text-xs text-muted-foreground truncate block max-w-[300px]">
                        {tx.description || "—"}
                      </span>
                    </TableCell>
                    <TableCell className={`py-3 text-right text-xs font-semibold tabular-nums ${
                      tx.type === "fee" ? "text-destructive" : "text-primary"
                    }`}>
                      {tx.type === "fee" ? "-" : "+"}{fmt(Math.abs(tx.amount))}
                    </TableCell>
                    <TableCell className="py-3 text-right text-xs text-muted-foreground">
                      {new Date(tx.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
        </div>{/* end left column */}

        {/* Tier Panel — right column */}
        {showTierPanel && tiers.length > 0 && (
          <Card className="h-fit">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <p className="text-sm font-semibold text-foreground">Níveis de Crédito</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Seu limite aumenta conforme você mantém os pagamentos em dia</p>
                </div>
                <p className="text-xs text-muted-foreground shrink-0 text-right">
                  Atualizado em<br />{new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <div className="space-y-2 mt-4">
                {tiers.map((t) => {
                  const isCurrent = t.key === currentTierKey;
                  const currentIdx = tiers.findIndex((x) => x.key === currentTierKey);
                  const tIdx = tiers.findIndex((x) => x.key === t.key);
                  const isPast = tIdx < currentIdx;

                  const paidCount = transactions.filter(tx => tx.type === "credit").length;
                  const thresholds = [0, 2, 5, 10, 15, 20];
                  const neededRecharges = thresholds[tIdx] ?? 0;
                  const remaining = Math.max(0, neededRecharges - paidCount);

                  return (
                    <div
                      key={t.key}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        isCurrent ? "border-primary/30 bg-primary/5" : "border-border/50 bg-transparent"
                      }`}
                    >
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        isCurrent ? "bg-primary text-primary-foreground" :
                        isPast ? "bg-primary/20 text-primary" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {t.level}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold ${isCurrent ? "text-foreground" : isPast ? "text-muted-foreground" : "text-muted-foreground/60"}`}>
                            {TIER_META[t.key]?.title ?? t.label}
                          </span>
                          {isCurrent && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">Atual</Badge>
                          )}
                        </div>
                        {!isCurrent && !isPast && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {remaining > 0 ? `Faltam ${fmt(remaining * 50)} em taxas` : `Nível ${t.level}`}
                          </p>
                        )}
                      </div>
                      <span className={`text-sm font-semibold tabular-nums shrink-0 ${
                        isCurrent ? "text-foreground" : "text-muted-foreground"
                      }`}>
                        {fmt(t.credit_limit)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>{/* end grid */}

      {/* ── MODAL: CARD ── */}
      <Dialog open={showCardModal} onOpenChange={setShowCardModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Adicionar Cartão</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Validação de R$ 5,00 estornada imediatamente
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <CardPreview3D
              number={cardForm.number}
              holder={cardForm.name}
              month={cardForm.expiryMonth}
              year={cardForm.expiryYear}
              cvv={cardForm.cvv}
              focus={cardFocus}
            />
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Número do cartão</label>
              <Input value={cardForm.number} onChange={(e) => setCardForm({ ...cardForm, number: formatCardNumber(e.target.value) })}
                onFocus={() => setCardFocus("number")} onBlur={() => setCardFocus(null)}
                placeholder="0000 0000 0000 0000" className={`${inputClass} font-mono`} maxLength={19} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nome no cartão</label>
              <Input value={cardForm.name} onChange={(e) => setCardForm({ ...cardForm, name: e.target.value.toUpperCase() })}
                onFocus={() => setCardFocus("holder")} onBlur={() => setCardFocus(null)}
                placeholder="COMO ESTÁ NO CARTÃO" className={inputClass} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Mês</label>
                <Input value={cardForm.expiryMonth} onChange={(e) => setCardForm({ ...cardForm, expiryMonth: e.target.value.replace(/\D/g, '').slice(0, 2) })}
                  onFocus={() => setCardFocus("expire")} onBlur={() => setCardFocus(null)}
                  placeholder="MM" className={inputClass} maxLength={2} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Ano</label>
                <Input value={cardForm.expiryYear} onChange={(e) => setCardForm({ ...cardForm, expiryYear: e.target.value.replace(/\D/g, '').slice(0, 2) })}
                  onFocus={() => setCardFocus("expire")} onBlur={() => setCardFocus(null)}
                  placeholder="AA" className={inputClass} maxLength={2} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">CVV</label>
                <Input value={cardForm.cvv} onChange={(e) => setCardForm({ ...cardForm, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  onFocus={() => setCardFocus("cvv")} onBlur={() => setCardFocus(null)}
                  placeholder="123" className={inputClass} maxLength={4} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">CPF do titular</label>
              <Input value={cardForm.cpf} onChange={(e) => setCardForm({ ...cardForm, cpf: formatCpf(e.target.value) })}
                placeholder="000.000.000-00" className={inputClass} maxLength={14} />
            </div>
            <Button className="w-full gap-2 font-semibold" onClick={handleValidateCard} disabled={cardValidating}>
              {cardValidating ? <><Loader2 className="w-4 h-4 animate-spin" /> Validando...</> : <><CreditCard className="w-4 h-4" /> Adicionar Cartão</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: PIX ── */}
      <Dialog open={showPixModal} onOpenChange={setShowPixModal}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Wallet className="w-6 h-6 text-primary" />
            </div>
            <DialogHeader className="text-center">
              <DialogTitle className="text-lg font-bold text-center">Adicionar Crédito</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground text-center">
                Adicione saldo pré-pago via PIX para abater das suas taxas
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-5 mt-4">
            {/* Quick amount chips */}
            <div className="flex flex-wrap gap-2 justify-center">
              {[10, 20, 50, 100].map((v) => (
                <button
                  key={v}
                  onClick={() => setPixAmount(v)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                    pixAmount === v
                      ? "bg-foreground text-background border-foreground"
                      : "bg-transparent border-border text-muted-foreground hover:border-foreground/50"
                  }`}
                >
                  {fmt(v)}
                </button>
              ))}
            </div>

            {/* Custom value stepper */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Valor personalizado</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPixAmount(Math.max(10, pixAmount - 5))}
                  className="w-10 h-10 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors"
                >
                  −
                </button>
                <div className="flex-1 flex items-center gap-2 bg-muted/30 rounded-lg border border-border px-4 h-10">
                  <span className="text-xs text-muted-foreground">R$</span>
                  <Input
                    type="number"
                    value={pixAmount}
                    onChange={(e) => setPixAmount(Math.max(10, Number(e.target.value) || 10))}
                    className="border-0 bg-transparent text-center text-lg font-bold text-foreground p-0 h-auto focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <button
                  onClick={() => setPixAmount(pixAmount + 5)}
                  className="w-10 h-10 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors"
                >
                  +
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground text-center mt-1.5">Mínimo: {fmt(creditLimit * 0.65)}</p>
            </div>

            {/* Benefits box */}
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-inner relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-12 h-12 bg-primary/10 rounded-full blur-xl group-hover:bg-primary/20 transition-colors" />
              <p className="text-xs font-bold text-primary mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Vantagens do crédito pré-pago:
              </p>
              <ul className="space-y-2">
                <li className="text-[11px] text-muted-foreground flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-primary/40" />
                  Taxas são debitadas automaticamente de cada venda
                </li>
                <li className="text-[11px] text-muted-foreground flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-primary/40" />
                  Evite bloqueios no checkout por pendências financeiras
                </li>
                <li className="text-[11px] text-muted-foreground flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-primary/40" />
                  Sem mensalidades ou surpresas na fatura
                </li>
              </ul>
            </div>

            {/* Generate button */}
            <Button className="w-full font-semibold gap-2" onClick={() => { setShowPixModal(false); handleGeneratePix(); }} disabled={pixLoading}>
              {pixLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
              Gerar PIX de {fmt(pixAmount)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProducerBilling;
