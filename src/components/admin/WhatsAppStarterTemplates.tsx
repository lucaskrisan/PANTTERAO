// @ts-nocheck
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  UserPlus,
  QrCode,
  ShoppingCart,
  Package,
  Star,
  Loader2,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

interface StarterTemplate {
  name: string;
  category: string;
  body: string;
  icon: any;
  description: string;
}

const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    name: "Compra Confirmada",
    category: "confirmacao",
    body: "🎉 *{nome}*, seu acesso ao *{produto}* está liberado!\n\nClique no link abaixo para acessar agora:\n👉 {link}\n\nQualquer dúvida é só responder essa mensagem. 🙌",
    icon: UserPlus,
    description: "Enviado automaticamente quando o pagamento é aprovado",
  },
  {
    name: "Lembrete PIX",
    category: "lembrete_pix",
    body: "⚠️ Oi, *{nome}*! Seu PIX de *R$ {valor}* para o *{produto}* ainda não foi identificado.\n\nSe já pagou, aguarde alguns minutos. Se ainda não pagou, acesse o link abaixo para gerar um novo código:\n👉 {link}\n\nO acesso é liberado automaticamente após a confirmação. 💳",
    icon: QrCode,
    description: "Lembrete automático para PIX pendente após 30 minutos",
  },
  {
    name: "Carrinho Abandonado",
    category: "abandono",
    body: "👋 Oi, *{nome}*! Você quase garantiu o *{produto}*.\n\nSua vaga ainda está reservada por tempo limitado. Finalize agora:\n👉 {link}\n\nQualquer dúvida estou aqui! 😊",
    icon: ShoppingCart,
    description: "Recuperação de carrinhos abandonados via WhatsApp",
  },
  {
    name: "Pós-venda",
    category: "geral",
    body: "Olá, *{nome}*! Tudo certo com seu acesso ao *{produto}*?\n\nSe tiver qualquer dificuldade para entrar, acesse por aqui:\n👉 {link}\n\nEstamos à disposição! 🚀",
    icon: Package,
    description: "Follow-up enviado 3 dias após a compra",
  },
  {
    name: "Avaliação",
    category: "geral",
    body: "⭐ *{nome}*, o que você achou do *{produto}*?\n\nSua opinião nos ajuda muito a melhorar. Leva menos de 1 minuto:\n👉 {link}\n\nObrigado pela confiança! 🙏",
    icon: Star,
    description: "Solicita avaliação após período de uso do produto",
  },
];

const WhatsAppStarterTemplates = () => {
  const { user } = useAuth();
  const [installing, setInstalling] = useState<string | null>(null);
  const [installed, setInstalled] = useState<Set<string>>(new Set());

  const extractVariables = (text: string) => {
    const matches = text.match(/\{[a-z_]+\}/g);
    return matches ? [...new Set(matches)] : [];
  };

  const handleInstall = async (template: StarterTemplate) => {
    if (!user) return;
    setInstalling(template.name);

    try {
      const { error } = await supabase.from("whatsapp_templates").insert({
        name: template.name,
        category: template.category,
        body: template.body,
        active: true,
        user_id: user.id,
        variables: extractVariables(template.body),
        flow_nodes: [],
      });

      if (error) throw error;
      setInstalled((prev) => new Set([...prev, template.name]));
      toast.success(`Template "${template.name}" instalado!`);
    } catch (err: any) {
      if (err.message?.includes("duplicate")) {
        toast.error("Template com este nome já existe");
      } else {
        toast.error("Erro ao instalar template");
      }
    } finally {
      setInstalling(null);
    }
  };

  const handleInstallAll = async () => {
    if (!user) return;
    setInstalling("all");

    const toInstall = STARTER_TEMPLATES.filter((t) => !installed.has(t.name));
    let success = 0;

    for (const template of toInstall) {
      try {
        const { error } = await supabase.from("whatsapp_templates").insert({
          name: template.name,
          category: template.category,
          body: template.body,
          active: true,
          user_id: user.id,
          variables: extractVariables(template.body),
          flow_nodes: [],
        });
        if (!error) {
          setInstalled((prev) => new Set([...prev, template.name]));
          success++;
        }
      } catch {}
    }

    if (success > 0) toast.success(`${success} templates instalados!`);
    else toast.info("Todos os templates já estão instalados");
    setInstalling(null);
  };

  return (
    <Card className="border-border/50 bg-card/50 shadow-sm overflow-hidden">
      <CardHeader className="pb-3 bg-muted/20 border-b border-border/50">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2.5 font-display">
              <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
                <Sparkles className="w-4 h-4" />
              </div>
              Biblioteca de Estratégias
            </CardTitle>
            <CardDescription>
              Templates otimizados para conversão. Instale e edite no builder.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleInstallAll}
            disabled={installing === "all" || installed.size === STARTER_TEMPLATES.length}
            className="gap-1.5 h-9"
          >
            {installing === "all" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            Instalar tudo (Recomendado)
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {STARTER_TEMPLATES.map((template) => {
            const Icon = template.icon;
            const isInstalled = installed.has(template.name);
            const isLoading = installing === template.name;

            return (
              <div
                key={template.name}
                className={`rounded-2xl border p-5 space-y-4 transition-all duration-300 ${
                  isInstalled
                    ? "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10 shadow-sm"
                    : "border-border/50 bg-background/50 hover:border-primary/40 hover:shadow-lg hover:-translate-y-1"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground leading-tight">{template.name}</h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{template.description}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-secondary/50 rounded-lg p-3 max-h-[120px] overflow-y-auto">
                  <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">{template.body}</p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {extractVariables(template.body).slice(0, 3).map((v) => (
                      <Badge key={v} variant="secondary" className="text-[10px] px-1.5 py-0">
                        {v}
                      </Badge>
                    ))}
                  </div>

                  {isInstalled ? (
                    <Badge variant="outline" className="border-emerald-400 text-emerald-600 gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Instalado
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleInstall(template)}
                      disabled={!!installing}
                      className="text-xs h-7 px-3"
                    >
                      {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Instalar"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default WhatsAppStarterTemplates;