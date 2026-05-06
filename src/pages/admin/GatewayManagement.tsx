import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Settings2, Trash2, ArrowRightLeft, CreditCard, 
  ShieldCheck, Zap, Globe, Plus, AlertCircle, Info,
  ExternalLink, ChevronRight, Activity, LayoutDashboard
} from "lucide-react";
import { toast } from "sonner";
import GatewayFormDialog from "@/components/admin/GatewayFormDialog";
import IntegrationWebhookGuide from "@/components/admin/IntegrationWebhookGuide";
import type { GatewayConfig } from "@/pages/admin/Gateways";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const providerLabels: Record<string, string> = {
  asaas: "Asaas",
  pagarme: "Pagar.me",
  mercadopago: "Mercado Pago",
  stripe: "Stripe",
};

interface CatalogItem {
  id: string;
  provider: "asaas" | "pagarme" | "mercadopago" | "stripe";
  name: string;
  description: string;
  color: string;
  initials: string;
  badge?: string;
}

const catalog: CatalogItem[] = [
  { id: "as", provider: "asaas", name: "Asaas", description: "Pagamentos via PIX e Cartão de Crédito com integração simplificada e alta taxa de aprovação.", color: "#0066FF", initials: "As" },
  { id: "pg", provider: "pagarme", name: "Pagar.me", description: "Plataforma completa com suporte a PIX, cartão e boleto. Recomendado para grandes volumes.", color: "#55C157", initials: "Pg", badge: "Recomendado" },
  { id: "mp", provider: "mercadopago", name: "Mercado Pago", description: "Líder na América Latina. Ideal para quem já usa o ecossistema Mercado Livre.", color: "#009EE3", initials: "MP" },
  { id: "st", provider: "stripe", name: "Stripe", description: "A melhor infraestrutura global. Perfeito para vendas internacionais e segurança extrema.", color: "#635BFF", initials: "S" },
];

const defaultConfigs: Record<string, Record<string, any>> = {
  asaas: { pix_fee_percent: 0, pix_fee_fixed: 0.44, pix_validity_days: 1, pix_timer_minutes: 30, debit_fee_percent: 1.89, debit_fee_fixed: 0.35, credit_fee_1x: 2.99, credit_fee_2_6x: 2.99, credit_fee_7_12x: 2.99, credit_fee_13_21x: 4.29, credit_processing_fee: 0.44, max_installments: 12, min_installment_value: 5, free_installments: 1, interest_rate_initial: 6.58, interest_rate_incremental: 1.45, billing_description: "" },
  pagarme: { pix_fee_percent: 0.89, pix_fee_fixed: 0.44, pix_timer_minutes: 30, credit_fee_1x: 2.99, credit_fee_2_6x: 2.99, credit_fee_7_12x: 2.99, credit_processing_fee: 0.44, soft_descriptor: "", max_installments: 12, min_installment_value: 5, free_installments: 1, interest_rate_initial: 6.58, interest_rate_incremental: 1.45 },
  mercadopago: { pix_fee_percent: 0.99, pix_fee_fixed: 0, pix_timer_minutes: 30, credit_fee_1x: 4.98, credit_fee_2_6x: 4.98, credit_fee_7_12x: 4.98, credit_processing_fee: 0, max_installments: 12, min_installment_value: 5, free_installments: 1, interest_rate_initial: 6.58, interest_rate_incremental: 1.45 },
  stripe: { credit_fee_percent: 3.99, credit_fee_fixed: 0.39, pix_fee_percent: 1.5, pix_fee_fixed: 0, pix_timer_minutes: 30, max_installments: 12, min_installment_value: 5 },
};

const SectionHeader = ({ title, dot, icon: Icon }: { title: string; dot?: string; icon?: any }) => (
  <div className="flex items-center gap-2.5 mb-4">
    {Icon && <Icon className="w-4 h-4 text-primary" />}
    {!Icon && dot && <span className={`w-2 h-2 rounded-full ${dot} shadow-[0_0_8px_rgba(34,197,94,0.4)] animate-pulse`} />}
    <h2 className="text-sm font-bold text-foreground uppercase tracking-widest">{title}</h2>
  </div>
);

