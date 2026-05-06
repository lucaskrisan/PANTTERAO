import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, TrendingDown, Trophy, Brain,
  ThermometerSun, Activity, Target, ShieldAlert, Rocket, Pause, Users,
} from "lucide-react";
import type { MetaCampaign } from "@/hooks/useMetaAds";
import { getResults, getCPA, getROAS, getConversionValue, formatCurrency } from "./MetaInsightsHelpers";
import { MetaCampaignLifecycle } from "./MetaCampaignLifecycle";

interface Props {
  campaigns: MetaCampaign[];
  loading: boolean;
}

interface Alert {
  id: string;
  type: "danger" | "warning" | "success" | "info";
  icon: React.ReactNode;
  title: string;
  description: string;
  campaign?: string;
  metric?: string;
}

function analyzeDayHealth(campaigns: MetaCampaign[]) {
  const active = campaigns.filter((c) => c.status === "ACTIVE" && c.insights);
  if (active.length === 0) return { score: 0, label: "Sem dados", color: "slate", emoji: "⏸️" };

  let score = 50; // base

  const totalSpend = active.reduce((s, c) => s + parseFloat(c.insights!.spend || "0"), 0);
  const totalRevenue = active.reduce((s, c) => s + getConversionValue(c.insights), 0);
  const totalResults = active.reduce((s, c) => s + getResults(c.insights), 0);
  const avgCPM = active.reduce((s, c) => s + parseFloat(c.insights!.cpm || "0"), 0) / active.length;
  const avgCTR = active.reduce((s, c) => s + parseFloat(c.insights!.ctr || "0"), 0) / active.length;
  const avgFreq = active.reduce((s, c) => s + parseFloat(c.insights!.frequency || "0"), 0) / active.length;
  const globalROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  // ROAS signals
  if (globalROAS >= 3) score += 25;
  else if (globalROAS >= 2) score += 15;
  else if (globalROAS >= 1) score += 5;
  else if (globalROAS > 0 && globalROAS < 1) score -= 15;
  else if (totalSpend > 0 && totalResults === 0) score -= 25;

  // CPM signals (high CPM = expensive auction)
  if (avgCPM > 80) score -= 15;
  else if (avgCPM > 50) score -= 5;
  else if (avgCPM < 20) score += 10;

  // CTR signals
  if (avgCTR > 2) score += 10;
  else if (avgCTR > 1) score += 5;
  else if (avgCTR < 0.5) score -= 10;

  // Frequency signals (high = saturated)
  if (avgFreq > 3) score -= 15;
  else if (avgFreq > 2) score -= 5;

  // Clamp
  score = Math.max(0, Math.min(100, score));

  if (score >= 80) return { score, label: "Dia excelente", color: "emerald", emoji: "🔥" };
  if (score >= 60) return { score, label: "Dia bom", color: "blue", emoji: "👍" };
  if (score >= 40) return { score, label: "Dia irregular", color: "amber", emoji: "⚠️" };
  if (score >= 20) return { score, label: "Dia ruim", color: "orange", emoji: "😬" };
  return { score, label: "Dia crítico", color: "red", emoji: "🚨" };
}

