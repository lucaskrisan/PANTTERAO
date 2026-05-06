import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Facebook, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

const integrations = [
  {
    name: "Facebook Ads",
    description: "Configure o Pixel ID e Access Token do Facebook Ads para rastrear conversões via Pixel + Conversion API.",
    icon: <Facebook className="w-8 h-8 text-blue-500" />,
    link: "/admin/tracking",
  },
  {
    name: "Google Ads",
    description: "Configure o Conversion ID e Label do Google Ads para rastrear conversões via gtag.js.",
    icon: <div className="w-8 h-8 flex items-center justify-center text-lg font-bold text-yellow-500">G</div>,
    link: null,
  },
  {
    name: "TikTok Ads",
    description: "Configure o Pixel ID do TikTok para rastrear conversões e otimizar suas campanhas.",
    icon: <div className="w-8 h-8 flex items-center justify-center text-lg font-bold text-foreground">T</div>,
    link: null,
  },
  {
    name: "UTMify",
    description: "O UTMify é uma plataforma de rastreamento de conversões que permite acompanhar suas vendas e otimizar campanhas.",
    icon: <div className="w-8 h-8 flex items-center justify-center text-lg font-bold text-purple-500">U</div>,
    link: null,
  },
];

const Metrics = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Métricas</h1>
        <p className="text-sm text-muted-foreground mt-1">Rastreamento e Conversões</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map((item) => (
          <Card key={item.name} className="border-border/50 hover:border-primary/30 transition-colors">
            <CardContent className="p-5 flex flex-col h-full">
              <div className="mb-3">{item.icon}</div>
              <h3 className="text-sm font-semibold text-foreground mb-1">{item.name}</h3>
              <p className="text-xs text-muted-foreground flex-1 mb-4">{item.description}</p>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => item.link && navigate(item.link)}
                disabled={!item.link}
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                {item.link ? "Configurar" : "Em breve"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Metrics;
