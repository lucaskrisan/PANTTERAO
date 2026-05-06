import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Eye, EyeOff, Key, Shield } from "lucide-react";
import { toast } from "sonner";

interface ApiKeyEntry {
  label: string;
  envName: string;
  value: string;
  category: "payment" | "tracking" | "communication" | "security" | "platform";
  description: string;
}

const API_KEYS: ApiKeyEntry[] = [
  // Payment
  { label: "Asaas API Key", envName: "ASAAS_API_KEY", value: "", category: "payment", description: "Chave de API do gateway Asaas" },
  { label: "Pagar.me API Key", envName: "PAGARME_API_KEY", value: "", category: "payment", description: "Chave de API do gateway Pagar.me" },
  // Tracking
  { label: "Meta Access Token", envName: "META_ACCESS_TOKEN", value: "", category: "tracking", description: "Token de acesso à API do Meta (Facebook Ads)" },
  // Communication
  { label: "Resend API Key", envName: "RESEND_API_KEY", value: "", category: "communication", description: "Chave de API do Resend para envio de e-mails" },
  { label: "Resend Webhook Secret", envName: "RESEND_WEBHOOK_SECRET", value: "", category: "communication", description: "Secret do webhook do Resend" },
  { label: "OneSignal App ID", envName: "ONESIGNAL_APP_ID", value: "", category: "communication", description: "ID do app OneSignal para push notifications" },
  { label: "OneSignal REST API Key", envName: "ONESIGNAL_REST_API_KEY", value: "", category: "communication", description: "Chave REST API do OneSignal" },
  { label: "PushAlert API Key", envName: "PUSHALERT_API_KEY", value: "", category: "communication", description: "Chave de API do PushAlert" },
  // Security
  { label: "Turnstile Secret Key", envName: "TURNSTILE_SECRET_KEY", value: "", category: "security", description: "Chave secreta do Cloudflare Turnstile (CAPTCHA)" },
  // Platform
  { label: "Supabase Project ID", envName: "VITE_SUPABASE_PROJECT_ID", value: import.meta.env.VITE_SUPABASE_PROJECT_ID || "", category: "platform", description: "ID do projeto no backend" },
  { label: "Supabase URL", envName: "VITE_SUPABASE_URL", value: import.meta.env.VITE_SUPABASE_URL || "", category: "platform", description: "URL do backend" },
  { label: "Supabase Anon Key", envName: "VITE_SUPABASE_PUBLISHABLE_KEY", value: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "", category: "platform", description: "Chave pública (anon) do backend" },
];

const categoryLabels: Record<string, { label: string; color: string }> = {
  payment: { label: "Pagamento", color: "bg-green-500/10 text-green-500" },
  tracking: { label: "Rastreamento", color: "bg-blue-500/10 text-blue-500" },
  communication: { label: "Comunicação", color: "bg-purple-500/10 text-purple-500" },
  security: { label: "Segurança", color: "bg-orange-500/10 text-orange-500" },
  platform: { label: "Plataforma", color: "bg-muted text-muted-foreground" },
};

const ApiKeyRow = ({ entry }: { entry: ApiKeyEntry }) => {
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);
  const isSecret = !entry.value;
  const displayValue = entry.value || "(configurado via Secrets — não visível no frontend)";

  const handleCopy = () => {
    if (!entry.value) {
      toast.info("Esta chave é um secret do servidor e não pode ser copiada daqui. Acesse o painel de Secrets.");
      return;
    }
    navigator.clipboard.writeText(entry.value);
    setCopied(true);
    toast.success(`${entry.label} copiado!`);
    setTimeout(() => setCopied(false), 2000);
  };

  const cat = categoryLabels[entry.category];

  return (
    <div className="flex flex-col gap-2 p-4 border rounded-lg bg-card hover:bg-accent/5 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Key className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="font-medium text-sm truncate">{entry.label}</span>
          <Badge variant="outline" className={`text-[10px] ${cat.color}`}>{cat.label}</Badge>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {entry.value && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setVisible(!visible)}>
              {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy} disabled={isSecret}>
            {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{entry.description}</p>
      <div className="flex items-center gap-2">
        <code className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded font-mono">{entry.envName}</code>
      </div>
      <Input
        readOnly
        value={visible || !entry.value ? displayValue : "••••••••••••••••••••••••"}
        className="font-mono text-xs h-8 bg-muted/50 cursor-default"
        onClick={handleCopy}
      />
    </div>
  );
};

const ApiKeys = () => {
  const categories = ["platform", "payment", "tracking", "communication", "security"] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">API Keys & Secrets</h1>
          <p className="text-sm text-muted-foreground">
            Referência rápida de todas as chaves configuradas no projeto. Chaves do servidor (edge functions) não são visíveis aqui por segurança.
          </p>
        </div>
      </div>

      {categories.map((cat) => {
        const items = API_KEYS.filter((k) => k.category === cat);
        const catInfo = categoryLabels[cat];
        return (
          <Card key={cat}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Badge variant="outline" className={catInfo.color}>{catInfo.label}</Badge>
                <span className="text-muted-foreground text-xs">({items.length} chaves)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {items.map((entry) => (
                <ApiKeyRow key={entry.envName} entry={entry} />
              ))}
            </CardContent>
          </Card>
        );
      })}

      <Card className="border-dashed">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            💡 <strong>Dica:</strong> As chaves marcadas como "secret do servidor" são armazenadas de forma segura e só podem ser acessadas pelas edge functions. 
            Para atualizar qualquer secret, use o painel de Secrets do Lovable Cloud.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ApiKeys;