function generateAlerts(campaigns: MetaCampaign[]): Alert[] {
  const alerts: Alert[] = [];
  const active = campaigns.filter((c) => c.status === "ACTIVE" && c.insights);

  // Global metrics
  const totalSpend = active.reduce((s, c) => s + parseFloat(c.insights!.spend || "0"), 0);
  const totalResults = active.reduce((s, c) => s + getResults(c.insights), 0);
  const avgCPM = active.length > 0 ? active.reduce((s, c) => s + parseFloat(c.insights!.cpm || "0"), 0) / active.length : 0;
  const avgFreq = active.length > 0 ? active.reduce((s, c) => s + parseFloat(c.insights!.frequency || "0"), 0) / active.length : 0;

  // High CPM alert (expensive auction day)
  if (avgCPM > 60) {
    alerts.push({
      id: "high-cpm",
      type: "warning",
      icon: <ThermometerSun className="w-5 h-5" />,
      title: "Leilão caro hoje",
      description: `CPM médio em ${formatCurrency(avgCPM)} — o leilão está competitivo. Isso pode indicar alta concorrência ou público saturado. Considere pausar campanhas com baixo CTR.`,
      metric: `CPM: ${formatCurrency(avgCPM)}`,
    });
  }

  // High frequency alert
  if (avgFreq > 2.5) {
    alerts.push({
      id: "high-freq",
      type: "warning",
      icon: <Activity className="w-5 h-5" />,
      title: "Frequência alta — público saturando",
      description: `Frequência média em ${avgFreq.toFixed(2)}. Seu público está vendo os anúncios muitas vezes. Teste novos públicos ou criativos para evitar fadiga.`,
      metric: `Freq: ${avgFreq.toFixed(2)}`,
    });
  }

  // Spending without results
  if (totalSpend > 50 && totalResults === 0) {
    alerts.push({
      id: "no-results",
      type: "danger",
      icon: <ShieldAlert className="w-5 h-5" />,
      title: "Gastando sem resultados",
      description: `Já gastou ${formatCurrency(totalSpend)} sem nenhuma conversão. Revise criativos, público-alvo e página de destino.`,
      metric: `Gasto: ${formatCurrency(totalSpend)}`,
    });
  }

  // Per-campaign alerts
  for (const c of active) {
    const spend = parseFloat(c.insights!.spend || "0");
    const results = getResults(c.insights);
    const cpa = getCPA(c.insights);
    const roas = getROAS(c.insights);
    const ctr = parseFloat(c.insights!.ctr || "0");
    const freq = parseFloat(c.insights!.frequency || "0");
    const cpm = parseFloat(c.insights!.cpm || "0");
    const reach = parseInt(c.insights!.reach || "0", 10);
    const impressions = parseInt(c.insights!.impressions || "0", 10);

    // 🚨 AUDIENCE SATURATION DETECTION (multi-signal)
    const saturationSignals: string[] = [];
    let saturationScore = 0;

    if (freq > 3) { saturationSignals.push(`Freq ${freq.toFixed(2)} (>3)`); saturationScore += 30; }
    else if (freq > 2) { saturationSignals.push(`Freq ${freq.toFixed(2)} (>2)`); saturationScore += 15; }

    if (ctr < 0.6 && spend > 10) { saturationSignals.push(`CTR ${ctr.toFixed(2)}% (baixo)`); saturationScore += 25; }

    if (cpm > 70) { saturationSignals.push(`CPM ${formatCurrency(cpm)} (alto)`); saturationScore += 20; }

    if (roas > 0 && roas < 0.8 && spend > 20) { saturationSignals.push(`ROAS ${roas.toFixed(2)}x (caindo)`); saturationScore += 25; }

    if (reach > 0 && impressions / reach > 4) {
      const impPerReach = (impressions / reach).toFixed(1);
      saturationSignals.push(`${impPerReach} imp/pessoa`);
      saturationScore += 20;
    }

    if (saturationScore >= 50) {
      const severity = saturationScore >= 70 ? "danger" : "warning";
      const actionText = saturationScore >= 70
        ? "Audiência esgotada. Pause este conjunto, expanda o público-alvo ou duplique com novo público lookalike. Criativos novos são obrigatórios."
        : "Sinais de saturação aparecendo. Monitore nas próximas 24h. Se piorar, troque criativos e expanda públicos.";

      alerts.push({
        id: `saturation-${c.id}`,
        type: severity,
        icon: <Users className="w-5 h-5" />,
        title: saturationScore >= 70 ? "🚨 Audiência saturada!" : "⚠️ Saturação em andamento",
        description: `${actionText}\n\nSinais: ${saturationSignals.join(" · ")}`,
        campaign: c.name,
        metric: `Score: ${saturationScore}/100`,
      });
    }

    // Winner detection: ROAS > 2 and has results
    if (roas >= 2 && results >= 2) {
      alerts.push({
        id: `winner-${c.id}`,
        type: "success",
        icon: <Trophy className="w-5 h-5" />,
        title: "🏆 Winner detectado!",
        description: `ROAS ${roas.toFixed(2)}x com ${results} conversões. Considere escalar o orçamento em 20-30%.`,
        campaign: c.name,
        metric: `ROAS: ${roas.toFixed(2)}x`,
      });
    }

    // Scale opportunity: good ROAS + good spend
    if (roas >= 1.5 && spend >= 30 && results >= 1) {
      alerts.push({
        id: `scale-${c.id}`,
        type: "info",
        icon: <Rocket className="w-5 h-5" />,
        title: "Oportunidade de escala",
        description: `ROAS de ${roas.toFixed(2)}x estável. Aumente o orçamento em 20% e monitore por 48h.`,
        campaign: c.name,
        metric: `ROAS: ${roas.toFixed(2)}x | CPA: ${formatCurrency(cpa)}`,
      });
    }

    // High CPA warning
    if (cpa > 0 && spend > 20 && roas < 1) {
      alerts.push({
        id: `high-cpa-${c.id}`,
        type: "danger",
        icon: <TrendingDown className="w-5 h-5" />,
        title: "CPA muito alto",
        description: `CPA de ${formatCurrency(cpa)} com ROAS ${roas.toFixed(2)}x. Está perdendo dinheiro. Considere pausar ou trocar o criativo.`,
        campaign: c.name,
        metric: `CPA: ${formatCurrency(cpa)}`,
      });
    }

    // Low CTR (creative fatigue signal) — only if not already caught by saturation
    if (ctr < 0.8 && spend > 15 && saturationScore < 50) {
      alerts.push({
        id: `low-ctr-${c.id}`,
        type: "warning",
        icon: <AlertTriangle className="w-5 h-5" />,
        title: "CTR baixo — criativo fraco",
        description: `CTR de ${ctr.toFixed(2)}% indica que o criativo não está chamando atenção. Teste novas abordagens.`,
        campaign: c.name,
        metric: `CTR: ${ctr.toFixed(2)}%`,
      });
    }

    // Learning phase (< 50 results and active)
    if (results > 0 && results < 5 && spend > 10) {
      alerts.push({
        id: `learning-${c.id}`,
        type: "info",
        icon: <Brain className="w-5 h-5" />,
        title: "Fase de aprendizado",
        description: `${results} conversões até agora. O algoritmo precisa de ~50 conversões em 7 dias para otimizar. Não altere o ad set.`,
        campaign: c.name,
        metric: `${results}/50 conversões`,
      });
    }
  }

  // No active campaigns
  if (active.length === 0 && campaigns.length > 0) {
    alerts.push({
      id: "no-active",
      type: "info",
      icon: <Pause className="w-5 h-5" />,
      title: "Nenhuma campanha ativa",
      description: "Todas as campanhas estão pausadas ou desativadas.",
    });
  }

  return alerts;
}

