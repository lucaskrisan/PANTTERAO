import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Play, Pause, Copy, MousePointerClick, ShoppingCart, TrendingUp, Trophy, Archive, Beaker, Zap, Code2, X, Code, Facebook, Pencil, Files, Clock, ExternalLink, Eye, Target, Shield } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const REDIRECT_BASE = `https://${PROJECT_ID}.supabase.co/functions/v1/ab-redirect`;

type Variant = {
  id: string;
  test_id: string;
  label: string;
  name: string;
  page_url: string | null;
  checkout_url: string | null;
  weight: number;
  mirror_pixel_id: string | null;
  impressions: number;
  clicks: number;
  sales: number;
  revenue: number;
  sort_order: number;
  thumbnail_url?: string | null;
};

type AbTest = {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "active" | "paused" | "archived" | "completed";
  traffic_split: string;
  sticky_days: number;
  auto_winner_enabled: boolean;
  auto_winner_min_clicks: number;
  auto_winner_min_uplift: number;
  winner_variant_id: string | null;
  started_at: string | null;
  created_at: string;
  variants: Variant[];
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  draft: { label: "Rascunho", cls: "bg-zinc-700/40 text-zinc-200" },
  active: { label: "Ativo", cls: "bg-emerald-600/30 text-emerald-300 border border-emerald-500/40" },
  paused: { label: "Pausado", cls: "bg-amber-600/30 text-amber-200" },
  archived: { label: "Arquivado", cls: "bg-zinc-800 text-zinc-400" },
  completed: { label: "Concluído", cls: "bg-blue-600/30 text-blue-200" },
};

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || `teste-${Math.random().toString(36).slice(2, 8)}`
  );
}

function fmtBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}

function conversion(clicks: number, sales: number): number {
  return clicks > 0 ? (sales / clicks) * 100 : 0;
}

