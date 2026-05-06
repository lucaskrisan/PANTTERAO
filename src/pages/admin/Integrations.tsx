import { useEffect } from "react";
import AppSellIntegration from "@/components/admin/AppSellIntegration";
import UtmifyIntegration from "@/components/admin/UtmifyIntegration";
import GatFlowIntegration from "@/components/admin/GatFlowIntegration";
import webhookLogo from "@/assets/webhook-logo.png";
import appsellCardLogo from "@/assets/appsell-logo.png";
import utmifyLogo from "@/assets/utmify-logo.png";
import { useNavigate } from "react-router-dom";

const PRELOAD_ICONS = [webhookLogo, appsellCardLogo, utmifyLogo];

const Integrations = () => {
  useEffect(() => {
    PRELOAD_ICONS.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Apps</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Conecte plataformas externas para automatizar a entrega e gestão dos seus produtos
        </p>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
        <button
          onClick={() => navigate("/admin/webhooks")}
          className="group relative flex items-center justify-center rounded-xl border border-border/40 bg-white p-10 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 cursor-pointer h-40"
        >
          <img src={webhookLogo} alt="Webhooks" width={220} height={80} loading="eager" decoding="async" className="max-h-20 max-w-[220px] object-contain" />
        </button>

        <AppSellIntegration />
        <UtmifyIntegration />
        <GatFlowIntegration />
      </div>
    </div>
  );
};

export default Integrations;