const typeStyles: Record<string, { bg: string; border: string; iconColor: string; badgeBg: string; badgeText: string }> = {
  danger: { bg: "bg-red-500/5", border: "border-red-500/20", iconColor: "text-red-400", badgeBg: "bg-red-500/15", badgeText: "text-red-400" },
  warning: { bg: "bg-amber-500/5", border: "border-amber-500/20", iconColor: "text-amber-400", badgeBg: "bg-amber-500/15", badgeText: "text-amber-400" },
  success: { bg: "bg-emerald-500/5", border: "border-emerald-500/20", iconColor: "text-emerald-400", badgeBg: "bg-emerald-500/15", badgeText: "text-emerald-400" },
  info: { bg: "bg-blue-500/5", border: "border-blue-500/20", iconColor: "text-blue-400", badgeBg: "bg-blue-500/15", badgeText: "text-blue-400" },
};

const scoreColors: Record<string, string> = {
  emerald: "from-emerald-500 to-emerald-600",
  blue: "from-blue-500 to-blue-600",
  amber: "from-amber-500 to-amber-600",
  orange: "from-orange-500 to-orange-600",
  red: "from-red-500 to-red-600",
  slate: "from-slate-500 to-slate-600",
};

const scoreBgColors: Record<string, string> = {
  emerald: "bg-emerald-500/10 border-emerald-500/30",
  blue: "bg-blue-500/10 border-blue-500/30",
  amber: "bg-amber-500/10 border-amber-500/30",
  orange: "bg-orange-500/10 border-orange-500/30",
  red: "bg-red-500/10 border-red-500/30",
  slate: "bg-slate-500/10 border-slate-500/30",
};