export default function AbTests() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [showArchived, setShowArchived] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scriptOpen, setScriptOpen] = useState(false);

  const { data: mirrors = [] } = useQuery({
    queryKey: ["mirror_pixels_for_ab"],
    queryFn: async () => {
      const { data, error } = await supabase.from("mirror_pixels" as any).select("id,label,pixel_id").eq("active", true);
      if (error) throw error;
      return ((data ?? []) as unknown) as { id: string; label: string; pixel_id: string }[];
    },
  });

  const { data: tests = [], isLoading } = useQuery({
    queryKey: ["ab_tests", showArchived],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("ab_tests" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const filtered = (rows as any[]).filter((t) => (showArchived ? t.status === "archived" : t.status !== "archived"));
      const ids = filtered.map((t) => t.id);
      if (ids.length === 0) return [] as AbTest[];
      const { data: vrows, error: verr } = await supabase
        .from("ab_test_variants" as any)
        .select("*")
        .in("test_id", ids)
        .order("sort_order");
      if (verr) throw verr;
      return filtered.map((t) => ({ ...t, variants: (vrows as any[]).filter((v) => v.test_id === t.id) })) as AbTest[];
    },
  });

  const createTest = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const baseName = "Novo Teste A/B";
      const slug = slugify(`${baseName}-${Math.random().toString(36).slice(2, 6)}`);
      const { data: test, error } = await supabase
        .from("ab_tests" as any)
        .insert({ user_id: user.id, name: baseName, slug })
        .select()
        .single();
      if (error) throw error;
      const tid = (test as any).id;
      const { error: verr } = await supabase.from("ab_test_variants" as any).insert([
        { test_id: tid, label: "A", name: "Variante A", weight: 50, sort_order: 0 },
        { test_id: tid, label: "B", name: "Variante B", weight: 50, sort_order: 1 },
      ]);
      if (verr) throw verr;
      return tid;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["ab_tests"] });
      setEditingId(id);
      toast.success("Teste criado! Configure as URLs e clique em Iniciar.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar teste"),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const test = tests.find((t) => t.id === id);
      if (status === "active" && test) {
        const missing = test.variants.filter((v) => !v.page_url?.trim() || !v.checkout_url?.trim());
        if (missing.length) {
          throw new Error(
            "Preencha URL da página e do checkout em todas as variantes: " +
              missing.map((m) => m.label).join(", ")
          );
        }
      }
      const patch: any = { status };
      if (status === "active") patch.started_at = new Date().toISOString();
      const { error } = await supabase.from("ab_tests" as any).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ab_tests"] });
      toast.success("Status atualizado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const deleteTest = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ab_tests" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ab_tests"] });
      toast.success("Teste excluído");
      setEditingId(null);
    },
  });

  const duplicateTest = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const original = tests.find((t) => t.id === id);
      if (!original) throw new Error("Teste não encontrado");

      const newName = `${original.name} (cópia)`;
      const newSlug = slugify(`${newName}-${Math.random().toString(36).slice(2, 6)}`);

      const { data: full } = await supabase
        .from("ab_tests" as any).select("graph,entry_url,sticky_days,auto_winner_enabled,auto_winner_min_clicks,auto_winner_min_uplift")
        .eq("id", id).maybeSingle();

      const { data: created, error } = await supabase
        .from("ab_tests" as any)
        .insert({
          user_id: user.id,
          name: newName,
          slug: newSlug,
          status: "draft",
          graph: (full as any)?.graph ?? null,
          entry_url: `${REDIRECT_BASE}/${newSlug}?type=page`,
          sticky_days: (full as any)?.sticky_days ?? 30,
          auto_winner_enabled: (full as any)?.auto_winner_enabled ?? true,
          auto_winner_min_clicks: (full as any)?.auto_winner_min_clicks ?? 100,
          auto_winner_min_uplift: (full as any)?.auto_winner_min_uplift ?? 10,
        })
        .select().single();
      if (error) throw error;

      const newId = (created as any).id;
      // Clone variants (sem stats)
      if (original.variants.length > 0) {
        await supabase.from("ab_test_variants" as any).insert(
          original.variants.map((v) => ({
            test_id: newId,
            label: v.label,
            name: v.name,
            page_url: v.page_url,
            checkout_url: v.checkout_url,
            weight: v.weight,
            mirror_pixel_id: v.mirror_pixel_id,
            sort_order: v.sort_order,
          }))
        );
      }
      return newId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ab_tests"] });
      toast.success("Teste duplicado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao duplicar"),
  });

  const editing = useMemo(() => tests.find((t) => t.id === editingId) ?? null, [tests, editingId]);

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-normal">Testes A/B</h1>
            <p className="text-sm text-muted-foreground mt-1">Crie testes para otimizar suas conversões</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowArchived((v) => !v)}>
              <Archive className="w-4 h-4 mr-2" />
              {showArchived ? "Ver ativos" : "Arquivados"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setScriptOpen(true)}>
              <Code2 className="w-4 h-4 mr-2" /> Script
            </Button>
            <Button onClick={() => navigate("/admin/ab-tests/new")}>
              <Plus className="w-4 h-4 mr-2" /> Novo Teste
            </Button>
          </div>
        </div>

        {isLoading && <div className="text-muted-foreground">Carregando…</div>}

        {!isLoading && tests.length === 0 && (
          <div className="min-h-[560px] flex items-center justify-center">
            <Card className="w-full max-w-md p-10 text-center border-border/60 bg-card/70 shadow-sm">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-muted/60">
                <Beaker className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold tracking-normal">
                {showArchived ? "Nenhum teste arquivado" : "Nenhum teste criado"}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {showArchived
                  ? "Os testes arquivados aparecerão aqui."
                  : "Crie seu primeiro teste A/B para começar a comparar suas páginas."}
              </p>
            </Card>
          </div>
        )}

        <div className="grid gap-4">
          {tests.map((t) => {
            const totalClicks = t.variants.reduce((a, v) => a + Number(v.clicks || 0), 0);
            const totalSales = t.variants.reduce((a, v) => a + Number(v.sales || 0), 0);
            const totalRevenue = t.variants.reduce((a, v) => a + Number(v.revenue || 0), 0);
            const winner = t.winner_variant_id;
            const sortedByConv = [...t.variants].sort(
              (a, b) => conversion(b.clicks, b.sales) - conversion(a.clicks, a.sales)
            );
            const leader = sortedByConv[0];
            const linkPage = `${REDIRECT_BASE}/${t.slug}?type=page`;
            const linkCheckout = `${REDIRECT_BASE}/${t.slug}?type=checkout`;
            
            // Pretty links using the application's clean domain
            const publicDomain = "ck.panttera.com.br";
            const prettyLinkPage = `https://${publicDomain}/go/${t.slug}?type=page`;
            const prettyLinkCheckout = `https://${publicDomain}/go/${t.slug}?type=checkout`;
            return (
              <Card
                key={t.id}
                className="p-5 cursor-pointer hover:border-primary/40 transition bg-card/60"
                onClick={() => navigate(`/admin/ab-tests/${t.id}`)}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left: name, status, links, variants count, metrics */}
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold">{t.name}</h3>
                      <Badge className={STATUS_LABEL[t.status]?.cls ?? ""}>{STATUS_LABEL[t.status]?.label}</Badge>
                      {t.variants.some(v => v.mirror_pixel_id) && (
                        <Badge className="bg-violet-600/30 text-violet-300 border border-violet-500/40 flex items-center gap-1">
                          <Shield className="w-3 h-3" /> Domínio Protegido
                        </Badge>
                      )}
                      {winner && (
                        <Badge className="bg-yellow-500/30 text-yellow-200 border border-yellow-400/40">
                          <Trophy className="w-3 h-3 mr-1" /> Vencedor: {t.variants.find((v) => v.id === winner)?.label}
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <CompactLinkRow label="Página" url={prettyLinkPage} />
                      <CompactLinkRow label="Checkout" url={prettyLinkCheckout} />
                      <div className="text-xs text-muted-foreground pl-[68px]">{t.variants.length} variantes</div>
                    </div>

                    <div className="flex items-center gap-5 text-sm pt-2">
                      <Stat icon={Zap} label="cliques" value={totalClicks.toLocaleString("pt-BR")} color="text-yellow-400" />
                      <Stat icon={ShoppingCart} label="vendas" value={totalSales.toLocaleString("pt-BR")} color="text-emerald-400" />
                      <Stat icon={Target} label="conversão" value={`${conversion(totalClicks, totalSales).toFixed(1)}%`} color="text-blue-400" />
                      <Stat icon={TrendingUp} label="receita" value={fmtBRL(totalRevenue)} color="text-violet-400" />
                      <Stat icon={Clock} label="duração" value={t.started_at ? formatDuration(t.started_at) : "-"} />
                    </div>
                  </div>

                  {/* Right: action icons */}
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {t.status === "draft" || t.status === "paused" ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10" onClick={() => setStatus.mutate({ id: t.id, status: "active" })}>
                            <Play className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Iniciar</TooltipContent>
                      </Tooltip>
                    ) : t.status === "active" ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10" onClick={() => setStatus.mutate({ id: t.id, status: "paused" })}>
                            <Pause className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Pausar</TooltipContent>
                      </Tooltip>
                    ) : null}

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => navigate(`/admin/ab-tests/${t.id}`)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Editar</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => duplicateTest.mutate(t.id)} disabled={duplicateTest.isPending}>
                          <Files className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Duplicar</TooltipContent>
                    </Tooltip>

                    {t.status !== "archived" && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setStatus.mutate({ id: t.id, status: "archived" })}>
                            <Archive className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Arquivar</TooltipContent>
                      </Tooltip>
                    )}

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          onClick={() => {
                            if (confirm(`Excluir o teste "${t.name}"?`)) deleteTest.mutate(t.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Excluir</TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                {/* Per-variant strip */}
                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {t.variants.map((v) => {
                    const conv = conversion(v.clicks, v.sales);
                    const isLeader = leader && v.id === leader.id && totalClicks > 0;
                    
                    // Simple logic to get a favicon as a placeholder preview if no thumbnail
                    const getPreviewUrl = (url: string | null) => {
                      if (!url) return null;
                      try {
                        const domain = new URL(url).hostname;
                        return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
                      } catch {
                        return null;
                      }
                    };

                    return (
                      <div 
                        key={v.id} 
                        className={`group/variant relative rounded-xl border p-4 transition-all duration-300 hover:shadow-md ${
                          isLeader 
                            ? "border-emerald-500/30 bg-emerald-500/5 ring-1 ring-emerald-500/10" 
                            : "border-border/40 bg-muted/20"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-black ${
                              isLeader ? "bg-emerald-500 text-white" : "bg-muted-foreground/20 text-muted-foreground"
                            }`}>
                              {v.label}
                            </div>
                            <span className="text-xs font-bold truncate">{v.name}</span>
                          </div>
                          {isLeader && (
                            <Badge variant="outline" className="h-5 px-1.5 text-[9px] uppercase border-emerald-500/30 bg-emerald-500/10 text-emerald-400 gap-1 shrink-0">
                              <Trophy className="w-2.5 h-2.5" /> Líder
                            </Badge>
                          )}
                        </div>

                        {/* Page Preview Placeholder */}
                        <div className="relative aspect-video rounded-lg mb-4 bg-muted/40 overflow-hidden border border-border/20">
                          {v.thumbnail_url ? (
                            <img src={v.thumbnail_url} alt={v.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-2 opacity-40">
                              {getPreviewUrl(v.page_url) ? (
                                <img src={getPreviewUrl(v.page_url)!} className="w-6 h-6 rounded" alt="icon" />
                              ) : (
                                <Eye className="w-6 h-6" />
                              )}
                              <span className="text-[10px] uppercase font-bold tracking-tighter">Preview</span>
                            </div>
                          )}
                          
                          {/* Quick access overlay */}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/variant:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            {v.page_url && (
                              <Button 
                                size="sm" 
                                variant="secondary" 
                                className="h-7 text-[10px] font-bold px-2 bg-white text-black hover:bg-zinc-200"
                                onClick={(e) => { e.stopPropagation(); window.open(v.page_url!, "_blank"); }}
                              >
                                <ExternalLink className="w-3 h-3 mr-1" /> Página
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-y-3 gap-x-2">
                          <div className="space-y-0.5">
                            <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">Cliques</span>
                            <div className="text-sm font-black">{v.clicks?.toLocaleString("pt-BR") || 0}</div>
                          </div>
                          <div className="space-y-0.5 text-right">
                            <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">Vendas</span>
                            <div className="text-sm font-black">{v.sales?.toLocaleString("pt-BR") || 0}</div>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">Conversão</span>
                            <div className={`text-sm font-black ${isLeader ? "text-emerald-400" : ""}`}>{conv.toFixed(1)}%</div>
                          </div>
                          <div className="space-y-0.5 text-right">
                            <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">Receita</span>
                            <div className="text-sm font-black">{fmtBRL(Number(v.revenue || 0))}</div>
                          </div>
                        </div>

                        {/* Conversion Progress Bar */}
                        <div className="mt-4 h-1 w-full bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-500 ${isLeader ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-primary/40"}`}
                            style={{ width: `${Math.min(conv * 5, 100)}%` }} // Scaled for visibility since conv is usually small
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>

        <Sheet open={!!editing} onOpenChange={(o) => !o && setEditingId(null)}>
          <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
            {editing && <TestEditor test={editing} mirrors={mirrors} onClose={() => setEditingId(null)} />}
          </SheetContent>
        </Sheet>

        <ScriptDialog open={scriptOpen} onOpenChange={setScriptOpen} />
      </div>
    </TooltipProvider>
  );
}

function ScriptDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  // Script Panttera nativo — captura UTMs/src/sck e propaga para o checkout.
  const publicDomain = "ck.panttera.com.br";
  const trackingScript = `<script src="https://${publicDomain}/go/track.js" defer></script>`;
  const fbUtm = `utm_source=FB&utm_campaign={{campaign.name}}|{{campaign.id}}&utm_medium={{adset.name}}|{{adset.id}}&utm_content={{ad.name}}|{{ad.id}}&utm_term={{placement}}`;

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0 bg-[#0f1117] border-border/60">
        <div className="p-6 space-y-6">
          {/* Header: Script de Rastreamento */}
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-600/20 flex items-center justify-center shrink-0">
              <Code className="h-5 w-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold">Script de Rastreamento</h2>
              <p className="text-sm text-muted-foreground">Instale na sua página de vendas</p>
            </div>
          </div>

          <p className="text-sm text-foreground/90">
            Cole este script na sua página de vendas para que os parâmetros de rastreamento (
            <code className="bg-muted/60 px-1.5 py-0.5 rounded text-xs font-mono">src</code>,{" "}
            <code className="bg-muted/60 px-1.5 py-0.5 rounded text-xs font-mono">sck</code>, UTMs) sejam repassados
            automaticamente para o checkout.
          </p>

          <div className="relative rounded-lg border border-border/60 bg-muted/30 p-3">
            <pre className="text-xs font-mono text-foreground/90 overflow-x-auto pr-20 whitespace-nowrap">
              {trackingScript}
            </pre>
            <Button
              size="sm"
              variant="secondary"
              className="absolute top-2 right-2 h-7 px-2 text-xs"
              onClick={() => copy(trackingScript, "Script")}
            >
              <Copy className="w-3 h-3 mr-1" /> Copiar
            </Button>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-bold">Como funciona:</h4>
            <ol className="space-y-1.5 text-sm text-foreground/90">
              <li><span className="text-blue-400 font-semibold">1.</span> Captura UTMs, src e sck da URL ao carregar a página</li>
              <li><span className="text-blue-400 font-semibold">2.</span> Salva no localStorage por 30 dias (persistência entre páginas)</li>
              <li><span className="text-blue-400 font-semibold">3.</span> Injeta automaticamente em todos os links e formulários da página</li>
            </ol>
          </div>

          <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-sm">
            <span className="font-bold text-blue-300">💡 Para Testes A/B:</span>{" "}
            <span className="text-foreground/90">
              Ao usar nossas URLs de redirecionamento, o tracking é automático. Este script é necessário
              apenas para capturar UTMs em páginas externas ou disparar eventos customizados via
              <code className="mx-1 bg-black/40 px-1 rounded text-xs">Panttera.track('click')</code>.
            </span>
          </div>

          <div className="border-t border-border/60" />

          {/* UTM para Facebook Ads */}
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-600/20 flex items-center justify-center shrink-0">
              <Facebook className="h-5 w-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold">UTM para Facebook Ads</h2>
              <p className="text-sm text-muted-foreground">Cole na URL de destino do seu anúncio</p>
            </div>
          </div>

          <p className="text-sm text-foreground/90">
            Adicione este parâmetro na URL de destino dos seus anúncios no Facebook para rastrear automaticamente
            campanha, conjunto de anúncios, anúncio e posicionamento.
          </p>

          <div className="relative rounded-lg border border-border/60 bg-muted/30 p-3">
            <pre className="text-xs font-mono text-foreground/90 overflow-x-auto pr-20 whitespace-pre-wrap break-all">
              {fbUtm}
            </pre>
            <Button
              size="sm"
              variant="secondary"
              className="absolute top-2 right-2 h-7 px-2 text-xs"
              onClick={() => copy(fbUtm, "UTM")}
            >
              <Copy className="w-3 h-3 mr-1" /> Copiar
            </Button>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-bold">Como usar:</h4>
            <ol className="space-y-1.5 text-sm text-foreground/90">
              <li>1. No Gerenciador de Anúncios, edite o anúncio e vá em <strong>URL de destino</strong></li>
              <li>2. No campo <strong>Parâmetros de URL</strong>, cole o código acima</li>
              <li>
                3. O Facebook substituirá automaticamente os valores entre{" "}
                <code className="bg-muted/60 px-1.5 py-0.5 rounded text-xs font-mono">{`{{...}}`}</code> pelos dados reais
                da campanha
              </li>
            </ol>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ icon: Icon, label, value, color }: any) {
  return (
    <div className="flex items-center gap-2 text-sm group/stat">
      <div className={`p-1.5 rounded-md bg-muted/40 ${color || "text-muted-foreground"}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex flex-col -space-y-0.5">
        <span className="font-black text-slate-100 leading-tight">{value}</span>
        <span className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider leading-tight">{label}</span>
      </div>
    </div>
  );
}

function LinkRow({ label, url }: { label: string; url: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground w-16">{label}:</span>
      <code className="bg-muted/40 px-2 py-1 rounded text-xs flex-1 truncate">{url}</code>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(url);
              toast.success("Link copiado");
            }}
          >
            <Copy className="w-3 h-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Copiar link</TooltipContent>
      </Tooltip>
    </div>
  );
}

function CompactLinkRow({ label, url }: { label: string; url: string }) {
  const display = url.replace(/^https?:\/\//, "");
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground w-[60px] shrink-0">{label}:</span>
      <div className="inline-flex items-center gap-1.5 bg-muted/40 hover:bg-muted/60 transition-colors px-2.5 py-1 rounded-md max-w-full">
        <code className="font-mono text-xs truncate">https://{display}</code>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(url);
            toast.success("Link copiado");
          }}
          aria-label="Copiar"
        >
          <Copy className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

function formatDuration(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime();
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return `${days}d`;
  const hours = Math.floor(ms / 3600000);
  if (hours >= 1) return `${hours}h`;
  const minutes = Math.floor(ms / 60000);
  return `${Math.max(minutes, 0)}m`;
}

function TestEditor({
  test,
  mirrors,
  onClose,
}: {
  test: AbTest;
  mirrors: { id: string; label: string; pixel_id: string }[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(test.name);
  const [autoWinner, setAutoWinner] = useState(test.auto_winner_enabled);
  const [minClicks, setMinClicks] = useState(test.auto_winner_min_clicks);
  const [minUplift, setMinUplift] = useState(test.auto_winner_min_uplift);
  const [variants, setVariants] = useState(test.variants);

  const save = useMutation({
    mutationFn: async () => {
      const { error: terr } = await supabase
        .from("ab_tests" as any)
        .update({
          name: name.trim() || "Teste A/B",
          auto_winner_enabled: autoWinner,
          auto_winner_min_clicks: minClicks,
          auto_winner_min_uplift: minUplift,
        })
        .eq("id", test.id);
      if (terr) throw terr;
      // Save each variant
      for (const v of variants) {
        const { error: verr } = await supabase
          .from("ab_test_variants" as any)
          .update({
            name: v.name,
            page_url: v.page_url,
            checkout_url: v.checkout_url,
            weight: v.weight,
            mirror_pixel_id: v.mirror_pixel_id,
          })
          .eq("id", v.id);
        if (verr) throw verr;
      }
    },
    onSuccess: () => {
      toast.success("Salvo");
      qc.invalidateQueries({ queryKey: ["ab_tests"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const updateVariant = (id: string, patch: Partial<Variant>) =>
    setVariants((vs) => vs.map((v) => (v.id === id ? { ...v, ...patch } : v)));

  return (
    <>
      <SheetHeader>
        <SheetTitle>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="text-xl font-bold" />
        </SheetTitle>
        <SheetDescription>
          Configure as URLs de cada variante. O pixel espelho é opcional, mas <strong>recomendado</strong> para ROI máximo: o Meta vai otimizar separadamente cada criativo.
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-5 mt-6">
        {variants.map((v) => (
          <Card key={v.id} className="p-4 space-y-3 border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className="bg-primary/20 text-primary border border-primary/40 text-base px-2.5">{v.label}</Badge>
                <Input
                  value={v.name}
                  onChange={(e) => updateVariant(v.id, { name: e.target.value })}
                  className="font-semibold border-0 bg-transparent focus-visible:ring-1 max-w-[200px]"
                />
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Label className="text-muted-foreground">Peso</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={v.weight}
                  onChange={(e) => updateVariant(v.id, { weight: parseInt(e.target.value || "0", 10) })}
                  className="w-16 h-7 text-center"
                />
                <span className="text-muted-foreground">%</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">URL da Página de Venda</Label>
              <Input
                value={v.page_url ?? ""}
                onChange={(e) => updateVariant(v.id, { page_url: e.target.value })}
                placeholder="https://minhapagina.com/oferta-a"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">URL do Checkout</Label>
              <Input
                value={v.checkout_url ?? ""}
                onChange={(e) => updateVariant(v.id, { checkout_url: e.target.value })}
                placeholder="https://app.panttera.com.br/checkout/PRODUCT_ID"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-yellow-400" /> Pixel Espelho desta variante
              </Label>
              <Select
                value={v.mirror_pixel_id ?? "none"}
                onValueChange={(val) => updateVariant(v.id, { mirror_pixel_id: val === "none" ? null : val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem pixel específico (usa apenas o pixel global)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem pixel específico</SelectItem>
                  {mirrors.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label} ({m.pixel_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {mirrors.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhum pixel espelho cadastrado. <a href="/admin/pixel-mirrors" className="text-primary underline">Cadastrar →</a>
                </p>
              )}
            </div>

            {(v.clicks > 0 || v.sales > 0) && (
              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border/40 text-center">
                <div><div className="text-base font-bold">{v.clicks}</div><div className="text-xs text-muted-foreground">cliques</div></div>
                <div><div className="text-base font-bold">{v.sales}</div><div className="text-xs text-muted-foreground">vendas</div></div>
                <div><div className="text-base font-bold">{conversion(v.clicks, v.sales).toFixed(1)}%</div><div className="text-xs text-muted-foreground">conv.</div></div>
                <div><div className="text-base font-bold">{fmtBRL(Number(v.revenue || 0))}</div><div className="text-xs text-muted-foreground">receita</div></div>
              </div>
            )}
          </Card>
        ))}

        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-semibold">Vencedor automático</Label>
              <p className="text-xs text-muted-foreground">
                Eleger automaticamente a variante vencedora quando houver dados suficientes.
              </p>
            </div>
            <Switch checked={autoWinner} onCheckedChange={setAutoWinner} />
          </div>
          {autoWinner && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <Label className="text-xs">Cliques mínimos por variante</Label>
                <Input type="number" min={10} value={minClicks} onChange={(e) => setMinClicks(parseInt(e.target.value || "100", 10))} />
              </div>
              <div>
                <Label className="text-xs">Diferença mínima (%)</Label>
                <Input type="number" min={5} value={minUplift} onChange={(e) => setMinUplift(parseInt(e.target.value || "20", 10))} />
              </div>
            </div>
          )}
        </Card>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar alterações</Button>
        </div>
      </div>
    </>
  );
}
