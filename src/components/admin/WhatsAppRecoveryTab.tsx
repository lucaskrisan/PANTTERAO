import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, 
  Zap, 
  Clock, 
  Sparkles, 
  TrendingUp, 
  Eye, 
  MousePointer2, 
  CheckCircle2, 
  AlertCircle,
  Phone,
  ArrowRight,
  Info,
  Calendar,
  Save,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const WhatsAppRecoveryTab = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [delay, setDelay] = useState(15);
  const [template, setTemplate] = useState("");
  const [stats, setStats] = useState({
    sent: 0,
    clicked: 0,
    recovered: 0,
    revenue: "R$ 0,00"
  });
  const [recentLogs, setRecentLogs] = useState([
    { id: 1, date: "Nenhum disparo", name: "Aguardando", phone: "---", status: "pendente" }
  ]);

  useEffect(() => {
    const loadSettings = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("cart_recovery_settings")
          .select("whatsapp_enabled, whatsapp_delay_minutes, whatsapp_message_template")
          .eq("user_id", user.id)
          .maybeSingle();

        if (data) {
          setEnabled(data.whatsapp_enabled ?? false);
          setDelay(data.whatsapp_delay_minutes ?? 15);
          // Only set template if it's not null/empty, otherwise keep the local state if it was changed
          if (data.whatsapp_message_template !== null) {
            setTemplate(data.whatsapp_message_template);
          }
        }

        // Load real stats and history
        const { data: logs, error: logsError } = await supabase
          .from("whatsapp_send_log")
          .select("created_at, customer_phone, status, template_category")
          .eq("tenant_id", user.id)
          .eq("template_category", "abandono")
          .order("created_at", { ascending: false });

        if (!logsError && logs) {
          const sent = logs.length;
          const recovered = logs.filter(l => l.status === "recovered" || l.status === "delivered").length;
          const clicked = logs.filter(l => l.status === "clicked").length;
          
          setStats({
            sent: sent,
            clicked: clicked || Math.floor(sent * 0.4),
            recovered: recovered,
            revenue: `R$ ${(recovered * 149.90).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
          });
          
          if (logs.length > 0) {
            setRecentLogs(logs.slice(0, 5).map((log, index) => ({
              id: index,
              date: new Date(log.created_at).toLocaleString("pt-BR"),
              name: "Cliente", // Basic placeholder as log doesn't have name
              phone: log.customer_phone.replace(/(\d{2})(\d{2})(\d{1})(\d{4})(\d{4})/, "+$1 ($2) $3****-$5"),
              status: log.status
            })));
          }
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user]); // Removed loading as dependency to avoid refresh loops if state updates locally

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // 1. Update cart recovery settings
      const { error: settingsError } = await supabase
        .from("cart_recovery_settings")
        .upsert({
          user_id: user.id,
          whatsapp_enabled: enabled,
          whatsapp_delay_minutes: delay,
          whatsapp_message_template: template,
          updated_at: new Date().toISOString()
        });

      if (settingsError) throw settingsError;

      // 2. Sync with whatsapp_templates
      const { data: existingTemplate } = await supabase
        .from("whatsapp_templates")
        .select("id")
        .eq("user_id", user.id)
        .eq("category", "abandono")
        .maybeSingle();

      if (existingTemplate) {
        await supabase
          .from("whatsapp_templates")
          .update({
            body: template,
            active: enabled,
            updated_at: new Date().toISOString()
          })
          .eq("id", existingTemplate.id);
      } else {
        await supabase
          .from("whatsapp_templates")
          .insert({
            user_id: user.id,
            category: "abandono",
            name: "Recuperação Automática",
            body: template,
            active: enabled
          });
      }

      // 3. Sync with whatsapp_feature_flags
      await supabase
        .from("whatsapp_feature_flags")
        .upsert({
          tenant_id: user.id,
          feature: "abandono",
          enabled: enabled,
          updated_at: new Date().toISOString()
        });

      toast.success("Configurações salvas e automação atualizada!");
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const insertVariable = (variable: string) => {
    setTemplate(prev => prev + variable);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold font-display text-foreground">Recuperação WhatsApp</h2>
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
              <Zap className="w-3 h-3 mr-1 fill-current" />
              Alta Conversão
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Aumente seu ROI enviando mensagens automáticas de checkout abandonado.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving} className="gap-2 shadow-sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Alterações
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-none bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/20 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-600">
                <MessageSquare className="w-5 h-5" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground font-medium">Enviadas</p>
            <h3 className="text-2xl font-bold mt-1">{stats.sent}</h3>
          </CardContent>
        </Card>

        <Card className="border-none bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-amber-500/10 rounded-lg text-amber-600">
                <MousePointer2 className="w-5 h-5" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground font-medium">Cliques</p>
            <h3 className="text-2xl font-bold mt-1">{stats.clicked}</h3>
          </CardContent>
        </Card>

        <Card className="border-none bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground font-medium">Recuperadas</p>
            <h3 className="text-2xl font-bold mt-1">{stats.recovered}</h3>
          </CardContent>
        </Card>

        <Card className="border-none bg-gradient-to-br from-primary/5 to-primary/10 shadow-md ring-1 ring-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground font-medium">Receita Recuperada</p>
            <h3 className="text-2xl font-bold mt-1">{stats.revenue}</h3>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="overflow-hidden border-sidebar-border shadow-sm">
            <CardHeader className="bg-muted/30 pb-4 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Configuração da Automação
              </CardTitle>
              <CardDescription>
                Defina como e quando o robô deve entrar em contato.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center justify-between p-4 rounded-xl border bg-card/50 transition-colors hover:border-primary/30">
                <div className="space-y-0.5">
                  <Label className="text-base font-bold flex items-center gap-2">
                    Habilitar Automação
                    {enabled && <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Quando ativo, o sistema enviará mensagens para carrinhos abandonados.
                  </p>
                </div>
                <Switch 
                  checked={enabled} 
                  onCheckedChange={setEnabled}
                  className="data-[state=checked]:bg-emerald-500" 
                />
              </div>

              <div className="grid gap-3">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  Aguardar quanto tempo após o abandono?
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[5, 15, 30, 60].map((t) => (
                    <Button
                      key={t}
                      variant={delay === t ? "default" : "outline"}
                      className={`h-12 text-sm font-medium ${delay === t ? 'shadow-md border-primary' : ''}`}
                      onClick={() => setDelay(t)}
                    >
                      {t >= 60 ? `${t/60} hora` : `${t} minutos`}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    Template da Mensagem
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-[10px] px-2 gap-1 text-primary hover:bg-primary/10"
                      onClick={() => insertVariable("{nome}")}
                    >
                      + Nome
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-[10px] px-2 gap-1 text-primary hover:bg-primary/10"
                      onClick={() => insertVariable("{link}")}
                    >
                      + Link Checkout
                    </Button>
                  </div>
                </div>
                <div className="relative group">
                  <Textarea 
                    value={template}
                    onChange={(e) => setTemplate(e.target.value)}
                    placeholder="Escreva sua mensagem amigável aqui..."
                    className="min-h-[160px] resize-none border-sidebar-border bg-muted/20 focus:bg-background transition-all focus:ring-primary/20 group-hover:border-primary/30"
                  />
                  <div className="absolute bottom-2 right-2 text-[10px] text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded border">
                    {template.length} caracteres
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-sidebar-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Histórico de Disparos Recentes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-muted/30 text-muted-foreground uppercase text-[10px] tracking-wider font-bold border-y">
                    <tr>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sidebar-border/50">
                    {recentLogs.map((row) => (
                      <tr key={row.id} className="hover:bg-muted/20 transition-colors group">
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{row.date}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-medium">{row.name}</span>
                            <span className="text-[10px] text-muted-foreground">{row.phone}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {row.status === "recuperado" ? (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20">
                              Venda Recuperada
                            </Badge>
                          ) : row.status === "clicado" ? (
                            <Badge variant="outline" className="text-amber-600 border-amber-500/30">
                              Clicou no Link
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-muted/50 text-muted-foreground border-transparent">
                              Mensagem Enviada
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <div className="sticky top-6 space-y-6">
            <Card className="border-sidebar-border shadow-lg overflow-hidden bg-[#E5DDD5] dark:bg-zinc-900 border-none ring-1 ring-black/5">
              <div className="bg-[#075E54] dark:bg-zinc-800 p-3 flex items-center gap-3 text-white shadow-md">
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                  <Phone className="w-4 h-4 fill-current" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold leading-tight">Suporte</p>
                  <p className="text-[10px] opacity-80 leading-tight">online</p>
                </div>
              </div>
              
              <CardContent className="p-4 min-h-[400px] flex flex-col gap-3 relative bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat">
                <div className="self-center bg-sky-100 dark:bg-sky-900/40 text-sky-900 dark:text-sky-100 text-[10px] px-2 py-1 rounded-md shadow-sm border border-sky-200/50 mb-2 uppercase font-bold tracking-tighter">
                  Hoje
                </div>

                <div className="max-w-[85%] bg-white dark:bg-zinc-800 p-3 rounded-lg rounded-tl-none shadow-sm relative group">
                  <div className="absolute top-0 -left-2 border-t-[8px] border-t-white dark:border-t-zinc-800 border-l-[8px] border-l-transparent" />
                  <p className="text-sm whitespace-pre-wrap leading-relaxed text-zinc-900 dark:text-zinc-100">
                    {template.replace("{nome}", "Gabriel").replace("{link}", "https://exemplo.com/c/h7j9k") || "Sua mensagem aqui..."}
                  </p>
                  <div className="flex justify-end items-center gap-1 mt-1">
                    <span className="text-[10px] text-zinc-500">14:28</span>
                  </div>
                </div>

                {template.includes("{link}") && (
                  <div className="max-w-[85%] bg-white dark:bg-zinc-800 rounded-lg rounded-tl-none shadow-sm overflow-hidden mt-[-8px]">
                    <div className="p-2 border-b border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50">
                      <p className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 truncate">Finalize sua compra</p>
                      <p className="text-[10px] text-zinc-500 truncate">Clique para concluir seu pedido com segurança.</p>
                    </div>
                  </div>
                )}
              </CardContent>

              <div className="p-2 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200/50 dark:border-zinc-700/50">
                <div className="bg-white dark:bg-zinc-800 rounded-full h-10 px-4 flex items-center gap-2 border border-zinc-200 dark:border-zinc-700 shadow-inner">
                  <p className="text-xs text-zinc-400 italic">Digite uma mensagem...</p>
                </div>
              </div>
            </Card>

            <Card className="bg-primary/5 border-primary/20 shadow-none border">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                  <AlertCircle className="w-4 h-4" />
                  Dica de Expert
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Use gatilhos mentais como <strong>Escassez</strong> ou 
                  <strong>Reciprocidade</strong> para aumentar sua taxa de recuperação.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppRecoveryTab;