import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { ExternalLink, Rocket, ArrowRight } from "lucide-react";
import IntegrationCard from "./IntegrationCard";
import { Button } from "@/components/ui/button";

const GATFLOW_LOGO = "https://rmetppilvfrxosvxzhgj.supabase.co/storage/v1/object/public/message-attachments/52e9fb3f-30ef-489f-aa32-1375e513410c/1777909775517_7fvwot_WhatsApp_Image_2026-05-03_at_14.08.19.jpeg";

const GatFlowIntegration = () => {
  const { user } = useAuth();
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [exists, setExists] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    loadIntegration();
  }, [user?.id]);

  const loadIntegration = async () => {
    const { data } = await supabase
      .from("gatflow_integrations")
      .select("*")
      .eq("user_id", user!.id)
      .maybeSingle();

    if (data) {
      setActive(data.active || false);
      setExists(true);
    }
    setLoading(false);
  };

  const handleInstall = async () => {
    if (!user?.id) return;
    setInstalling(true);
    
    try {
      // 1. Mark as installed/active in local DB first or via trigger
      const { error } = exists 
        ? await supabase.from("gatflow_integrations").update({ active: true, updated_at: new Date().toISOString() }).eq("user_id", user.id)
        : await supabase.from("gatflow_integrations").insert({ user_id: user.id, active: true, shop_id: user.id });

      if (error) throw error;

      // 2. Redirect to GatFlow OAuth/Install URI
      // Redirect URI: https://app.gatflow.com.br/auth/panttera/install?code={code}&shop_id={shop_id}
      const code = crypto.randomUUID().split('-')[0]; // Mock code for now
      const installUrl = `https://app.gatflow.com.br/auth/panttera/install?code=${code}&shop_id=${user.id}`;
      
      window.open(installUrl, "_blank");
      setActive(true);
      setExists(true);
      toast.success("Iniciando instalação no GatFlow...");
    } catch (err: any) {
      toast.error("Erro ao iniciar instalação: " + err.message);
    } finally {
      setInstalling(false);
    }
  };

  const handleOpenGatFlow = async () => {
    toast.info("Gerando acesso seguro...");
    
    try {
      const { data, error } = await supabase.functions.invoke("gatflow-sso", {
        body: { shop_id: user?.id, admin_email: user?.email }
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast.error("Erro ao abrir GatFlow: " + err.message);
    }
  };

  return (
    <IntegrationCard
      logo={GATFLOW_LOGO}
      name="GatFlow"
      description="Marketplace de Apps para automação de marketing e vendas."
      docsUrl="https://app.gatflow.com.br/"
      docsLabel="Página Inicial"
      active={active}
      hasToken={exists} // If record exists, we consider it "configured" via OAuth
      token={user?.id || ""}
      onTokenChange={() => {}}
      onActiveChange={setActive}
      onSave={() => {}}
      saving={false}
      loading={loading}
      onCardClick={() => {
        if (active) {
          handleOpenGatFlow();
        } else {
          handleInstall();
        }
      }}
      extraFields={
        <div className="space-y-4">
          {!active ? (
            <Button 
              onClick={handleInstall}
              disabled={installing}
              className="w-full gap-2 text-xs h-9 bg-primary hover:bg-primary/90"
            >
              {installing ? "Instalando..." : "Instalar GatFlow"}
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          ) : (
            <Button 
              onClick={handleOpenGatFlow}
              className="w-full gap-2 text-xs h-9"
              variant="secondary"
            >
              <Rocket className="w-3.5 h-3.5" />
              Acessar GatFlow (SSO)
            </Button>
          )}
        </div>
      }
    />
  );
};

export default GatFlowIntegration;