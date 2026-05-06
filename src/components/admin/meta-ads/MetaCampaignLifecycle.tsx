import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Baby, GraduationCap, Shield, Rocket, Skull,
  TrendingUp, AlertTriangle, Zap,
} from "lucide-react";
import type { MetaCampaign } from "@/hooks/useMetaAds";
import { getResults, getCPA, getROAS } from "./MetaInsightsHelpers";

interface Props {
  campaigns: MetaCampaign[];
  healthScore: number;
}

interface LifecycleStage {
  id: string;
  campaignName: string;
  stage: "born" | "learning" | "mature" | "scaling" | "saturated";
  label: string;
  emoji: string;
  icon: React.ReactNode;
  color: string;
  description: string;
  action: string;
  results: number;
  roas: number;
  spend: number;
  cpa: number;
}

const stageStyles: Record<string, { bg: string; border: string; text: string; bar: string }> = {
  born: { bg: "bg-purple-500/10", border: "border-purple-500/30", text: "text-purple-400", bar: "bg-purple-500" },
  learning: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400", bar: "bg-blue-500" },
  mature: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", bar: "bg-emerald-500" },
  scaling: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400", bar: "bg-amber-500" },
  saturated: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-400", bar: "bg-red-500" },
};

function getLifecycleStage(c: MetaCampaign): LifecycleStage {
  const spend = parseFloat(c.insights?.spend || "0");
  const results = getResults(c.insights);
  const roas = getROAS(c.insights);
  const cpa = getCPA(c.insights);
  const ctr = parseFloat(c.insights?.ctr || "0");
  const freq = parseFloat(c.insights?.frequency || "0");

  let stage: LifecycleStage["stage"];
  let label: string;
  let emoji: string;
  let icon: React.ReactNode;
  let description: string;
  let action: string;

  if (freq > 3 || (ctr < 0.5 && spend > 30)) {
    stage = "saturated";
    label = "Saturado";
    emoji = "💀";
    icon = <Skull className="w-4 h-4" />;
    description = `Frequência ${freq.toFixed(1)} e CTR ${ctr.toFixed(2)}% — público cansou do criativo.`;
    action = "Pause e teste novos criativos ou públicos.";
  } else if (roas >= 1.5 && results >= 5) {
    stage = "scaling";
    label = "Pronto p/ Escala";
    emoji = "🚀";
    icon = <Rocket className="w-4 h-4" />;
    description = `ROAS ${roas.toFixed(2)}x com ${results} conversões — performance estável.`;
    action = "Aumente orçamento em 20% e monitore por 48h.";
  } else if (results >= 3 && roas >= 1) {
    stage = "mature";
    label = "Maduro";
    emoji = "🛡️";
    icon = <Shield className="w-4 h-4" />;
    description = `${results} conversões com ROAS ${roas.toFixed(2)}x — saiu do aprendizado.`;
    action = "Mantenha rodando. Se ROAS se mantiver 3+ dias, escale.";
  } else if (results > 0 || spend > 10) {
    stage = "learning";
    label = "Aprendizado";
    emoji = "📚";
    icon = <GraduationCap className="w-4 h-4" />;
    description = `${results}/50 conversões. Algoritmo ainda otimizando.`;
    action = "NÃO altere público, orçamento ou criativo. Aguarde 48-72h.";
  } else {
    stage = "born";
    label = "Recém-criado";
    emoji = "🐣";
    icon = <Baby className="w-4 h-4" />;
    description = "Campanha nova, coletando dados iniciais.";
    action = "Aguarde. Primeiros resultados em 24-48h.";
  }

  return { id: c.id, campaignName: c.name, stage, label, emoji, icon, color: stage, description, action, results, roas, spend, cpa };
}

