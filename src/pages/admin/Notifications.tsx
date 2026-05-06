import { useState, useEffect, useRef } from "react";
import { playNotificationSound } from "@/lib/notificationSounds";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Clock, Sparkles, FileText, TrendingUp, Loader2, Smartphone, Volume2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface NotifSettings {
  send_pending: boolean;
  send_approved: boolean;
  send_abandoned_cart: boolean;
  whatsapp_pix_reminder: boolean;
  email_pix_reminder: boolean;
  show_value: string;
  show_product_name: boolean;
  show_utm_campaign: boolean;
  show_dashboard_name: boolean;
  notification_pattern: string;
  notification_sound: string;
  report_08: boolean;
  report_12: boolean;
  report_18: boolean;
  report_23: boolean;
  product_whitelist: string[] | null;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

const NOTIFICATION_SOUNDS = [
  { value: "kaching", label: "Ka-ching! 💰", emoji: "💰" },
  { value: "coin", label: "Moeda", emoji: "🪙" },
  { value: "cash", label: "Dinheiro", emoji: "💵" },
  { value: "bell", label: "Sino", emoji: "🔔" },
  { value: "success", label: "Sucesso", emoji: "✅" },
  { value: "magic", label: "Mágica", emoji: "✨" },
  { value: "pop", label: "Pop", emoji: "🎵" },
  { value: "none", label: "Sem som", emoji: "🔇" },
];

const defaultSettings: NotifSettings = {
  send_pending: false,
  send_approved: true,
  send_abandoned_cart: true,
  whatsapp_pix_reminder: true,
  email_pix_reminder: true,
  show_value: "commission",
  show_product_name: false,
  show_utm_campaign: false,
  show_dashboard_name: false,
  notification_pattern: "creative",
  notification_sound: "kaching",
  report_08: false,
  report_12: false,
  report_18: false,
  report_23: false,
  product_whitelist: null,
  quiet_hours_enabled: false,
  quiet_hours_start: "22:00",
  quiet_hours_end: "08:00",
};

const Notifications = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotifSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [products, setProducts] = useState<{id: string, name: string}[]>([]);

  const sendTestNotification = async () => {
    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-push');
      if (error) throw error;
      const errors = data?.onesignal?.errors || data?.errors;
      if (!data?.success || errors) {
        const message = Array.isArray(errors) ? errors.join(" ") : "";
        toast.error(
          message.includes("not subscribed")
            ? "Nenhum dispositivo inscrito. Reabra o PWA e permita as notificações."
            : "Não foi possível entregar o push de teste."
        );
      } else {
        toast.success("Notificação de teste enviada! 🔔");
      }
      // Play selected sound locally too
      playNotificationSound(settings.notification_sound);
    } catch (err: any) {
      toast.error("Erro ao enviar teste: " + (err.message || "Tente novamente"));
    } finally {
      setSendingTest(false);
    }
  };

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ data }, { data: prods }] = await Promise.all([
        supabase
          .from("notification_settings")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("products")
          .select("id, name")
          .eq("user_id", user.id)
          .eq("active", true)
      ]);

      if (prods) setProducts(prods);

      if (data) {
        setSettings({
          send_pending: data.send_pending,
          send_approved: data.send_approved,
          send_abandoned_cart: data.send_abandoned_cart ?? true,
          whatsapp_pix_reminder: data.whatsapp_pix_reminder ?? true,
          email_pix_reminder: data.email_pix_reminder ?? true,
          show_value: data.show_value,
          show_product_name: data.show_product_name,
          show_utm_campaign: data.show_utm_campaign,
          show_dashboard_name: data.show_dashboard_name,
          notification_pattern: data.notification_pattern,
          notification_sound: data.notification_sound || 'kaching',
          report_08: data.report_08,
          report_12: data.report_12,
          report_18: data.report_18,
          report_23: data.report_23,
          product_whitelist: data.product_whitelist || null,
          quiet_hours_enabled: data.quiet_hours_enabled ?? false,
          quiet_hours_start: data.quiet_hours_start || "22:00",
          quiet_hours_end: data.quiet_hours_end || "08:00",
        });
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("notification_settings")
      .upsert(
        { user_id: user.id, ...settings, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );

    if (error) {
      toast.error("Erro ao salvar configurações");
    } else {
      toast.success("Configurações salvas!");
    }
    setSaving(false);
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsInstalled(true);
        toast.success("App instalado com sucesso!");
      }
      setDeferredPrompt(null);
    }
  };

  const update = (key: keyof NotifSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const previewMessage = () => {
    if (settings.notification_pattern === "profit") {
      return { title: "Venda aprovada!", body: `Comissão: R$ 84,90` };
    }
    if (settings.notification_pattern === "detailed") {
      return {
        title: "💰 Nova venda!",
        body: `Produto XYZ • PIX • R$ 197,00\nCliente: João Silva`,
      };
    }
    // creative
    return {
      title: "🎉 Ka-ching! Mais uma venda!",
      body: `Caiu R$ 84,90 na conta! 🔥`,
    };
  };

  const preview = previewMessage();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground">Notificações</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={sendTestNotification} disabled={sendingTest}>
            {sendingTest ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            Enviar Teste
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Salvar
          </Button>
        </div>
      </div>

      {/* Install PWA */}
      {!isInstalled && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Smartphone className="w-8 h-8 text-primary" />
              <div>
                <p className="font-semibold text-foreground">Instalar App no Celular</p>
                <p className="text-sm text-muted-foreground">
                  Instale o PanteraPay como app para receber notificações push no celular.
                </p>
              </div>
            </div>
            {deferredPrompt ? (
              <Button onClick={handleInstall} className="shrink-0">
                Instalar App
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground shrink-0 max-w-[200px] text-right">
                Abra <strong>app.panttera.com.br</strong> no celular → Menu → "Adicionar à tela inicial"
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Notificações de Venda */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Notificações de Venda
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Seja notificado no app sempre que for realizada uma nova venda:
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <h3 className="font-semibold text-foreground">Opções</h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">Vendas Pendentes (PIX)</Label>
                  <p className="text-[10px] text-muted-foreground">Notificar quando um PIX for gerado</p>
                </div>
                <Switch
                  checked={settings.send_pending}
                  onCheckedChange={(v) => update("send_pending", v)}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-card/50 border-primary/20">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">Vendas Aprovadas</Label>
                  <p className="text-[10px] text-muted-foreground">Notificar quando o pagamento for confirmado</p>
                </div>
                <Switch
                  checked={settings.send_approved}
                  onCheckedChange={(v) => update("send_approved", v)}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">Carrinho Abandonado</Label>
                  <p className="text-[10px] text-muted-foreground">Notificar quando um cliente sair sem pagar</p>
                </div>
                <Switch
                  checked={settings.send_abandoned_cart}
                  onCheckedChange={(v) => update("send_abandoned_cart", v)}
                />
              </div>

              <div className="pt-4 border-t space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Remediação Automática</h4>
                
                <div className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      Lembrete PIX (WhatsApp)
                      <Badge variant="secondary" className="h-4 px-1 text-[8px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">WhatsApp</Badge>
                    </Label>
                    <p className="text-[10px] text-muted-foreground">Enviar lembrete automático se o PIX não for pago</p>
                  </div>
                  <Switch
                    checked={settings.whatsapp_pix_reminder}
                    onCheckedChange={(v) => update("whatsapp_pix_reminder", v)}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-semibold">Lembrete PIX (E-mail)</Label>
                    <p className="text-[10px] text-muted-foreground">Enviar lembrete via e-mail para pagamentos pendentes</p>
                  </div>
                  <Switch
                    checked={settings.email_pix_reminder}
                    onCheckedChange={(v) => update("email_pix_reminder", v)}
                  />
                </div>
              </div>

              <div className="pt-4 border-t space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Detalhes da Notificação</h4>
                
                <div className="space-y-2">
                  <Label className="text-xs">Valor da venda</Label>
                  <Select value={settings.show_value} onValueChange={(v) => update("show_value", v)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="commission">Comissão (Líquido)</SelectItem>
                      <SelectItem value="full">Valor bruto</SelectItem>
                      <SelectItem value="hidden">Ocultar valor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Nome do produto</Label>
                    <Select
                      value={settings.show_product_name ? "show" : "hide"}
                      onValueChange={(v) => update("show_product_name", v === "show")}
                    >
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hide">Ocultar</SelectItem>
                        <SelectItem value="show">Mostrar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">UTM Campaign</Label>
                    <Select
                      value={settings.show_utm_campaign ? "show" : "hide"}
                      onValueChange={(v) => update("show_utm_campaign", v === "show")}
                    >
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hide">Ocultar</SelectItem>
                        <SelectItem value="show">Mostrar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Sound Selector */}
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-primary" />
                Som da Notificação
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {NOTIFICATION_SOUNDS.map((sound) => (
                  <button
                    key={sound.value}
                    type="button"
                    onClick={() => {
                      update("notification_sound", sound.value);
                      playNotificationSound(sound.value);
                    }}
                    className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition-colors cursor-pointer ${
                      settings.notification_sound === sound.value
                        ? "border-primary bg-primary/5 font-medium"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <span className="text-lg">{sound.emoji}</span>
                    <span>{sound.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Prévia de Notificação</Label>
              <div className="bg-muted rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                  <Bell className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-foreground">{preview.title}</p>
                  <p className="text-xs text-muted-foreground whitespace-pre-line">{preview.body}</p>
                </div>
              </div>
            </div>

            {/* Link to PWA Settings */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Personalizar texto e ícone da notificação</p>
                  <p className="text-xs text-muted-foreground">Edite o template da push notification, ícone e splash screen do app</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => window.location.href = '/admin/pwa'}>
                Configurar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Horário de Silêncio e Filtros */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Horário de Silêncio
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Evite ser incomodado em horários específicos:
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">Habilitar Silêncio</Label>
                  <p className="text-[10px] text-muted-foreground">Não receber push nestes horários</p>
                </div>
                <Switch
                  checked={settings.quiet_hours_enabled}
                  onCheckedChange={(v) => update("quiet_hours_enabled", v)}
                />
              </div>

              {settings.quiet_hours_enabled && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Início</Label>
                    <Input 
                      type="time" 
                      value={settings.quiet_hours_start} 
                      onChange={(e) => update("quiet_hours_start", e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Fim</Label>
                    <Input 
                      type="time" 
                      value={settings.quiet_hours_end} 
                      onChange={(e) => update("quiet_hours_end", e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Filtro por Produto
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Receba notificações apenas dos produtos selecionados:
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Filtrar produtos?</Label>
                  <Switch
                    checked={settings.product_whitelist !== null}
                    onCheckedChange={(v) => update("product_whitelist", v ? [] : null)}
                  />
                </div>

                {settings.product_whitelist !== null && (
                  <div className="space-y-2 pt-2">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Selecione os produtos:</p>
                    <div className="max-h-[200px] overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                      {products.map(p => (
                        <div key={p.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 transition-colors">
                          <Switch 
                            checked={settings.product_whitelist?.includes(p.id)}
                            onCheckedChange={(v) => {
                              const current = settings.product_whitelist || [];
                              const next = v ? [...current, p.id] : current.filter(id => id !== p.id);
                              update("product_whitelist", next);
                            }}
                            className="scale-75"
                          />
                          <span className="text-xs truncate">{p.name}</span>
                        </div>
                      ))}
                      {products.length === 0 && (
                        <p className="text-xs text-muted-foreground italic text-center py-4">Nenhum produto ativo encontrado.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Notificações de Relatório */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Notificações de Relatório
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Configure as notificações de relatório que quer visualizar:
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <h3 className="font-semibold text-foreground">Horários</h3>

            <div className="space-y-4">
              {[
                { key: "report_08" as const, label: "Notificação das 08:00" },
                { key: "report_12" as const, label: "Notificação das 12:00" },
                { key: "report_18" as const, label: "Notificação das 18:00" },
                { key: "report_23" as const, label: "Notificação das 23:00" },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between">
                  <Label>{item.label}</Label>
                  <Switch
                    checked={settings[item.key]}
                    onCheckedChange={(v) => update(item.key, v)}
                  />
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">Padrão de Notificação</h3>
              <RadioGroup
                value={settings.notification_pattern}
                onValueChange={(v) => update("notification_pattern", v)}
                className="space-y-2"
              >
                <label
                  className={`flex items-center gap-3 rounded-xl border p-4 cursor-pointer transition-colors ${
                    settings.notification_pattern === "profit"
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <RadioGroupItem value="profit" />
                  <TrendingUp className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Status de Lucro</span>
                </label>
                <label
                  className={`flex items-center gap-3 rounded-xl border p-4 cursor-pointer transition-colors ${
                    settings.notification_pattern === "detailed"
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <RadioGroupItem value="detailed" />
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Resumo Detalhado</span>
                </label>
                <label
                  className={`flex items-center gap-3 rounded-xl border p-4 cursor-pointer transition-colors ${
                    settings.notification_pattern === "creative"
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <RadioGroupItem value="creative" />
                  <Sparkles className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Notificações Criativas</span>
                </label>
              </RadioGroup>
            </div>

            {/* Report Preview */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Prévia de Notificação</Label>
              {settings.report_08 || settings.report_12 || settings.report_18 || settings.report_23 ? (
                <div className="bg-muted rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-foreground">📊 Relatório do dia</p>
                    <p className="text-xs text-muted-foreground">Vendas: 12 • Faturamento: R$ 2.364,00</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Prévia indisponível. Habilite ao menos um horário de notificação para visualizar a prévia.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Notifications;
