import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Activity, Shield, Zap, Info, Clock, Facebook, Settings2, X, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const ALL_EVENTS = ["Purchase", "InitiateCheckout", "AddPaymentInfo", "Lead", "ViewContent", "PageView"];

export default function PixelMirrors() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    label: "",
    pixel_id: "",
    capi_token: "",
    fire_on_events: ALL_EVENTS,
    event_source_url_override: "",
  });

  const { data: mirrors, isLoading } = useQuery({
    queryKey: ["mirror_pixels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mirror_pixels" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.pixel_id.trim() || !form.capi_token.trim()) {
        throw new Error("Pixel ID e Token CAPI são obrigatórios");
      }
      const { error } = await supabase.from("mirror_pixels" as any).insert({
        label: form.label.trim() || "Pixel Espelho",
        pixel_id: form.pixel_id.trim(),
        capi_token: form.capi_token.trim(),
        fire_on_events: form.fire_on_events,
        event_source_url_override: form.event_source_url_override.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pixel espelho criado");
      setOpen(false);
      setForm({ label: "", pixel_id: "", capi_token: "", fire_on_events: ALL_EVENTS, event_source_url_override: "" });
      qc.invalidateQueries({ queryKey: ["mirror_pixels"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("mirror_pixels" as any).update({ active, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mirror_pixels"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mirror_pixels" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["mirror_pixels"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleEvent = (ev: string) => {
    setForm((f) => ({
      ...f,
      fire_on_events: f.fire_on_events.includes(ev)
        ? f.fire_on_events.filter((x) => x !== ev)
        : [...f.fire_on_events, ev],
    }));
  };

  const [showTutorial, setShowTutorial] = useState(false);

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-normal">Pixels Espelho</h1>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-violet-400 hover:text-violet-300 hover:bg-violet-500/10"
                onClick={() => setShowTutorial(true)}
              >
                <Info className="w-5 h-5" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Duplicação de eventos via CAPI puro para proteção de domínio</p>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" /> Novo Pixel
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg bg-[#0d0f15] border-border/40">
                <DialogHeader>
                  <DialogTitle>Cadastrar Pixel Espelho</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Rótulo (identificação interna)</Label>
                    <Input className="bg-muted/20 border-border/40" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Ex: Pixel Reserva BM02" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Pixel ID *</Label>
                      <Input className="bg-muted/20 border-border/40" value={form.pixel_id} onChange={(e) => setForm({ ...form, pixel_id: e.target.value })} placeholder="123456789..." />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Event Source Override</Label>
                      <Input className="bg-muted/20 border-border/40" value={form.event_source_url_override} onChange={(e) => setForm({ ...form, event_source_url_override: e.target.value })} placeholder="https://..." />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Token CAPI *</Label>
                    <Input type="password" className="bg-muted/20 border-border/40" value={form.capi_token} onChange={(e) => setForm({ ...form, capi_token: e.target.value })} placeholder="EAA..." />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Eventos a espelhar</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {ALL_EVENTS.map((ev) => (
                        <Badge
                          key={ev}
                          variant={form.fire_on_events.includes(ev) ? "default" : "outline"}
                          className={`cursor-pointer text-[10px] py-0 h-6 ${form.fire_on_events.includes(ev) ? "bg-violet-600 hover:bg-violet-700" : "opacity-60"}`}
                          onClick={() => toggleEvent(ev)}
                        >
                          {ev}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter className="gap-2">
                  <Button variant="outline" size="sm" onClick={() => setOpen(false)} className="border-border/40">Cancelar</Button>
                  <Button size="sm" className="bg-violet-600 hover:bg-violet-700" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Salvando..." : "Criar Pixel"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl p-4 flex gap-3">
          <Info className="h-5 w-5 text-violet-400 shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground leading-relaxed">
            <p className="text-violet-200 font-semibold mb-1">Como funciona a proteção de domínio:</p>
            O Meta CAPI duplica eventos para estes pixels <strong>exclusivamente via servidor</strong>. Como não há script no navegador, o Facebook não consegue rastrear o domínio nem categorizá-lo, protegendo sua estrutura de bloqueios por "categorização de mercado".
          </div>
        </div>

        {isLoading && <div className="text-muted-foreground text-sm animate-pulse">Carregando pixels...</div>}

        {!isLoading && mirrors?.length === 0 && (
          <div className="min-h-[400px] flex items-center justify-center">
            <Card className="w-full max-w-md p-10 text-center border-border/60 bg-card/70 shadow-sm">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-muted/60">
                <Shield className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold tracking-normal">Nenhum pixel espelho</h3>
              <p className="mt-2 text-sm text-muted-foreground">Adicione seu primeiro pixel para começar a espelhar eventos com segurança.</p>
            </Card>
          </div>
        )}

        <div className="grid gap-4">
          {mirrors?.map((m) => (
            <Card key={m.id} className="p-5 hover:border-primary/40 transition bg-card/60 group">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold">{m.label}</h3>
                    <Badge className={m.active ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/40" : "bg-zinc-700/40 text-zinc-300"}>
                      {m.active ? "Ativo" : "Pausado"}
                    </Badge>
                    {m.last_event_at && (Date.now() - new Date(m.last_event_at).getTime() < 1000 * 60 * 5) && (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 animate-pulse flex items-center gap-1">
                        <Activity className="w-3 h-3" /> Sinal Recebido
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-2 text-muted-foreground font-mono bg-muted/30 px-2 py-1 rounded w-fit">
                      <Facebook className="w-3 h-3" /> {m.pixel_id}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(m.fire_on_events as string[]).map((ev) => (
                        <span key={ev} className="px-1.5 py-0.5 bg-violet-500/10 text-violet-300 border border-violet-500/20 rounded text-[10px] font-medium">
                          {ev}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-5 text-sm pt-1">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-violet-400" />
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground uppercase leading-none mb-1">Enviados</span>
                        <span className="font-bold leading-none">{m.total_events_sent?.toLocaleString("pt-BR") || 0}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-400" />
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground uppercase leading-none mb-1">Último disparo</span>
                        <span className="font-bold leading-none">
                          {m.last_event_at ? format(new Date(m.last_event_at), "HH:mm 'de' dd/MM", { locale: ptBR }) : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <div className="flex items-center gap-3 mr-2 bg-muted/20 px-3 py-1.5 rounded-lg border border-border/40">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">CAPI</span>
                    <Switch
                      className="scale-75 data-[state=checked]:bg-emerald-500"
                      checked={m.active}
                      onCheckedChange={(v) => toggleMutation.mutate({ id: m.id, active: v })}
                    />
                  </div>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => {
                        if (confirm("Remover este pixel espelho?")) deleteMutation.mutate(m.id);
                      }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Remover</TooltipContent>
                  </Tooltip>
                </div>
              </div>

              {m.last_meta_response?.error && (
                <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-red-200">
                    <span className="font-bold uppercase block mb-0.5">Erro Meta API</span>
                    {JSON.stringify(m.last_meta_response.error)}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>

        {/* Tutorial Dialog */}
        <Dialog open={showTutorial} onOpenChange={setShowTutorial}>
          <DialogContent className="max-w-2xl bg-[#0d0f15] border-border/40 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Zap className="w-5 h-5 text-violet-400" />
                Guia: Como usar o Pixel Espelho
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              <section className="space-y-3">
                <h4 className="font-bold text-violet-300 flex items-center gap-2">
                  <Shield className="w-4 h-4" /> 
                  O que é e por que usar?
                </h4>
                <div className="grid gap-4 text-sm text-muted-foreground leading-relaxed">
                  <p>
                    O Pixel Espelho é uma ferramenta de <strong className="text-foreground">rastreamento 100% via servidor (CAPI)</strong>. 
                    Ao contrário do pixel convencional, ele não carrega nenhum script no navegador do cliente.
                  </p>
                  <div className="bg-violet-500/5 border border-violet-500/10 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-semibold text-violet-200 uppercase tracking-wider">Principais Vantagens:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li><span className="text-foreground font-medium">Proteção de Domínio:</span> O Facebook não consegue "rastrear" ou categorizar seu domínio principal, evitando bloqueios por "serviços financeiros".</li>
                      <li><span className="text-foreground font-medium">ROI Máximo:</span> Bypass completo de AdBlockers e restrições de navegadores.</li>
                      <li><span className="text-foreground font-medium">Segmentação A/B:</span> Envie dados para pixels diferentes para cada variante do seu teste.</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="font-bold text-violet-300 flex items-center gap-2">
                  <Settings2 className="w-4 h-4" /> 
                  Passo a Passo da Configuração
                </h4>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="h-6 w-6 rounded-full bg-violet-600/20 text-violet-400 flex items-center justify-center shrink-0 font-bold text-xs border border-violet-500/30">1</div>
                    <div className="text-sm">
                      <p className="font-semibold text-slate-200">Gerar Token CAPI</p>
                      <p className="text-muted-foreground text-xs">No Gerenciador de Eventos do Facebook, vá em <strong className="text-slate-300 italic">Configurações → Gerar token de acesso</strong>.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="h-6 w-6 rounded-full bg-violet-600/20 text-violet-400 flex items-center justify-center shrink-0 font-bold text-xs border border-violet-500/30">2</div>
                    <div className="text-sm">
                      <p className="font-semibold text-slate-200">Cadastrar na Panttera</p>
                      <p className="text-muted-foreground text-xs">Clique em "Novo Pixel" nesta tela, insira o ID do Pixel e o Token gerado.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="h-6 w-6 rounded-full bg-violet-600/20 text-violet-400 flex items-center justify-center shrink-0 font-bold text-xs border border-violet-500/30">3</div>
                    <div className="text-sm">
                      <p className="font-semibold text-slate-200">Vincular a Variantes</p>
                      <p className="text-muted-foreground text-xs">Ao editar um Teste A/B, você verá a opção de escolher um "Pixel Espelho" para cada página.</p>
                    </div>
                  </div>
                </div>
              </section>

              <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 flex gap-3 items-start">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-200/80 leading-normal">
                  <strong className="text-amber-300">Dica Extra:</strong> O Pixel Espelho é enviado mesmo que o cliente feche o checkout antes do tempo, pois ele é disparado assim que os dados chegam no nosso servidor. É a forma mais estável de garantir que sua conversão seja marcada.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button className="w-full bg-violet-600 hover:bg-violet-700" onClick={() => setShowTutorial(false)}>
                Entendi, vamos lucrar!
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
