import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Save } from "lucide-react";

const Settings = () => {
  const [settings, setSettings] = useState({
    id: "",
    primary_color: "#22c55e",
    logo_url: "",
    company_name: "Minha Empresa",
    countdown_minutes: 15,
    show_countdown: true,
    pix_discount_percent: 5,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data } = await supabase.from("checkout_settings").select("*").limit(1).single();
    if (data) {
      setSettings({
        id: data.id,
        primary_color: data.primary_color || "#22c55e",
        logo_url: data.logo_url || "",
        company_name: data.company_name || "Minha Empresa",
        countdown_minutes: data.countdown_minutes || 15,
        show_countdown: data.show_countdown ?? true,
        pix_discount_percent: Number(data.pix_discount_percent) || 5,
      });
    }
  };

  const handleSave = async () => {
    setLoading(true);
    const { error } = await supabase
      .from("checkout_settings")
      .update({
        primary_color: settings.primary_color,
        logo_url: settings.logo_url || null,
        company_name: settings.company_name,
        countdown_minutes: settings.countdown_minutes,
        show_countdown: settings.show_countdown,
        pix_discount_percent: settings.pix_discount_percent,
        updated_at: new Date().toISOString(),
      })
      .eq("id", settings.id);

    setLoading(false);
    if (error) {
      toast.error("Erro ao salvar configurações");
    } else {
      toast.success("Configurações salvas!");
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="font-display text-2xl font-bold text-foreground">Configurações do Checkout</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-display">Identidade Visual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome da Empresa</Label>
            <Input value={settings.company_name} onChange={(e) => setSettings({ ...settings, company_name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>URL do Logo</Label>
            <Input value={settings.logo_url} onChange={(e) => setSettings({ ...settings, logo_url: e.target.value })} placeholder="https://..." />
          </div>
          <div className="space-y-1.5">
            <Label>Cor Principal</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.primary_color}
                onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                className="w-10 h-10 rounded-lg border border-border cursor-pointer"
              />
              <Input value={settings.primary_color} onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })} className="max-w-32" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-display">Comportamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Mostrar Countdown</Label>
              <p className="text-xs text-muted-foreground">Timer de urgência no topo do checkout</p>
            </div>
            <Switch checked={settings.show_countdown} onCheckedChange={(v) => setSettings({ ...settings, show_countdown: v })} />
          </div>
          <div className="space-y-1.5">
            <Label>Minutos do Countdown</Label>
            <Input type="number" value={settings.countdown_minutes} onChange={(e) => setSettings({ ...settings, countdown_minutes: parseInt(e.target.value) || 15 })} className="max-w-32" />
          </div>
          <div className="space-y-1.5">
            <Label>Desconto PIX (%)</Label>
            <Input type="number" step="0.5" value={settings.pix_discount_percent} onChange={(e) => setSettings({ ...settings, pix_discount_percent: parseFloat(e.target.value) || 0 })} className="max-w-32" />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={loading} className="gap-2">
        <Save className="w-4 h-4" /> {loading ? "Salvando..." : "Salvar Configurações"}
      </Button>
    </div>
  );
};

export default Settings;
