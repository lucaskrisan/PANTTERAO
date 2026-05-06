// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, ExternalLink, CheckCircle2, AlertCircle, Globe, Code2, Zap,
  Activity, XCircle, AlertTriangle, Play, RefreshCw, Search, Link2, FileCode,
  Settings2, Radio, TrendingUp,
} from "lucide-react";

import UtmAttributionTable from "@/components/admin/UtmAttributionTable";
import PixelEventsDashboard from "@/components/admin/PixelEventsDashboard";
import TrackingFullAudit from "@/components/admin/TrackingFullAudit";
import TrackingOnboardingGuide from "@/components/admin/TrackingOnboardingGuide";
import MetaEmqPanel from "@/components/admin/MetaEmqPanel";
import TestEventsPanel from "@/components/admin/tracking/TestEventsPanel";
import TrackingScriptGenerator from "@/components/admin/TrackingScriptGenerator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface PixelSummary {
  product_id: string;
  product_name: string;
  platform: string;
  pixel_id: string;
  domain: string | null;
  has_capi: boolean;
}

interface DiagCheck {
  name: string;
  status: "pass" | "warning" | "error";
  detail: string;
}

interface DiagResult {
  pixel_id: string;
  checks: DiagCheck[];
}

interface DiagSummary {
  total: number;
  passed: number;
  warnings: number;
  errors: number;
}

