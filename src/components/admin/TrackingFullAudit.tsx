import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Shield, CheckCircle2, XCircle, AlertTriangle, Loader2, RefreshCw,
  Zap, Globe, Code2, Eye, ShoppingCart, UserCheck, TrendingUp,
  Server, Monitor,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { subHours } from "date-fns";

interface AuditCheck {
  category: string;
  name: string;
  status: "pass" | "warning" | "error";
  detail: string;
}

interface Props {
  userId: string;
  productId?: string;
}

export default function TrackingFullAudit({ userId, productId }: Props) {
  const [running, setRunning] = useState(false);
  const [checks, setChecks] = useState<AuditCheck[] | null>(null);

  const runAudit = useCallback(async () => {
    setRunning(true);
    setChecks(null);
    const results: AuditCheck[] = [];

    try {
      // ═══ 1. PIXELS & CAPI CONFIG ═══
      const pixelQuery = supabase
        .from("product_pixels")
        .select("id, pixel_id, platform, domain, capi_token, product_id, products(name)")
        .eq("user_id", userId);
      if (productId) pixelQuery.eq("product_id", productId);
      const { data: pixels } = await pixelQuery;

      const fbPixels = (pixels || []).filter((p: any) => p.platform === "facebook");

      // Auto-sync: if the same pixel_id exists in multiple records and one has a token, copy it
      const pixelTokenMap = new Map<string, string>();
      fbPixels.forEach((p: any) => {
        if (p.capi_token && p.capi_token.length > 20) pixelTokenMap.set(p.pixel_id, p.capi_token);
      });
      const toSync = fbPixels.filter((p: any) => (!p.capi_token || p.capi_token.length <= 20) && pixelTokenMap.has(p.pixel_id));
      if (toSync.length > 0) {
        await Promise.all(toSync.map((p: any) =>
          supabase.from("product_pixels").update({ capi_token: pixelTokenMap.get(p.pixel_id) }).eq("id", p.id)
        ));
        // Update local data so audit reflects the fix
        toSync.forEach((p: any) => { p.capi_token = pixelTokenMap.get(p.pixel_id); });
      }

      if (fbPixels.length === 0) {
        results.push({ category: "Pixels", name: "Pixel Facebook", status: "error", detail: "Nenhum pixel Facebook configurado em nenhum produto." });
      } else {
        results.push({ category: "Pixels", name: "Pixels configurados", status: "pass", detail: `${fbPixels.length} pixel(s) Facebook ativo(s).` });

        const withCapi = fbPixels.filter((p: any) => !!p.capi_token && p.capi_token.length > 20);
        const withoutCapi = fbPixels.filter((p: any) => !p.capi_token || p.capi_token.length <= 20);

        if (toSync.length > 0) {
          results.push({ category: "CAPI", name: "Auto-sync de tokens", status: "pass", detail: `${toSync.length} pixel(s) sincronizado(s) automaticamente com token CAPI existente.` });
        }

        if (withCapi.length === fbPixels.length) {
          results.push({ category: "CAPI", name: "Tokens CAPI", status: "pass", detail: `Todos os ${withCapi.length} pixel(s) têm token CAPI configurado.` });
        } else if (withCapi.length > 0) {
          results.push({ category: "CAPI", name: "Tokens CAPI", status: "warning", detail: `${withoutCapi.length} pixel(s) sem token CAPI: ${withoutCapi.map((p: any) => p.pixel_id).join(", ")}` });
        } else {
          results.push({ category: "CAPI", name: "Tokens CAPI", status: "error", detail: "Nenhum pixel tem token CAPI configurado. O rastreamento server-side está inativo." });
        }


        const withDomain = fbPixels.filter((p: any) => !!p.domain);
        if (withDomain.length > 0) {
          results.push({ category: "Domínios", name: "Domínio customizado", status: "pass", detail: `${withDomain.length} pixel(s) com domínio próprio (${withDomain.map((p: any) => p.domain).join(", ")}).` });
        } else {
          results.push({ category: "Domínios", name: "Domínio customizado", status: "warning", detail: "Nenhum pixel com domínio customizado. O script pode ser bloqueado por adblockers." });
        }
      }

      // ═══ 2. DOMAINS VERIFICATION ═══
      const { data: domains } = await supabase
        .from("facebook_domains")
        .select("domain, verified")
        .eq("user_id", userId);

      if (domains && domains.length > 0) {
        const unverified = domains.filter((d: any) => !d.verified);
        if (unverified.length === 0) {
          results.push({ category: "Domínios", name: "Verificação DNS", status: "pass", detail: `Todos os ${domains.length} domínio(s) verificados.` });
        } else {
          results.push({ category: "Domínios", name: "Verificação DNS", status: "warning", detail: `${unverified.length} domínio(s) pendente(s): ${unverified.map((d: any) => d.domain).join(", ")}` });
        }
      }

      // ═══ 3. RECENT EVENTS (last 24h) ═══
      const since24h = subHours(new Date(), 24).toISOString();
      const eventsQuery = supabase
        .from("pixel_events" as any)
        .select("event_name, source, event_id, visitor_id", { count: "exact" })
        .eq("user_id", userId)
        .gte("created_at", since24h)
        .limit(1000);
      if (productId) eventsQuery.eq("product_id", productId);
      const { data: recentEvents, count: totalCount } = await eventsQuery;

      const events = (recentEvents as any[]) || [];
      const eventCount = totalCount || events.length;

      if (eventCount === 0) {
        results.push({ category: "Eventos", name: "Eventos recentes", status: "warning", detail: "Nenhum evento nas últimas 24h. O checkout pode não estar recebendo tráfego." });
      } else {
        results.push({ category: "Eventos", name: "Volume de eventos", status: "pass", detail: `${eventCount} evento(s) registrados nas últimas 24h.` });
      }

      // ═══ 4. EVENT TYPE COVERAGE ═══
      const eventTypes = new Set(events.map((e: any) => e.event_name));
      const requiredEvents = ["PageView", "InitiateCheckout", "Lead", "AddPaymentInfo", "Purchase"];
      const optionalEvents = ["ViewContent", "AddToCart"];

      const missingRequired = requiredEvents.filter((e) => !eventTypes.has(e));
      const missingOptional = optionalEvents.filter((e) => !eventTypes.has(e));

      if (missingRequired.length === 0) {
        results.push({ category: "Funil", name: "Eventos obrigatórios", status: "pass", detail: `Todos os 5 eventos obrigatórios presentes: ${requiredEvents.join(", ")}.` });
      } else if (eventCount > 0) {
        results.push({ category: "Funil", name: "Eventos obrigatórios", status: "warning", detail: `Eventos ausentes nas últimas 24h: ${missingRequired.join(", ")}. Pode ser falta de tráfego nessas etapas.` });
      }

      if (missingOptional.length === 0) {
        results.push({ category: "Funil", name: "Eventos opcionais", status: "pass", detail: "ViewContent e AddToCart presentes — funil completo." });
      } else if (eventCount > 0) {
        results.push({ category: "Funil", name: "Eventos opcionais", status: "warning", detail: `Eventos opcionais ausentes: ${missingOptional.join(", ")}.` });
      }

      // ═══ 5. DEDUPLICATION CHECK ═══
      if (events.length > 0) {
        const withEventId = events.filter((e: any) => !!e.event_id);
        const eventIdMap = new Map<string, string[]>();
        withEventId.forEach((e: any) => {
          if (!eventIdMap.has(e.event_id)) eventIdMap.set(e.event_id, []);
          eventIdMap.get(e.event_id)!.push(e.source);
        });

        const dualEvents = [...eventIdMap.values()].filter(
          (sources) => sources.includes("browser") && sources.includes("server")
        ).length;

        const totalGrouped = eventIdMap.size;

        if (totalGrouped > 0 && dualEvents > 0) {
          const dedupRate = Math.round((dualEvents / totalGrouped) * 100);
          results.push({
            category: "Deduplicação",
            name: "Browser + CAPI (DUAL ✓)",
            status: dedupRate >= 50 ? "pass" : "warning",
            detail: `${dualEvents}/${totalGrouped} eventos com DUAL ✓ (${dedupRate}%). ${dedupRate >= 80 ? "Excelente!" : dedupRate >= 50 ? "Bom, mas pode melhorar." : "Baixo — verifique se o CAPI está configurado."}`,
          });
        } else if (totalGrouped > 0) {
          results.push({ category: "Deduplicação", name: "Browser + CAPI", status: "warning", detail: "Nenhum evento DUAL detectado. Eventos estão chegando apenas por um canal." });
        }

        // Check for events without event_id (can't deduplicate)
        const withoutEventId = events.filter((e: any) => !e.event_id);
        if (withoutEventId.length > 0 && withEventId.length > 0) {
          const pct = Math.round((withoutEventId.length / events.length) * 100);
          if (pct > 20) {
            results.push({ category: "Deduplicação", name: "Eventos sem event_id", status: "warning", detail: `${withoutEventId.length} eventos (${pct}%) sem event_id — não podem ser deduplicados pelo Meta.` });
          }
        }
      }

      // ═══ 6. VISITOR ID COVERAGE ═══
      if (events.length > 0) {
        const withVid = events.filter((e: any) => !!e.visitor_id);
        const vidRate = Math.round((withVid.length / events.length) * 100);
        results.push({
          category: "Identificação",
          name: "Visitor ID (_vid)",
          status: vidRate >= 80 ? "pass" : vidRate >= 50 ? "warning" : "error",
          detail: `${vidRate}% dos eventos têm visitor_id. ${vidRate >= 80 ? "Jornadas bem vinculadas." : "Verifique se o script da LP está propagando o _vid."}`,
        });
      }

      // ═══ 7. SOURCE DISTRIBUTION ═══
      if (events.length > 0) {
        const browserCount = events.filter((e: any) => e.source === "browser").length;
        const serverCount = events.filter((e: any) => e.source === "server").length;

        if (browserCount === 0 && serverCount > 0) {
          results.push({ category: "Canais", name: "Pixel no navegador", status: "warning", detail: "Nenhum evento do browser. O script do pixel pode estar bloqueado por adblockers." });
        } else if (serverCount === 0 && browserCount > 0) {
          results.push({ category: "Canais", name: "CAPI server-side", status: "error", detail: "Nenhum evento do servidor. Verifique se o token CAPI está configurado corretamente." });
        } else {
          results.push({ category: "Canais", name: "Distribuição", status: "pass", detail: `Browser: ${browserCount} · Server: ${serverCount} — ambos os canais ativos.` });
        }
      }

      // ═══ 8. META DIAGNOSTICS (API check) ═══
      const productIds = [...new Set(fbPixels.map((p: any) => p.product_id))];
      if (productIds.length > 0) {
        try {
          const { data: diagData, error: diagErr } = await supabase.functions.invoke("meta-diagnostics", {
            body: { product_id: productIds[0] },
          });

          if (!diagErr && diagData?.summary) {
            const { passed, warnings, errors, total } = diagData.summary;
            const score = Math.round((passed / Math.max(total, 1)) * 100);
            results.push({
              category: "Meta API",
              name: "Validação Graph API",
              status: errors > 0 ? "error" : warnings > 0 ? "warning" : "pass",
              detail: `Score: ${score}% — ${passed} OK, ${warnings} avisos, ${errors} erros via Graph API.`,
            });
          }
        } catch {
          results.push({ category: "Meta API", name: "Validação Graph API", status: "warning", detail: "Não foi possível conectar à API do Meta para validação." });
        }
      }

    } catch (err: any) {
      results.push({ category: "Sistema", name: "Erro geral", status: "error", detail: err.message || "Erro desconhecido na auditoria." });
    }

    setChecks(results);
    setRunning(false);

    const errors = results.filter((c) => c.status === "error").length;
    const warnings = results.filter((c) => c.status === "warning").length;
    const passed = results.filter((c) => c.status === "pass").length;

    if (errors > 0) toast.error(`Varredura: ${errors} erro(s), ${warnings} aviso(s), ${passed} OK`);
    else if (warnings > 0) toast.warning(`Varredura: ${warnings} aviso(s), ${passed} OK — funcional mas pode melhorar`);
    else toast.success(`Varredura: ${passed} verificações OK — rastreamento perfeito! 🎯`);
  }, [userId, productId]);

  const statusIcon = (status: string) => {
    switch (status) {
      case "pass": return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case "warning": return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case "error": return <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />;
      default: return null;
    }
  };

  const categoryIcon = (cat: string) => {
    const map: Record<string, any> = {
      Pixels: Code2, CAPI: Server, Domínios: Globe, Eventos: Eye, Funil: ShoppingCart,
      Deduplicação: Zap, Identificação: UserCheck, Canais: Monitor, "Meta API": TrendingUp, Sistema: Shield,
    };
    const Icon = map[cat] || Shield;
    return <Icon className="w-3 h-3 text-slate-500" />;
  };

  const score = checks
    ? Math.round((checks.filter((c) => c.status === "pass").length / Math.max(checks.length, 1)) * 100)
    : null;

  // Group checks by category
  const grouped = checks
    ? checks.reduce<Record<string, AuditCheck[]>>((acc, c) => {
        if (!acc[c.category]) acc[c.category] = [];
        acc[c.category].push(c);
        return acc;
      }, {})
    : null;

  return (
    <div className="rounded-lg bg-slate-800/50 border border-slate-700/30 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700/30 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Shield className="w-4 h-4 text-emerald-400" />
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Varredura Completa</h2>
            <p className="text-[10px] text-slate-500">Audita pixels, CAPI, deduplicação, funil e Meta API</p>
          </div>
        </div>
        <Button onClick={() => runAudit()} disabled={running} size="sm" className="gap-1.5 text-xs">
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : checks ? <RefreshCw className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
          {running ? "Auditando..." : checks ? "Rodar novamente" : "Iniciar varredura"}
        </Button>
      </div>

      {checks && (
        <div className="p-4 space-y-4">
          {/* Score */}
          {score !== null && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Score do rastreamento</span>
                <span className={`text-2xl font-bold font-mono tabular-nums ${
                  score === 100 ? "text-emerald-400" : score >= 70 ? "text-amber-400" : "text-red-400"
                }`}>{score}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-700/50 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${score}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  style={{
                    backgroundColor: score === 100 ? "#34d399" : score >= 70 ? "#fbbf24" : "#f87171"
                  }}
                />
              </div>
              <div className="flex gap-4 text-[10px]">
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="w-2.5 h-2.5" /> {checks.filter((c) => c.status === "pass").length} OK
                </span>
                <span className="flex items-center gap-1 text-amber-400">
                  <AlertTriangle className="w-2.5 h-2.5" /> {checks.filter((c) => c.status === "warning").length} Avisos
                </span>
                <span className="flex items-center gap-1 text-red-400">
                  <XCircle className="w-2.5 h-2.5" /> {checks.filter((c) => c.status === "error").length} Erros
                </span>
              </div>
            </div>
          )}

          {/* Grouped results */}
          {grouped && Object.entries(grouped).map(([category, categoryChecks]) => (
            <div key={category} className="rounded-md bg-slate-900/50 border border-slate-700/20 overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-700/20 flex items-center gap-2">
                {categoryIcon(category)}
                <span className="text-xs font-semibold text-slate-300">{category}</span>
                <div className="ml-auto flex gap-1">
                  {categoryChecks.some((c) => c.status === "error") && (
                    <Badge variant="outline" className="text-[9px] bg-red-500/10 text-red-400 border-red-500/20 px-1.5 py-0">
                      {categoryChecks.filter((c) => c.status === "error").length} erro
                    </Badge>
                  )}
                  {categoryChecks.some((c) => c.status === "warning") && (
                    <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-400 border-amber-500/20 px-1.5 py-0">
                      {categoryChecks.filter((c) => c.status === "warning").length} aviso
                    </Badge>
                  )}
                  {categoryChecks.every((c) => c.status === "pass") && (
                    <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-1.5 py-0">
                      ✓ OK
                    </Badge>
                  )}
                </div>
              </div>
              <div className="divide-y divide-slate-700/15">
                {categoryChecks.map((check, i) => (
                  <div key={i} className="px-3 py-2.5 flex items-start gap-2.5">
                    {statusIcon(check.status)}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-300">{check.name}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{check.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
