import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { ExternalLink } from "lucide-react";
import IntegrationCard from "./IntegrationCard";
import utmifyLogo from "@/assets/utmify-logo.png";

const UTMIFY_EVENTS = [
  { key: "waiting_payment", label: "PIX/Boleto gerado" },
  { key: "paid", label: "Pagamento confirmado" },
  { key: "refunded", label: "Reembolso processado" },
  { key: "chargedback", label: "Contestação de compra" },
];

const UtmifyIntegration = () => {
  const { user } = useAuth();
  const [token, setToken] = useState("");
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [exists, setExists] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    loadIntegration();
  }, [user?.id]);

  const loadIntegration = async () => {
    const { data } = await supabase
      .from("utmify_integrations" as any)
      .select("*")
      .eq("user_id", user!.id)
      .maybeSingle();

    if (data) {
      setToken((data as any).token || "");
      setActive((data as any).active || false);
      setExists(true);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!user?.id) return;
    if (!token.trim()) {
      toast.error("Insira o token da API da UTMify");
      return;
    }

    setSaving(true);

    if (exists) {
      const { error } = await supabase
        .from("utmify_integrations" as any)
        .update({ token: token.trim(), active, updated_at: new Date().toISOString() } as any)
        .eq("user_id", user.id);
      if (error) toast.error("Erro ao salvar");
      else toast.success("Integração UTMify atualizada!");
    } else {
      const { error } = await supabase
        .from("utmify_integrations" as any)
        .insert({ user_id: user.id, token: token.trim(), active } as any);
      if (error) toast.error("Erro ao salvar");
      else {
        toast.success("Integração UTMify configurada!");
        setExists(true);
      }
    }

    setSaving(false);
  };

  const handleTestConnection = async () => {
    if (!user?.id || !token.trim()) return;
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("utmify-notify", {
        body: { event: "test_connection", user_id: user.id },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success("✅ Conexão com UTMify funcionando!");
      } else {
        toast.error("❌ UTMify retornou erro: " + (data?.error || `Status ${data?.status}`));
      }
    } catch (err: any) {
      toast.error("Erro ao testar: " + err.message);
    }
    setTesting(false);
  };

  // Render immediately — loading only affects background data hydration, not the card visibility

  return (
    <IntegrationCard
      logo={utmifyLogo}
      cardLogo={utmifyLogo}
      name="UTMify"
      description="Envie dados de vendas automaticamente para rastreamento de UTMs e atribuição de campanhas."
      docsUrl="https://docs.utmify.com.br"
      docsLabel="docs.utmify.com.br"
      active={active}
      hasToken={!!token}
      token={token}
      onTokenChange={setToken}
      onActiveChange={setActive}
      onSave={handleSave}
      saving={saving}
      tokenPlaceholder="Cole aqui a credencial de API da UTMify"
      tokenHint={
        <>
          Acesse{" "}
          <a
            href="https://app.utmify.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-0.5"
          >
            app.utmify.com.br <ExternalLink className="w-2.5 h-2.5" />
          </a>
          , vá em Integrações → Webhooks → Credenciais de API e copie o token.
        </>
      }
      statusEvents={UTMIFY_EVENTS}
      onTestConnection={handleTestConnection}
      testing={testing}
      loading={loading}
    />
  );
};

export default UtmifyIntegration;