const Tracking = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pixels, setPixels] = useState<PixelSummary[]>([]);
  const [domains, setDomains] = useState<{ id: string; domain: string; verified: boolean }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [checkoutBaseUrl, setCheckoutBaseUrl] = useState<string>("https://app.panttera.com.br");

  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [globalProduct, setGlobalProduct] = useState<string>("");
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagResults, setDiagResults] = useState<DiagResult[] | null>(null);
  const [diagSummary, setDiagSummary] = useState<DiagSummary | null>(null);
  const [alertIssues, setAlertIssues] = useState<DiagCheck[]>([]);
  const autoRanRef = useRef(false);

  const [pageUrl, setPageUrl] = useState("");
  const [pageChecking, setPageChecking] = useState(false);
  const [pageChecks, setPageChecks] = useState<DiagCheck[] | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [pixelRes, domainRes, customDomainRes, productsRes] = await Promise.all([
        supabase
          .from("product_pixels")
          .select("pixel_id, platform, domain, capi_token, product_id, products(name)")
          .eq("user_id", user.id),
        supabase
          .from("facebook_domains")
          .select("*")
          .eq("user_id", user.id),
        supabase
          .from("custom_domains" as any)
          .select("hostname")
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("products")
          .select("id, name")
          .eq("user_id", user.id)
          .eq("active", true)
          .order("created_at", { ascending: false }),
      ]);

      if (customDomainRes.data && (customDomainRes.data as any).hostname) {
        setCheckoutBaseUrl(`https://${(customDomainRes.data as any).hostname}`);
      }

      if (pixelRes.data) {
        const mapped = pixelRes.data.map((p: any) => ({
          product_id: p.product_id,
          product_name: (p.products as any)?.name || "Produto",
          platform: p.platform,
          pixel_id: p.pixel_id,
          domain: p.domain,
          has_capi: !!p.capi_token,
        }));
        setPixels(mapped);
      }

      // Dropdown shows ALL active products of the user (not only ones with pixel)
      const allProducts = (productsRes.data || []).map((p: any) => ({ id: p.id, name: p.name }));
      setProducts(allProducts);
      if (allProducts.length > 0) {
        setSelectedProduct(allProducts[0].id);
        setGlobalProduct(allProducts[0].id);
      }

      if (domainRes.data) setDomains(domainRes.data as any);
      setLoading(false);
    };
    load();
  }, [user]);

  const runDiagnostics = async (productIdOverride?: string) => {
    const prodId = productIdOverride || selectedProduct;
    if (!prodId) { toast.error("Selecione um produto"); return; }
    setDiagLoading(true);
    setDiagResults(null);
    setDiagSummary(null);
    try {
      const { data, error } = await supabase.functions.invoke("meta-diagnostics", {
        body: { product_id: prodId },
      });
      if (error) throw new Error(typeof error === 'object' && error.message ? error.message : 'Falha na conexão');
      if (data?.error) throw new Error(data.error);
      setDiagResults(data.results || []);
      setDiagSummary(data.summary || null);

      // Collect errors/warnings for the persistent alert
      const allChecks = (data.results || []).flatMap((r: any) => r.checks || []);
      const issues = allChecks.filter((c: DiagCheck) => c.status === "error" || c.status === "warning");
      setAlertIssues(issues);

      if (data.summary?.errors > 0) toast.error(`${data.summary.errors} problema(s) encontrado(s)`);
      else if (data.summary?.warnings > 0) toast.warning(`${data.summary.warnings} aviso(s)`);
      else toast.success("Rastreamento 100% saudável! 🎯");
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "Tente novamente"));
    } finally {
      setDiagLoading(false);
    }
  };

  // Auto-run diagnostics on first load if products exist
  useEffect(() => {
    if (autoRanRef.current || products.length === 0 || !selectedProduct) return;
    autoRanRef.current = true;
    runDiagnostics(selectedProduct);
  }, [products, selectedProduct]);

  const verifyPage = useCallback(async () => {
    const url = pageUrl.trim();
    if (!url) { toast.error("Cole a URL da página"); return; }
    if (!url.startsWith("http")) { toast.error("URL deve começar com http(s)://"); return; }
    setPageChecking(true);
    setPageChecks(null);
    const checks: DiagCheck[] = [];
    try {
      const { data: htmlData, error: fetchErr } = await supabase.functions.invoke("meta-diagnostics", {
        body: { action: "verify_page", url },
      });
      if (fetchErr || !htmlData?.html) {
        checks.push({ name: "Acesso à página", status: "warning", detail: "Não foi possível acessar remotamente." });
      } else {
        const html: string = htmlData.html;
        if (html.includes("fbevents.js")) checks.push({ name: "Meta Pixel SDK", status: "pass", detail: "fbevents.js encontrado ✅" });
        else checks.push({ name: "Meta Pixel SDK", status: "error", detail: "fbevents.js NÃO encontrado!" });

        if (html.includes("fbq('init'") || html.includes('fbq("init"')) checks.push({ name: "fbq init", status: "pass", detail: "Inicialização do Pixel encontrada ✅" });
        else if (html.includes("public_product_pixels")) checks.push({ name: "fbq init (dinâmico)", status: "pass", detail: "Pixel carregado via PanteraPay API ✅" });
        else checks.push({ name: "fbq init", status: "error", detail: "Nenhuma inicialização de Pixel encontrada." });

        if (html.includes("PageView")) checks.push({ name: "PageView", status: "pass", detail: "Evento PageView detectado ✅" });
        else checks.push({ name: "PageView", status: "warning", detail: "Pode ser disparado dinamicamente" });

        if (html.includes("ViewContent")) checks.push({ name: "ViewContent", status: "pass", detail: "ViewContent detectado ✅" });
        else checks.push({ name: "ViewContent", status: "warning", detail: "Não encontrado no HTML" });

        if (html.includes("utm_source") || html.includes("pc_utms")) checks.push({ name: "Captura de UTMs", status: "pass", detail: "Lógica de UTMs encontrada ✅" });
        else checks.push({ name: "Captura de UTMs", status: "error", detail: "Nenhuma lógica de UTMs encontrada." });

        if (html.includes("fbclid")) checks.push({ name: "Cross-domain fbclid", status: "pass", detail: "Propagação de fbclid ativa ✅" });
        else checks.push({ name: "Cross-domain fbclid", status: "warning", detail: "fbclid não propagado." });

        if (html.includes("_fbp") || html.includes("fbp=")) checks.push({ name: "Cross-domain _fbp", status: "pass", detail: "Propagação de _fbp ativa ✅" });
        else checks.push({ name: "Cross-domain _fbp", status: "warning", detail: "_fbp não propagado." });

        if (html.includes("_fbc")) checks.push({ name: "Cookie _fbc", status: "pass", detail: "Cookie _fbc na LP ✅" });
        else checks.push({ name: "Cookie _fbc", status: "warning", detail: "Cookie _fbc não criado na LP." });

        if (html.includes("goToCheckout")) checks.push({ name: "URL Decorator", status: "pass", detail: "goToCheckout encontrado ✅" });
        else checks.push({ name: "URL Decorator", status: "warning", detail: "goToCheckout não encontrado." });

        const productIdRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
        const foundIds = html.match(productIdRegex) || [];
        const myProductIds = pixels.map(p => p.product_id);
        const matchedProducts = [...new Set(foundIds)].filter(id => myProductIds.includes(id));
        if (matchedProducts.length > 0) {
          const names = matchedProducts.map(id => pixels.find(p => p.product_id === id)?.product_name).filter(Boolean);
          checks.push({ name: "Link do checkout", status: "pass", detail: `Produto(s): ${names.join(", ")} ✅` });
        } else {
          checks.push({ name: "Link do checkout", status: "error", detail: "Nenhum produto PanteraPay encontrado." });
        }

        if (html.includes("config=") || html.includes("configId")) checks.push({ name: "Config ID", status: "pass", detail: "Config de checkout encontrada ✅" });
        else checks.push({ name: "Config ID", status: "warning", detail: "Usando oferta padrão." });
      }
    } catch (err: any) {
      checks.push({ name: "Erro geral", status: "error", detail: err.message || "Erro desconhecido" });
    }
    setPageChecks(checks);
    setPageChecking(false);
    const errors = checks.filter(c => c.status === "error").length;
    const warnings = checks.filter(c => c.status === "warning").length;
    if (errors > 0) toast.error(`${errors} problema(s)`);
    else if (warnings > 0) toast.warning(`OK com ${warnings} aviso(s)`);
    else toast.success("Página 100% configurada! 🎯");
  }, [pageUrl, pixels]);

  const statusIcon = (status: string) => {
    switch (status) {
      case "pass": return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case "warning": return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case "error": return <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />;
      default: return null;
    }
  };

  const platformColors: Record<string, string> = {
    facebook: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    "g ads": "bg-amber-500/10 text-amber-400 border-amber-500/20",
    "g analytics": "bg-orange-500/10 text-orange-400 border-orange-500/20",
    tiktok: "bg-pink-500/10 text-pink-400 border-pink-500/20",
    taboola: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const uniqueProductIds = [...new Set(pixels.map((p) => p.product_id))];
  const totalPixels = pixels.length;
  const capiEnabled = pixels.filter((p) => p.has_capi).length;
  const healthScore = diagSummary
    ? Math.round((diagSummary.passed / Math.max(diagSummary.total, 1)) * 100)
    : null;

  return (
    <div className="space-y-5 -m-6 p-6 min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
      {/* ── Header compacto: título + KPIs inline + seletor de produto ── */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2.5">
          <Activity className="w-5 h-5 text-cyan-400" />
          <h1 className="text-xl font-bold text-white">Rastreamento</h1>
        </div>

        {/* KPIs inline (pílulas discretas) */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <span className="px-2 py-0.5 rounded-md bg-slate-800/60 border border-slate-700/40">
            <span className="font-mono font-semibold text-cyan-300">{totalPixels}</span> Pixels
          </span>
          <span className="px-2 py-0.5 rounded-md bg-slate-800/60 border border-slate-700/40">
            <span className="font-mono font-semibold text-violet-300">{capiEnabled}</span> CAPI
          </span>
          <span className="px-2 py-0.5 rounded-md bg-slate-800/60 border border-slate-700/40">
            <span className="font-mono font-semibold text-emerald-300">{domains.length}</span> Domínios
          </span>
        </div>

        {/* Seletor de produto à direita */}
        {products.length > 0 && (
          <div className="ml-auto min-w-[220px]">
            <Select
              value={globalProduct}
              onValueChange={(v) => {
                setGlobalProduct(v);
                setSelectedProduct(v);
                autoRanRef.current = false;
              }}
            >
              <SelectTrigger className="bg-slate-800/60 border-slate-700/50 text-slate-200 text-xs h-9">
                <SelectValue placeholder="Selecione um produto" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* ── Diagnostic Alert Banner ── */}
      {alertIssues.length > 0 && (
        <div className="rounded-lg border overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300"
          style={{
            borderColor: alertIssues.some(i => i.status === "error") ? "rgba(248,113,113,0.3)" : "rgba(251,191,36,0.3)",
            backgroundColor: alertIssues.some(i => i.status === "error") ? "rgba(248,113,113,0.06)" : "rgba(251,191,36,0.06)",
          }}
        >
          <div className="px-4 py-3 flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" style={{
              color: alertIssues.some(i => i.status === "error") ? "#f87171" : "#fbbf24"
            }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-200">
                {alertIssues.filter(i => i.status === "error").length > 0
                  ? `${alertIssues.filter(i => i.status === "error").length} problema(s) encontrado(s) no rastreamento`
                  : `${alertIssues.length} aviso(s) no rastreamento`}
              </p>
              <div className="mt-1.5 space-y-1">
                {alertIssues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    {issue.status === "error"
                      ? <XCircle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                      : <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />}
                    <p className="text-[10px] text-slate-400">
                      <span className="font-medium text-slate-300">{issue.name}:</span> {issue.detail}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-slate-600 mt-2 italic">
                Corrija os itens acima e rode o diagnóstico novamente — este alerta desaparece quando tudo estiver OK ✅
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Onboarding Guide (apenas quando NÃO há pixels ainda) ── */}
      {totalPixels === 0 && <TrackingOnboardingGuide hasPixels={false} />}

      {/* ── Tabs ── */}
      <Tabs defaultValue="events" className="space-y-4">
        <TabsList className="bg-slate-800/60 border border-slate-700/30 p-1 gap-1">
          <TabsTrigger value="events" className="text-xs gap-1.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500/20 data-[state=active]:to-cyan-500/20 data-[state=active]:text-white data-[state=active]:border data-[state=active]:border-emerald-500/30 text-slate-400">
            <span className="relative flex items-center justify-center w-2 h-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
            Ao Vivo
          </TabsTrigger>
          <TabsTrigger value="audit" className="text-xs gap-1.5 data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">
            <Search className="w-3.5 h-3.5" /> Auditoria
          </TabsTrigger>
          <TabsTrigger value="config" className="text-xs gap-1.5 data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">
            <Settings2 className="w-3.5 h-3.5" /> Configuração
          </TabsTrigger>
          <TabsTrigger value="script" className="text-xs gap-1.5 data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">
            <Code2 className="w-3.5 h-3.5" /> Script
          </TabsTrigger>
          <TabsTrigger value="attribution" className="text-xs gap-1.5 data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">
            <TrendingUp className="w-3.5 h-3.5" /> Atribuição
          </TabsTrigger>
        </TabsList>

        {/* ═══ TAB: Auditoria ═══ */}
        <TabsContent value="audit" className="space-y-5 mt-0">
          {user && <TrackingFullAudit userId={user.id} productId={globalProduct} />}
          <MetaEmqPanel products={products} selectedProductId={globalProduct} onProductChange={setGlobalProduct} />
          <TestEventsPanel products={products} selectedProductId={globalProduct} onProductChange={setGlobalProduct} />

          {/* Diagnostics */}
          <div className="rounded-lg bg-slate-800/50 border border-slate-700/30 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700/30 flex items-center gap-2.5">
              <Activity className="w-4 h-4 text-cyan-400" />
              <div>
                <h2 className="text-sm font-semibold text-slate-200">Diagnóstico do Meta</h2>
                <p className="text-[10px] text-slate-500">Pixel ID · Domínio · CAPI · Graph API</p>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {products.length === 0 ? (
                <p className="text-xs text-slate-500">Nenhum pixel Facebook configurado.</p>
              ) : (
                <>
                  <div className="flex items-end gap-3">
                    <div className="flex-1 space-y-1">
                      <label className="text-xs font-medium text-slate-400">Produto</label>
                      <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                        <SelectTrigger className="bg-slate-800/60 border-slate-700/50 text-slate-300 text-xs">
                          <SelectValue placeholder="Selecione um produto" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={() => runDiagnostics()} disabled={diagLoading} size="sm" className="gap-1.5 text-xs">
                      {diagLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : diagResults ? <RefreshCw className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      {diagLoading ? "Analisando..." : diagResults ? "Rodar novamente" : "Executar"}
                    </Button>
                  </div>

                  {diagSummary && healthScore !== null && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-400">Saúde do rastreamento</span>
                        <span className={`text-xl font-bold font-mono tabular-nums ${
                          healthScore === 100 ? "text-emerald-400" :
                          healthScore >= 70 ? "text-amber-400" : "text-red-400"
                        }`}>{healthScore}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-700/50 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${healthScore}%`,
                            backgroundColor: healthScore === 100 ? "#34d399" : healthScore >= 70 ? "#fbbf24" : "#f87171"
                          }}
                        />
                      </div>
                      <div className="flex gap-4 text-[10px]">
                        <span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 className="w-2.5 h-2.5" /> {diagSummary.passed} OK</span>
                        <span className="flex items-center gap-1 text-amber-400"><AlertTriangle className="w-2.5 h-2.5" /> {diagSummary.warnings} Avisos</span>
                        <span className="flex items-center gap-1 text-red-400"><XCircle className="w-2.5 h-2.5" /> {diagSummary.errors} Erros</span>
                      </div>
                    </div>
                  )}

                  {diagResults && diagResults.map((result) => (
                    <div key={result.pixel_id} className="rounded-md bg-slate-900/50 border border-slate-700/20 overflow-hidden">
                      <div className="px-3 py-2 border-b border-slate-700/20 flex items-center gap-2">
                        <Code2 className="w-3.5 h-3.5 text-slate-500" />
                        <span className="font-mono text-xs font-medium text-slate-300">{result.pixel_id}</span>
                      </div>
                      <div className="divide-y divide-slate-700/15">
                        {result.checks.map((check, i) => (
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
                </>
              )}
            </div>
          </div>

          {/* Page Verification */}
          <div className="rounded-lg bg-slate-800/50 border border-slate-700/30 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700/30 flex items-center gap-2.5">
              <FileCode className="w-4 h-4 text-violet-400" />
              <div>
                <h2 className="text-sm font-semibold text-slate-200">Verificação de Página Externa</h2>
                <p className="text-[10px] text-slate-500">Audite o tracking da sua landing page</p>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-slate-400">URL da página</label>
                  <div className="relative">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <Input
                      value={pageUrl}
                      onChange={(e) => setPageUrl(e.target.value)}
                      placeholder="https://suapagina.com"
                      className="pl-9 bg-slate-800/60 border-slate-700/50 text-slate-300 text-xs placeholder:text-slate-600"
                    />
                  </div>
                </div>
                <Button onClick={() => verifyPage()} disabled={pageChecking} size="sm" className="gap-1.5 text-xs">
                  {pageChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  {pageChecking ? "Verificando..." : "Verificar"}
                </Button>
              </div>
              {pageChecks && (
                <div className="rounded-md bg-slate-900/50 border border-slate-700/20 overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-700/20 flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-xs font-medium text-slate-300 truncate">{pageUrl}</span>
                  </div>
                  <div className="divide-y divide-slate-700/15">
                    {pageChecks.map((check, i) => (
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
              )}
            </div>
          </div>
        </TabsContent>

        {/* ═══ TAB: Eventos ═══ */}
        <TabsContent value="events" className="space-y-5 mt-0">
          <PixelEventsDashboard products={products} userId={user?.id} initialFilter={globalProduct} />
        </TabsContent>

        {/* ═══ TAB: Configuração ═══ */}
        <TabsContent value="config" className="space-y-5 mt-0">
          {/* Pixels by Product */}
          <div>
            <h2 className="text-sm font-semibold text-slate-200 mb-2">Pixels por produto</h2>
            {uniqueProductIds.length === 0 ? (
              <div className="rounded-lg bg-slate-800/50 border border-slate-700/30 p-8 text-center">
                <Code2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Nenhum pixel configurado</p>
                <p className="text-[10px] text-slate-600 mt-1">Configure em Produtos → Editar → Configurações</p>
              </div>
            ) : (
              <div className="space-y-2">
                {uniqueProductIds.map((productId) => {
                  const productPixels = pixels.filter((p) => p.product_id === productId);
                  const productName = productPixels[0]?.product_name || "Produto";
                  return (
                    <div key={productId} className="rounded-lg bg-slate-800/50 border border-slate-700/30 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/30">
                        <h3 className="text-xs font-semibold text-slate-200">{productName}</h3>
                        <Button size="sm" variant="ghost" className="text-[10px] gap-1 text-slate-400 hover:text-slate-200 h-7" onClick={() => navigate(`/admin/products/${productId}/edit`)}>
                          Editar <ExternalLink className="w-2.5 h-2.5" />
                        </Button>
                      </div>
                      <div className="divide-y divide-slate-700/20">
                        {productPixels.map((px, i) => (
                          <div key={i} className="px-4 py-2.5 flex items-center gap-2.5 text-xs">
                            <Badge variant="outline" className={`text-[10px] ${platformColors[px.platform] || "border-slate-600 text-slate-400"}`}>
                              {px.platform}
                            </Badge>
                            <span className="font-mono text-slate-300 text-[11px]">{px.pixel_id}</span>
                            {px.domain && <span className="text-[10px] text-slate-500">via {px.domain}</span>}
                            <div className="ml-auto">
                              {px.has_capi ? (
                                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-1">
                                  <CheckCircle2 className="w-2.5 h-2.5" /> CAPI
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/20 gap-1">
                                  <AlertCircle className="w-2.5 h-2.5" /> Sem CAPI
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Domains */}
          {domains.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-200 mb-2">Domínios verificados</h2>
              <div className="rounded-lg bg-slate-800/50 border border-slate-700/30 divide-y divide-slate-700/20">
                {domains.map((d) => (
                  <div key={d.id} className="px-4 py-2.5 flex items-center gap-2.5 text-xs">
                    <Globe className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-slate-300">{d.domain}</span>
                    <Badge variant="outline" className={`ml-auto text-[10px] ${
                      d.verified ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    }`}>
                      {d.verified ? "Verificado" : "Pendente"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ═══ TAB: Script ═══ */}
        <TabsContent value="script" className="space-y-5 mt-0">
          <TrackingScriptGenerator
            pixels={pixels}
            products={products}
            checkoutBaseUrl={checkoutBaseUrl}
            selectedProductId={globalProduct}
            onProductChange={(id) => { setGlobalProduct(id); setSelectedProduct(id); }}
          />
        </TabsContent>

        {/* ═══ TAB: Atribuição ═══ */}
        <TabsContent value="attribution" className="space-y-5 mt-0">
          <UtmAttributionTable />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Tracking;
