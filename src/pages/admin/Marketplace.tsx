import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, ShoppingCart, CreditCard, Phone, User, Clock, CheckCircle2,
  Trophy, Target, Copy, MessageCircle, ChevronRight, Sparkles, Flame,
  Undo2, Search, Link2, AlertTriangle, Repeat,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Opportunity {
  type: "pix" | "abandoned_cart";
  reference_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  amount: number;
  created_at: string;
  product_name: string | null;
  product_id: string | null;
  is_hot: boolean;
  customer_purchases_count: number;
}

interface Recovery {
  id: string;
  type: "pix" | "abandoned_cart";
  reference_id: string;
  status: string;
  claimed_at: string;
  contacted_at: string | null;
  closed_at: string | null;
  outcome: string | null;
  notes: string | null;
  orders?: any;
  abandoned_carts?: any;
}

const OUTCOMES = [
  { value: "recovered", label: "Recuperado (cliente pagou)", tone: "text-emerald-600" },
  { value: "no_response", label: "Sem resposta do cliente", tone: "text-muted-foreground" },
  { value: "refused", label: "Cliente recusou", tone: "text-orange-600" },
  { value: "lost", label: "Lead perdido / inválido", tone: "text-red-600" },
];

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  claimed: { label: "Em negociação", className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  contacted: { label: "Contato feito", className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  recovered: { label: "Recuperado", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  no_response: { label: "Sem resposta", className: "bg-muted text-muted-foreground border-border" },
  refused: { label: "Recusado", className: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
  lost: { label: "Perdido", className: "bg-red-500/10 text-red-600 border-red-500/20" },
};

const PUBLIC_BASE = "https://app.panttera.com.br";

function formatBRL(v: number) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function onlyDigits(s?: string | null) {
  return (s || "").replace(/\D/g, "");
}
function buildTrackingLink(rec: Recovery, collaboratorId: string): string {
  // Link único do colaborador: garante atribuição da comissão
  const isPix = rec.type === "pix";
  const details: any = isPix ? rec.orders : rec.abandoned_carts;
  const productId = details?.product_id;
  let url: string;
  if (isPix) {
    // PIX pendente: cliente abre receipt do pedido para pagar
    url = `${PUBLIC_BASE}/receipt/${rec.reference_id}`;
  } else {
    // Carrinho: volta para checkout do produto
    url = details?.checkout_url || `${PUBLIC_BASE}/checkout/${productId}`;
  }
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}col=${collaboratorId}&rid=${rec.id}`;
}
function buildWaMessage(name: string, link: string, productName: string): string {
  const first = (name || "").split(" ")[0] || "tudo bem";
  return encodeURIComponent(
    `Oi ${first}! 👋 Vi que você se interessou por *${productName}* mas não finalizou. ` +
    `Posso te ajudar a concluir agora? Aqui está o link direto: ${link}`
  );
}

export default function Marketplace() {
  const { user } = useAuth();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [active, setActive] = useState<Recovery[]>([]);
  const [closed, setClosed] = useState<Recovery[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState<Recovery | null>(null);
  const [releaseOpen, setReleaseOpen] = useState<Recovery | null>(null);

  // filtros
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "pix" | "abandoned_cart">("all");
  const [sortBy, setSortBy] = useState<"hot" | "value" | "recent">("hot");

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const [oppRes, mineRes] = await Promise.all([
        supabase.from("unclaimed_opportunities" as any).select("*"),
        supabase
          .from("recovery_opportunities")
          .select("*, orders:order_id(*, customers(*), products(name)), abandoned_carts:abandoned_cart_id(*, products(name))")
          .eq("collaborator_id", user.id)
          .order("claimed_at", { ascending: false }),
      ]);

      if (oppRes.error) throw oppRes.error;
      if (mineRes.error) throw mineRes.error;

      setOpportunities((oppRes.data as any) || []);
      const all = (mineRes.data as any) || [];
      setActive(all.filter((r: Recovery) => ["claimed", "contacted"].includes(r.status)));
      setClosed(all.filter((r: Recovery) => !["claimed", "contacted"].includes(r.status)));
    } catch (err) {
      console.error("[Marketplace]", err);
      toast.error("Erro ao carregar Marketplace");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetchData();
    const channel = supabase
      .channel("marketplace-recovery")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recovery_opportunities" },
        () => fetchData(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchData]);

  const claim = async (opp: Opportunity) => {
    if (!user) return;
    setClaiming(opp.reference_id);
    try {
      const { error } = await supabase.from("recovery_opportunities").insert({
        type: opp.type,
        reference_id: opp.reference_id,
        collaborator_id: user.id,
        status: "claimed",
      });
      if (error) {
        if (error.code === "23505") {
          toast.error("Outro colaborador pegou esse lead primeiro!");
          fetchData();
        } else throw error;
      } else {
        toast.success("Lead atribuído a você! Boa sorte 🚀");
        setOpportunities((prev) => prev.filter((o) => o.reference_id !== opp.reference_id));
        fetchData();
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao pegar lead");
    } finally {
      setClaiming(null);
    }
  };

  const markContacted = async (rec: Recovery) => {
    const { error } = await supabase
      .from("recovery_opportunities")
      .update({ status: "contacted", contacted_at: new Date().toISOString() })
      .eq("id", rec.id);
    if (error) toast.error("Erro ao atualizar");
    else { toast.success("Marcado como contatado"); fetchData(); }
  };

  const releaseLead = async (rec: Recovery, reason: string) => {
    const { data, error } = await supabase.rpc("release_recovery" as any, {
      p_recovery_id: rec.id,
      p_reason: reason || null,
    });
    if (error) { toast.error("Erro ao devolver lead"); return false; }
    const result = data as any;
    if (!result?.ok) {
      toast.error(result?.message || "Não foi possível devolver");
      return false;
    }
    toast.success("Lead devolvido ao Marketplace");
    fetchData();
    return true;
  };

  // Filtros aplicados
  const filteredOpps = useMemo(() => {
    let list = [...opportunities];
    if (typeFilter !== "all") list = list.filter((o) => o.type === typeFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((o) =>
        (o.customer_name || "").toLowerCase().includes(q) ||
        (o.customer_phone || "").includes(q) ||
        (o.product_name || "").toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      if (sortBy === "value") return Number(b.amount) - Number(a.amount);
      if (sortBy === "recent") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      // hot: quentes primeiro, depois por valor
      if (a.is_hot !== b.is_hot) return a.is_hot ? -1 : 1;
      return Number(b.amount) - Number(a.amount);
    });
    return list;
  }, [opportunities, typeFilter, search, sortBy]);

  const totalRecovered = closed.filter((r) => r.outcome === "recovered").length;
  const totalActive = active.length;
  const totalAttempts = closed.length + totalActive;
  const conversionRate = totalAttempts > 0 ? Math.round((totalRecovered / totalAttempts) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary mb-1">
          <Sparkles className="w-3.5 h-3.5" /> Gincana de Vendas
        </div>
        <h1 className="text-3xl font-bold">Marketplace de Recuperação</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Pegue um lead, fale com o cliente usando <strong>seu link único</strong> e ganhe comissão. Quem pega primeiro, leva.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Target className="w-4 h-4" />} label="Disponíveis" value={opportunities.length} accent="text-orange-600" />
        <StatCard icon={<Clock className="w-4 h-4" />} label="Em negociação" value={totalActive} accent="text-amber-600" />
        <StatCard icon={<Trophy className="w-4 h-4" />} label="Recuperados" value={totalRecovered} accent="text-emerald-600" />
        <StatCard icon={<CheckCircle2 className="w-4 h-4" />} label="Conversão" value={`${conversionRate}%`} accent="text-primary" />
      </div>

      <Tabs defaultValue="available" className="space-y-4">
        <TabsList className="bg-muted/40 p-1 rounded-xl border border-border/50">
          <TabsTrigger value="available" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Target className="w-4 h-4" /> Disponíveis
            <Badge variant="secondary" className="ml-1">{opportunities.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="active" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Clock className="w-4 h-4" /> Meus em aberto
            <Badge variant="secondary" className="ml-1">{active.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <CheckCircle2 className="w-4 h-4" /> Histórico
            <Badge variant="secondary" className="ml-1">{closed.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* DISPONÍVEIS */}
        <TabsContent value="available" className="space-y-3">
          {/* Filtros */}
          <Card className="p-3">
            <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Buscar por cliente, telefone ou produto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
                <SelectTrigger className="md:w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="pix">Apenas PIX</SelectItem>
                  <SelectItem value="abandoned_cart">Apenas Carrinho</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger className="md:w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hot">🔥 Quentes primeiro</SelectItem>
                  <SelectItem value="value">💰 Maior valor</SelectItem>
                  <SelectItem value="recent">⏱️ Mais recentes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>

          {loading ? (
            <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>
          ) : filteredOpps.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="w-12 h-12 text-emerald-500/40" />}
              title={opportunities.length === 0 ? "Nenhum lead disponível agora" : "Nenhum lead bate com seu filtro"}
              description={opportunities.length === 0
                ? "Volte em alguns minutos — novos PIX e carrinhos aparecem aqui em tempo real."
                : "Tente limpar a busca ou trocar o tipo de lead."}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredOpps.map((opp) => (
                <OpportunityCard
                  key={`${opp.type}-${opp.reference_id}`}
                  opp={opp}
                  claiming={claiming === opp.reference_id}
                  onClaim={() => claim(opp)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* MEUS EM ABERTO */}
        <TabsContent value="active" className="space-y-3">
          {active.length === 0 ? (
            <EmptyState
              icon={<Target className="w-12 h-12 text-muted-foreground/40" />}
              title="Você não tem leads em aberto"
              description="Vá na aba Disponíveis e pegue uma oportunidade para começar."
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {active.map((rec) => (
                <ActiveRecoveryCard
                  key={rec.id}
                  rec={rec}
                  collaboratorId={user!.id}
                  onContact={() => markContacted(rec)}
                  onReport={() => setReportOpen(rec)}
                  onRelease={() => setReleaseOpen(rec)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* HISTÓRICO */}
        <TabsContent value="history" className="space-y-3">
          {closed.length === 0 ? (
            <EmptyState
              icon={<Trophy className="w-12 h-12 text-muted-foreground/40" />}
              title="Sem histórico ainda"
              description="Após reportar resultados dos seus leads, eles aparecem aqui."
            />
          ) : (
            <Card className="overflow-hidden">
              <div className="divide-y">
                {closed.map((rec) => <HistoryRow key={rec.id} rec={rec} />)}
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <ReportDialog
        recovery={reportOpen}
        onClose={() => setReportOpen(null)}
        onSaved={() => { setReportOpen(null); fetchData(); }}
      />
      <ReleaseDialog
        recovery={releaseOpen}
        onClose={() => setReleaseOpen(null)}
        onConfirm={async (reason) => {
          if (!releaseOpen) return;
          const ok = await releaseLead(releaseOpen, reason);
          if (ok) setReleaseOpen(null);
        }}
      />
    </div>
  );
}

/* ───── Subcomponents ───── */

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string | number; accent: string; }) {
  return (
    <Card className="p-4">
      <div className={`flex items-center gap-2 text-xs font-medium ${accent}`}>{icon}{label}</div>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </Card>
  );
}

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string; }) {
  return (
    <Card className="p-12 text-center">
      <div className="flex justify-center mb-3">{icon}</div>
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
    </Card>
  );
}

function OpportunityCard({ opp, claiming, onClaim }: { opp: Opportunity; claiming: boolean; onClaim: () => void; }) {
  const isPix = opp.type === "pix";
  return (
    <Card className={`p-4 hover:shadow-lg transition-all hover:-translate-y-0.5 border-l-4 ${opp.is_hot ? "border-l-red-500" : "border-l-orange-500/60"}`}>
      <div className="flex justify-between items-start mb-3 gap-2">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className={isPix ? "bg-blue-500/10 text-blue-600 border-blue-500/20" : "bg-orange-500/10 text-orange-600 border-orange-500/20"}>
            {isPix ? <CreditCard className="w-3 h-3 mr-1" /> : <ShoppingCart className="w-3 h-3 mr-1" />}
            {isPix ? "PIX" : "Carrinho"}
          </Badge>
          {opp.is_hot && (
            <Badge className="bg-red-500/10 text-red-600 border-red-500/20" variant="outline">
              <Flame className="w-3 h-3 mr-1" /> Quente
            </Badge>
          )}
          {opp.customer_purchases_count > 0 && (
            <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20">
              <Repeat className="w-3 h-3 mr-1" /> Cliente {opp.customer_purchases_count}x
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDistanceToNow(new Date(opp.created_at), { addSuffix: true, locale: ptBR })}
        </span>
      </div>

      <p className="font-semibold truncate text-sm">{opp.product_name || "Produto"}</p>
      <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-1">
        <User className="w-3 h-3" /> {opp.customer_name || "Cliente"}
      </p>
      <p className="text-2xl font-bold text-emerald-600 mt-2">{formatBRL(Number(opp.amount))}</p>

      <Button className="w-full mt-3" onClick={onClaim} disabled={claiming}>
        {claiming ? <Loader2 className="w-4 h-4 animate-spin" /> : (<>Pegar este lead <ChevronRight className="w-4 h-4 ml-1" /></>)}
      </Button>
    </Card>
  );
}

function ActiveRecoveryCard({ rec, collaboratorId, onContact, onReport, onRelease }: {
  rec: Recovery; collaboratorId: string;
  onContact: () => void; onReport: () => void; onRelease: () => void;
}) {
  const isPix = rec.type === "pix";
  const details: any = isPix ? rec.orders : rec.abandoned_carts;
  const customerName = isPix ? details?.customers?.name : details?.customer_name;
  const customerPhone = isPix ? details?.customers?.phone : details?.customer_phone;
  const customerEmail = isPix ? details?.customers?.email : details?.customer_email;
  const amount = isPix ? details?.amount : details?.product_price;
  const productName = details?.products?.name || "Produto";
  const status = STATUS_LABEL[rec.status] || STATUS_LABEL.claimed;

  const trackingLink = buildTrackingLink(rec, collaboratorId);
  const phone = onlyDigits(customerPhone);
  const waPhone = phone ? (phone.startsWith("55") ? phone : "55" + phone) : null;
  const waMessage = buildWaMessage(customerName || "", trackingLink, productName);
  const waLink = waPhone ? `https://wa.me/${waPhone}?text=${waMessage}` : null;

  const copyLink = () => {
    navigator.clipboard.writeText(trackingLink);
    toast.success("Link copiado! Use SOMENTE este para receber comissão.");
  };

  return (
    <Card className="p-5 border-l-4 border-l-primary">
      <div className="flex items-start justify-between mb-3 gap-2">
        <div>
          <Badge variant="outline" className={status.className}>{status.label}</Badge>
          <p className="font-semibold mt-2">{productName}</p>
          <p className="text-2xl font-bold text-emerald-600">{formatBRL(Number(amount || 0))}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs text-muted-foreground">
            Pego {formatDistanceToNow(new Date(rec.claimed_at), { addSuffix: true, locale: ptBR })}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={onRelease}
            title="Devolver lead ao Marketplace"
          >
            <Undo2 className="w-3 h-3 mr-1" /> Devolver
          </Button>
        </div>
      </div>

      <div className="space-y-1.5 text-sm border-t pt-3 mb-3">
        <p className="flex items-center gap-2"><User className="w-4 h-4 text-muted-foreground" /> {customerName || "—"}</p>
        <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" /> {customerPhone || "—"}</p>
        {customerEmail && <p className="text-xs text-muted-foreground truncate">{customerEmail}</p>}
      </div>

      {/* Bloco do link rastreado — DESTAQUE MÁXIMO */}
      <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3 mb-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-2">
          <Link2 className="w-3.5 h-3.5" /> SEU LINK DE RECUPERAÇÃO (use só este)
        </div>
        <div className="flex items-center gap-2 bg-background rounded-md border border-border/60 px-2 py-1.5">
          <code className="text-xs flex-1 truncate font-mono">{trackingLink}</code>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={copyLink}>
            <Copy className="w-3.5 h-3.5" />
          </Button>
        </div>
        <p className="flex items-start gap-1 text-[11px] text-amber-600 mt-2">
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
          Vendas feitas fora deste link <strong>não geram comissão</strong>.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {waLink && (
          <Button asChild size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
            <a href={waLink} target="_blank" rel="noreferrer">
              <MessageCircle className="w-4 h-4 mr-1" /> WhatsApp c/ msg pronta
            </a>
          </Button>
        )}
        <Button size="sm" variant="outline" className="flex-1" onClick={copyLink}>
          <Copy className="w-4 h-4 mr-1" /> Copiar link
        </Button>
      </div>

      <div className="flex gap-2 mt-2">
        {rec.status === "claimed" && (
          <Button size="sm" variant="ghost" className="flex-1" onClick={onContact}>
            ✓ Marcar contato feito
          </Button>
        )}
        <Button size="sm" variant="default" className="flex-1" onClick={onReport}>
          📊 Prestar contas
        </Button>
      </div>
    </Card>
  );
}

function HistoryRow({ rec }: { rec: Recovery }) {
  const status = STATUS_LABEL[rec.status] || STATUS_LABEL.lost;
  const isPix = rec.type === "pix";
  const details: any = isPix ? rec.orders : rec.abandoned_carts;
  const amount = isPix ? details?.amount : details?.product_price;
  const customerName = isPix ? details?.customers?.name : details?.customer_name;
  const productName = details?.products?.name || "Produto";

  return (
    <div className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors">
      <Badge variant="outline" className={status.className + " shrink-0"}>{status.label}</Badge>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-sm">{productName}</p>
        <p className="text-xs text-muted-foreground truncate">{customerName || "—"}</p>
      </div>
      <p className="font-bold text-emerald-600 text-sm shrink-0">{formatBRL(Number(amount || 0))}</p>
      <span className="text-xs text-muted-foreground shrink-0 hidden md:block">
        {rec.closed_at && formatDistanceToNow(new Date(rec.closed_at), { addSuffix: true, locale: ptBR })}
      </span>
    </div>
  );
}

function ReportDialog({ recovery, onClose, onSaved }: { recovery: Recovery | null; onClose: () => void; onSaved: () => void; }) {
  const [outcome, setOutcome] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (recovery) {
      setOutcome(recovery.outcome || "");
      setNotes(recovery.notes || "");
    }
  }, [recovery]);

  const submit = async () => {
    if (!recovery) return;
    if (!outcome) { toast.error("Escolha o resultado"); return; }
    setSaving(true);
    const { error } = await supabase
      .from("recovery_opportunities")
      .update({
        status: outcome,
        outcome,
        notes: notes || null,
        closed_at: new Date().toISOString(),
      })
      .eq("id", recovery.id);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success(outcome === "recovered" ? "Parabéns! Venda recuperada 🎉" : "Resultado registrado");
    onSaved();
  };

  return (
    <Dialog open={!!recovery} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Prestar contas do lead</DialogTitle>
          <DialogDescription>
            Informe o desfecho da abordagem. Isso ajuda a equipe e mede sua conversão.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Resultado</Label>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger><SelectValue placeholder="Escolha o resultado..." /></SelectTrigger>
              <SelectContent>
                {OUTCOMES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    <span className={o.tone}>{o.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Observações (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="O que aconteceu? Algo que a equipe deva saber?"
              rows={3}
            />
          </div>
          {outcome === "recovered" && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm">
              <Trophy className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <p>Quando o pagamento for confirmado, sua comissão será creditada em <strong>Minhas Comissões</strong>.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar prestação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReleaseDialog({ recovery, onClose, onConfirm }: {
  recovery: Recovery | null;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (recovery) setReason(""); }, [recovery]);

  const handle = async () => {
    setSubmitting(true);
    await onConfirm(reason);
    setSubmitting(false);
  };

  return (
    <Dialog open={!!recovery} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="w-5 h-5" /> Devolver lead ao Marketplace
          </DialogTitle>
          <DialogDescription>
            O lead volta para a lista pública e qualquer colaborador poderá pegar.
            <br />
            <span className="text-xs text-muted-foreground">
              Limite: 3 devoluções a cada 24h por colaborador.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Label>Motivo (opcional)</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: peguei sem querer, cliente fora do meu perfil..."
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" onClick={handle} disabled={submitting}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Devolver lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