function getScalingRecommendation(healthScore: number, stages: LifecycleStage[]) {
  const scalable = stages.filter((s) => s.stage === "scaling" || (s.stage === "mature" && s.roas >= 1.5));

  if (scalable.length === 0) return null;

  if (healthScore >= 80) {
    return {
      type: "aggressive" as const,
      icon: <Zap className="w-5 h-5" />,
      title: "🔥 Dia excelente — Escala agressiva liberada!",
      description: `Saúde do dia em ${healthScore}/100. ${scalable.length} campanha(s) pronta(s) para escala. Aumente 20-30% o orçamento agora. Se performar em 2-3h, aumente mais 20%.`,
      color: "emerald",
    };
  }

  if (healthScore >= 60) {
    return {
      type: "moderate" as const,
      icon: <TrendingUp className="w-5 h-5" />,
      title: "👍 Dia bom — Escala moderada",
      description: `Saúde em ${healthScore}/100. Pode aumentar orçamento em 20% nas campanhas maduras. Monitore CPA por 48h antes de escalar novamente.`,
      color: "blue",
    };
  }

  if (healthScore >= 40) {
    return {
      type: "hold" as const,
      icon: <AlertTriangle className="w-5 h-5" />,
      title: "⚠️ Dia instável — Mantenha orçamentos",
      description: `Saúde em ${healthScore}/100. Não escale hoje. Mantenha orçamentos atuais e monitore. Se piorar, considere reduzir 10-15%.`,
      color: "amber",
    };
  }

  return {
    type: "reduce" as const,
    icon: <AlertTriangle className="w-5 h-5" />,
    title: "🚨 Dia ruim — Reduza exposição",
    description: `Saúde em ${healthScore}/100. Reduza orçamentos em 15-20% ou pause campanhas com ROAS < 1. Proteja seu capital.`,
    color: "red",
  };
}

const scalingColors: Record<string, { bg: string; border: string; text: string }> = {
  emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400" },
  blue: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400" },
  amber: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400" },
  red: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-400" },
};

const progressMap: Record<string, number> = {
  born: 10,
  learning: 35,
  mature: 65,
  scaling: 85,
  saturated: 100,
};

export function MetaCampaignLifecycle({ campaigns, healthScore }: Props) {
  const stages = useMemo(() => {
    const active = campaigns.filter((c) => c.status === "ACTIVE" && c.insights);
    return active.map(getLifecycleStage);
  }, [campaigns]);

  const scaling = useMemo(() => getScalingRecommendation(healthScore, stages), [healthScore, stages]);

  if (stages.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Scaling recommendation */}
      {scaling && (
        <Card className={`${scalingColors[scaling.color].bg} border ${scalingColors[scaling.color].border} bg-[hsl(222,30%,14%)]`}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 ${scalingColors[scaling.color].text}`}>{scaling.icon}</div>
              <div>
                <h4 className="text-sm font-bold text-slate-200">{scaling.title}</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{scaling.description}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lifecycle stages */}
      <div className="grid gap-2">
        {stages.map((stage) => {
          const style = stageStyles[stage.stage];
          return (
            <Card key={stage.id} className={`${style.bg} border ${style.border} bg-[hsl(222,30%,14%)]`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  {/* Stage icon */}
                  <div className={`shrink-0 ${style.text}`}>{stage.icon}</div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-slate-200 truncate max-w-[180px]">
                        {stage.campaignName}
                      </span>
                      <Badge variant="outline" className={`text-[10px] ${style.bg} ${style.text} border-0`}>
                        {stage.emoji} {stage.label}
                      </Badge>
                      {stage.roas > 0 && (
                        <Badge variant="outline" className="text-[10px] bg-slate-700/30 text-slate-400 border-0">
                          ROAS {stage.roas.toFixed(2)}x
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">{stage.description}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">💡 {stage.action}</p>
                  </div>

                  {/* Progress bar */}
                  <div className="hidden sm:flex flex-col items-center gap-0.5 shrink-0">
                    <div className="w-2 h-14 bg-slate-700/50 rounded-full overflow-hidden relative">
                      <div
                        className={`absolute bottom-0 w-full rounded-full ${style.bar} transition-all duration-700`}
                        style={{ height: `${progressMap[stage.stage]}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-slate-600">{progressMap[stage.stage]}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 px-1">
        {Object.entries(stageStyles).map(([key, style]) => (
          <span key={key} className="text-[10px] text-slate-600 flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${style.bar}`} />
            {key === "born" ? "Nascendo" : key === "learning" ? "Aprendizado" : key === "mature" ? "Maduro" : key === "scaling" ? "Escala" : "Saturado"}
          </span>
        ))}
      </div>
    </div>
  );
}