export function MetaAdsAlerts({ campaigns, loading }: Props) {
  const health = useMemo(() => analyzeDayHealth(campaigns), [campaigns]);
  const alerts = useMemo(() => generateAlerts(campaigns), [campaigns]);

  const dangerCount = alerts.filter((a) => a.type === "danger").length;
  const warningCount = alerts.filter((a) => a.type === "warning").length;
  const successCount = alerts.filter((a) => a.type === "success").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-500 text-sm">🤖 AntonyAD analisando suas campanhas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Day Health Score */}
      <Card className={`border ${scoreBgColors[health.color]} bg-[hsl(222,30%,14%)]`}>
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${scoreColors[health.color]} flex items-center justify-center shrink-0`}>
              <span className="text-3xl">{health.emoji}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-slate-500 tracking-wider uppercase">AntonyAD</span>
                <span className="text-slate-700">•</span>
                <h3 className="text-lg font-bold text-slate-100">{health.label}</h3>
                <Badge variant="outline" className={`text-xs ${scoreBgColors[health.color]}`}>
                  Score: {health.score}/100
                </Badge>
              </div>
              <p className="text-sm text-slate-400">
                {health.score >= 80 && "Métricas saudáveis, leilão favorável. Bom dia para escalar winners."}
                {health.score >= 60 && health.score < 80 && "Métricas aceitáveis. Monitore o CPA e mantenha os winners rodando."}
                {health.score >= 40 && health.score < 60 && "Dia instável. CPM ou CPA acima do normal. Evite escalar hoje, foque em manter."}
                {health.score >= 20 && health.score < 40 && "Métricas ruins. Considere reduzir orçamento e revisar criativos."}
                {health.score < 20 && "Dia crítico. Pause campanhas não rentáveis imediatamente."}
              </p>
              {/* Mini summary */}
              <div className="flex gap-3 mt-2">
                {dangerCount > 0 && (
                  <span className="text-xs text-red-400 flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" /> {dangerCount} crítico{dangerCount > 1 ? "s" : ""}
                  </span>
                )}
                {warningCount > 0 && (
                  <span className="text-xs text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {warningCount} atenção
                  </span>
                )}
                {successCount > 0 && (
                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                    <Trophy className="w-3 h-3" /> {successCount} winner{successCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
            {/* Score bar */}
            <div className="hidden sm:flex flex-col items-center gap-1">
              <div className="w-3 h-24 bg-slate-700/50 rounded-full overflow-hidden relative">
                <div
                  className={`absolute bottom-0 w-full rounded-full bg-gradient-to-t ${scoreColors[health.color]} transition-all duration-700`}
                  style={{ height: `${health.score}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-500">ROI</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaign Lifecycle & Scaling */}
      <MetaCampaignLifecycle campaigns={campaigns} healthScore={health.score} />

      {/* Alerts list */}
      {alerts.length === 0 ? (
        <Card className="bg-[hsl(222,30%,14%)] border-slate-700/50">
          <CardContent className="p-8 text-center">
            <Target className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Nenhum alerta no momento.</p>
            <p className="text-slate-600 text-xs mt-1">Os alertas aparecerão quando houver dados de campanhas ativas.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => {
            const style = typeStyles[alert.type];
            return (
              <Card key={alert.id} className={`${style.bg} border ${style.border} bg-[hsl(222,30%,14%)]`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 ${style.iconColor}`}>{alert.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-semibold text-slate-200">{alert.title}</h4>
                        {alert.metric && (
                          <Badge variant="outline" className={`text-[10px] ${style.badgeBg} ${style.badgeText} border-0`}>
                            {alert.metric}
                          </Badge>
                        )}
                      </div>
                      {alert.campaign && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">📢 {alert.campaign}</p>
                      )}
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">{alert.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-1">
        <span className="text-[10px] text-slate-600 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Crítico</span>
        <span className="text-[10px] text-slate-600 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Atenção</span>
        <span className="text-[10px] text-slate-600 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Positivo</span>
        <span className="text-[10px] text-slate-600 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Informativo</span>
        <span className="text-[10px] text-slate-600 ml-auto">🤖 AntonyAD — Seu gestor de tráfego inteligente</span>
      </div>
    </div>
  );
}