const GatewayManagement = () => {
  const { user } = useAuth();
  const [gateways, setGateways] = useState<GatewayConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGateway, setEditingGateway] = useState<GatewayConfig | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    loadGateways();
  }, [user?.id]);

  const loadGateways = async () => {
    if (!user?.id) return;
    let query = supabase.from("payment_gateways").select("id, name, provider, active, environment, payment_methods, config, created_at, updated_at, user_id").order("created_at");
    query = query.eq("user_id", user.id);
    const { data, error } = await query;
    if (!data) { if (error) toast.error("Erro ao carregar gateways"); setLoading(false); return; }

    setGateways(data.map((g: any) => ({
      id: g.id, provider: g.provider, name: g.name, environment: g.environment,
      active: g.active, payment_methods: (g.payment_methods as string[]) || [],
      config: (g.config as Record<string, any>) || {},
      user_id: g.user_id,
    })));
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este gateway?")) return;
    const { error } = await supabase.from("payment_gateways").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Gateway excluído"); loadGateways(); }
  };

  const handleEdit = (gw: GatewayConfig) => { setEditingGateway(gw); setDialogOpen(true); };

  const handleInstall = (item: CatalogItem) => {
    setEditingGateway({
      provider: item.provider, name: `${item.name} Principal`, environment: "sandbox",
      active: false, payment_methods: [], config: defaultConfigs[item.provider],
    });
    setDialogOpen(true);
  };

  const handleMigrate = (gw: GatewayConfig) => {
    toast.info(`Para migrar de ${providerLabels[gw.provider]}, instale o novo gateway, configure as credenciais e depois desative o antigo.`);
  };

  const activeGateways = gateways.filter(g => g.active);
  const inactiveGateways = gateways.filter(g => !g.active);
  const installedProviders = gateways.map(g => g.provider);

  const renderGatewayCard = (gw: GatewayConfig) => {
    return (
      <Card key={gw.id} className="border border-white/10 bg-card/40 backdrop-blur-md group hover:border-primary/40 transition-all duration-300">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <span className="font-bold text-base text-foreground block leading-none mb-1">{gw.name}</span>
                <Badge className={gw.active ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 py-0" : "bg-zinc-700/40 text-zinc-300 py-0"}>
                  {gw.active ? "Ativo" : "Inativo"}
                </Badge>
              </div>
            </div>
            <div className="flex gap-1.5">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10" onClick={() => handleMigrate(gw)}>
                      <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Migrar</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10" onClick={() => handleEdit(gw)}>
                      <Settings2 className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Configurar</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-500/10 text-destructive" onClick={() => handleDelete(gw.id!)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Excluir</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <Badge variant="secondary" className="bg-white/5 border-white/10 text-[10px] font-mono px-2 py-0.5">
              {providerLabels[gw.provider].toUpperCase()}
            </Badge>
            <Badge variant="outline" className={`text-[10px] font-mono px-2 py-0.5 ${gw.environment === "production" ? "border-amber-500/30 text-amber-400" : "border-blue-500/30 text-blue-400"}`}>
              {gw.environment === "production" ? "LIVE" : "SANDBOX"}
            </Badge>
            {gw.payment_methods.map(m => (
              <Badge key={m} variant="secondary" className="bg-primary/5 text-primary border-primary/20 text-[10px] px-2 py-0.5 uppercase">
                {m === "pix" ? "PIX" : m === "credit_card" ? "Cartão" : m}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderCatalogCard = (item: CatalogItem) => {
    const isInstalled = installedProviders.includes(item.provider);
    return (
      <Card key={item.id} className="border border-white/10 bg-card/30 backdrop-blur-sm group hover:border-primary/30 transition-all duration-500 flex flex-col">
        <CardContent className="p-6 flex flex-col gap-4 flex-1">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg shrink-0 shadow-lg transform group-hover:scale-110 transition-transform duration-300" style={{ backgroundColor: item.color }}>
              {item.initials}
            </div>
            {item.badge && (
              <Badge variant="outline" className="text-[9px] uppercase tracking-tighter px-2 py-0 border-primary/50 text-primary bg-primary/5 shadow-sm">
                {item.badge}
              </Badge>
            )}
          </div>
          <div className="space-y-1.5">
            <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">{item.name}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed h-12 overflow-hidden line-clamp-3">
              {item.description}
            </p>
          </div>
        </CardContent>
        <div className="px-6 pb-6">
          <Button
            variant={isInstalled ? "outline" : "default"}
            className={`w-full group-hover:translate-y-[-2px] transition-transform duration-300 ${isInstalled ? "opacity-50" : "bg-primary hover:bg-primary/90"}`}
            size="sm"
            disabled={isInstalled}
            onClick={() => handleInstall(item)}
          >
            {isInstalled ? "Já Instalado" : `Instalar ${item.name}`}
            {!isInstalled && <Plus className="ml-2 w-4 h-4" />}
          </Button>
        </div>
      </Card>
    );
  };

  return (
    <div className="p-6 space-y-10 animate-in fade-in duration-700">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-primary" />
            Gateways de Pagamento
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">
            Conecte e gerencie seus processadores de pagamento como Mercado Pago, Asaas e outros. Cada venda confirmada garante a automação completa do seu negócio.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-card/40 backdrop-blur-sm border border-white/10 p-4 rounded-2xl">
          <Activity className="w-5 h-5 text-emerald-400" />
          <div>
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest block leading-none mb-1">Status Global</span>
            <span className="text-sm font-bold text-emerald-400 leading-none">Sistemas Operantes</span>
          </div>
        </div>
      </div>

      {/* NEW: Integration Guide - Always prominent here */}
      <IntegrationWebhookGuide installedProviders={installedProviders} />

      {/* Active Gateways */}
      {!loading && activeGateways.length > 0 && (
        <section>
          <SectionHeader title="Gateways Ativos" dot="bg-emerald-500" />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeGateways.map(renderGatewayCard)}
          </div>
        </section>
      )}

      {/* Inactive Gateways */}
      {!loading && inactiveGateways.length > 0 && (
        <section>
          <SectionHeader title="Gateways Inativos" />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-80">
            {inactiveGateways.map(renderGatewayCard)}
          </div>
        </section>
      )}

      {/* Catalog */}
      <section className="space-y-6 pb-12">
        <SectionHeader title="Catálogo de Integrações" icon={LayoutDashboard} />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {catalog.map(renderCatalogCard)}
        </div>
      </section>

      <GatewayFormDialog open={dialogOpen} onOpenChange={setDialogOpen} gateway={editingGateway} onSaved={loadGateways} />
    </div>
  );
};

export default GatewayManagement;