// @ts-nocheck
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare, ShoppingCart, CreditCard, QrCode, Send, UserPlus, Shield, Users, AlertTriangle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const FEATURES = [
  { key: "confirmacao", label: "Confirmação de Pagamento", description: "Envia mensagem automática quando o pagamento é confirmado.", icon: CreditCard },
  { key: "boas_vindas", label: "Boas-vindas", description: "Mensagem de boas-vindas para novos clientes.", icon: UserPlus },
  { key: "abandono", label: "Recuperação de Carrinho", description: "Envio automático para carrinhos abandonados.", icon: ShoppingCart },
  { key: "lembrete_pix", label: "Lembrete PIX", description: "Lembrete automático para PIX pendentes.", icon: QrCode },
  { key: "acesso", label: "Entrega de Acesso", description: "Envia link de acesso por WhatsApp após a compra.", icon: Send },
  { key: "geral", label: "Geral", description: "Templates de categoria geral.", icon: MessageSquare },
];

interface FeatureFlag {
  feature: string;
  enabled: boolean;
}

interface Producer {
  id: string;
  full_name: string | null;
}

const WhatsAppFeatureFlags = () => {
  const { user, isSuperAdmin } = useAuth();
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [producers, setProducers] = useState<Producer[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string>("");

  // Fetch producers list for super admin
  useEffect(() => {
    if (!isSuperAdmin) return;
    const fetchProducers = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name");
      if (data) {
        setProducers(data as Producer[]);
        if (data.length > 0 && !selectedTenant) {
          setSelectedTenant(data[0].id);
        }
      }
    };
    fetchProducers();
  }, [isSuperAdmin]);

  const tenantId = isSuperAdmin ? selectedTenant : user?.id;

  const fetchFlags = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("whatsapp_feature_flags")
      .select("feature, enabled")
      .eq("tenant_id", tenantId);

    if (error) {
      console.error("Error fetching flags:", error);
    }

    const map: Record<string, boolean> = {};
    for (const f of FEATURES) map[f.key] = false;
    for (const row of (data || []) as FeatureFlag[]) {
      map[row.feature] = row.enabled;
    }
    setFlags(map);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  const toggleFeature = async (feature: string, enabled: boolean) => {
    if (!tenantId) return;
    setToggling(feature);
    const { error } = await supabase
      .from("whatsapp_feature_flags")
      .upsert(
        { tenant_id: tenantId, feature, enabled, updated_at: new Date().toISOString() },
        { onConflict: "tenant_id,feature" }
      );

    if (error) {
      toast.error("Erro ao atualizar configuração");
      console.error(error);
    } else {
      setFlags((prev) => ({ ...prev, [feature]: enabled }));
      toast.success(`${enabled ? "Ativado" : "Desativado"}: ${FEATURES.find((f) => f.key === feature)?.label}`);
    }
    setToggling(null);
  };

  if (!isSuperAdmin) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Automações WhatsApp
            <Badge variant="outline" className="ml-2 text-xs">Super Admin</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedTenant} onValueChange={setSelectedTenant}>
              <SelectTrigger className="w-[220px] h-9 text-xs">
                <SelectValue placeholder="Selecione um produtor" />
              </SelectTrigger>
              <SelectContent>
                {producers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name || p.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-sm text-muted-foreground mb-4">
          Ative ou desative cada automação para o produtor selecionado. As mensagens só serão enviadas se o produtor tiver WhatsApp conectado e um template ativo na categoria correspondente.
        </p>

        {!loading && (() => {
          const enabledCount = Object.values(flags).filter(Boolean).length;
          const total = FEATURES.length;
          if (enabledCount === 0 && selectedTenant) {
            return (
              <div className="flex items-start gap-3 p-3 mb-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  Nenhuma automação ativa para este produtor. Ative ao menos uma para começar a enviar mensagens.
                </p>
              </div>
            );
          }
          return (
            <div className="flex items-center gap-2 mb-4 text-xs">
              <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:text-emerald-300">
                {enabledCount} de {total} ativas
              </Badge>
            </div>
          );
        })()}

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          FEATURES.map((f) => {
            const Icon = f.icon;
            const isEnabled = flags[f.key] ?? false;
            const isToggling = toggling === f.key;

            return (
              <div
                key={f.key}
                className="flex items-center gap-4 rounded-xl border border-border/60 bg-card/80 px-4 py-3"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold/20 bg-gold/10 text-gold shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground">{f.label}</p>
                  <p className="text-xs text-muted-foreground">{f.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  {isToggling && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) => toggleFeature(f.key, checked)}
                    disabled={isToggling || !selectedTenant}
                  />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};

export default WhatsAppFeatureFlags;
