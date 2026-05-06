import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Globe, Plus, Trash2, CheckCircle, AlertCircle, Loader2,
  RefreshCw, Copy, ExternalLink, ChevronRight, X, Rocket,
  Settings, ShieldCheck, Activity, Wifi, WifiOff, Apple,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";

/* ───────── Tutorial Steps ───────── */
const TUTORIAL_STEPS = [
  {
    title: "Escolha um subdomínio",
    description:
      'Vá ao painel do seu registrador de domínio e escolha um subdomínio para seu checkout. Exemplos: pay.seusite.com, checkout.seusite.com, comprar.seusite.com',
    icon: Globe,
  },
  {
    title: "Configure o DNS",
    description:
      'No painel DNS do seu domínio, crie um registro CNAME apontando seu subdomínio para fallback.panttera.com.br. Exemplo:\n\nTipo: CNAME\nNome: pay\nValor: fallback.panttera.com.br',
    icon: Settings,
  },
  {
    title: "Adicione aqui na plataforma",
    description:
      'Depois de configurar o DNS, digite o subdomínio completo (ex: pay.seusite.com) no campo abaixo e clique em "Adicionar". O SSL será emitido automaticamente!',
    icon: Rocket,
  },
  {
    title: "Aguarde a verificação",
    description:
      'O Cloudflare vai verificar o DNS e emitir o certificado SSL. Isso pode levar de 5 minutos a algumas horas. Quando o status ficar "Ativo", seu checkout já estará funcionando no seu domínio!',
    icon: ShieldCheck,
  },
];

/* ───────── Status helpers ───────── */
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: "Ativo", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  pending: { label: "Pendente", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  pending_validation: { label: "Validando DNS", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  moved: { label: "Movido", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  deleted: { label: "Removido", color: "bg-red-500/20 text-red-400 border-red-500/30" },
};

const SSL_STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: "SSL Ativo", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  pending_validation: { label: "SSL Pendente", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  pending_issuance: { label: "Emitindo SSL", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  pending_deployment: { label: "Implantando SSL", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  initializing: { label: "Inicializando", color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
};

const Domains = () => {
  const { user } = useAuth();

  /* ── Custom checkout domains ── */
  const [customDomains, setCustomDomains] = useState<any[]>([]);
  const [newHostname, setNewHostname] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState<string | null>(null);
  const [healthChecking, setHealthChecking] = useState<string | null>(null);
  const [healthByDomain, setHealthByDomain] = useState<Record<string, { ok: boolean; status_code: number | null; latency_ms: number | null; diagnosis: string; hint: string | null; checked_at: string }>>({});
  const [registeringPmd, setRegisteringPmd] = useState<string | null>(null);

  const registerApplePay = async (id: string) => {
    setRegisteringPmd(id);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("stripe-register-domain", {
        body: { domain_id: id },
        headers: { Authorization: `Bearer ${session.session?.access_token}` },
      });
      if (res.error || res.data?.error) {
        toast.error(res.data?.error || "Erro ao registrar Apple Pay");
      } else if (res.data?.status === "not_applicable") {
        toast.info("Stripe não está configurado para esta conta — Apple Pay não se aplica.");
        loadCustomDomains();
      } else {
        toast.success(`Apple Pay: ${res.data?.apple_pay || "registrado"} · Google Pay: ${res.data?.google_pay || "—"}`);
        loadCustomDomains();
      }
    } catch {
      toast.error("Erro ao registrar Apple Pay");
    }
    setRegisteringPmd(null);
  };

  /* ── Tutorial ── */
  const [showTutorial, setShowTutorial] = useState(() => {
    return localStorage.getItem("panttera_domain_tutorial_dismissed") !== "true";
  });
  const [tutorialStep, setTutorialStep] = useState(0);

  useEffect(() => {
    if (user) loadCustomDomains();
  }, [user]);

  /* ── Custom Domains (Cloudflare for SaaS) ── */
  const loadCustomDomains = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("custom_domains" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setCustomDomains(data as any[]);
  };

  const addCustomDomain = async () => {
    if (!newHostname || !user) return;
    const clean = newHostname.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").toLowerCase().trim();
    if (!/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(clean)) {
      toast.error("Digite um domínio válido (ex: pay.seusite.com)");
      return;
    }
    // Bloquear domínio raiz — exigir subdomínio dedicado pra não quebrar landing pages
    const parts = clean.split(".");
    const isRoot = parts.length < 3;
    // Trata domínios .com.br, .co.uk como raiz quando tem só 3 partes
    const compoundTlds = ["com.br", "co.uk", "com.au", "co.jp", "com.mx", "org.br", "net.br"];
    const isCompoundRoot = parts.length === 3 && compoundTlds.includes(parts.slice(-2).join("."));
    if (isRoot || isCompoundRoot) {
      toast.error("Use um subdomínio dedicado, ex: pay." + clean + ". Cadastrar a raiz quebra suas landing pages.");
      return;
    }
    setAddingCustom(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("cloudflare-add-hostname", {
        body: { hostname: clean },
        headers: { Authorization: `Bearer ${session.session?.access_token}` },
      });
      if (res.error || res.data?.error) {
        toast.error(res.data?.error || "Erro ao adicionar domínio");
      } else {
        toast.success("Domínio adicionado! Aguarde a verificação do DNS.");
        setNewHostname("");
        loadCustomDomains();
      }
    } catch {
      toast.error("Erro inesperado");
    }
    setAddingCustom(false);
  };

  const removeCustomDomain = async (id: string) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("cloudflare-remove-hostname", {
        body: { id },
        headers: { Authorization: `Bearer ${session.session?.access_token}` },
      });
      if (res.error || res.data?.error) {
        toast.error(res.data?.error || "Erro ao remover");
      } else {
        toast.success("Domínio removido");
        loadCustomDomains();
      }
    } catch {
      toast.error("Erro inesperado");
    }
  };

  const checkStatus = async (id: string) => {
    setCheckingStatus(id);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("cloudflare-check-status", {
        body: { id },
        headers: { Authorization: `Bearer ${session.session?.access_token}` },
      });
      if (res.data && !res.data.error) {
        loadCustomDomains();
        if (res.data.status === "active") {
          toast.success("Domínio verificado e ativo! 🎉");
        } else {
          toast.info(`Status: ${STATUS_MAP[res.data.status]?.label || res.data.status}`);
        }
      }
    } catch {
      toast.error("Erro ao verificar status");
    }
    setCheckingStatus(null);
  };

  const runHealthCheck = async (id: string) => {
    setHealthChecking(id);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("domain-health-check", {
        body: { id },
        headers: { Authorization: `Bearer ${session.session?.access_token}` },
      });
      if (res.error || res.data?.error) {
        toast.error(res.data?.error || "Erro ao testar link");
      } else if (res.data) {
        setHealthByDomain((prev) => ({ ...prev, [id]: res.data }));
        if (res.data.ok) {
          toast.success(`Link funcionando! ${res.data.latency_ms}ms`);
        } else {
          toast.warning(res.data.diagnosis || "Link não está respondendo corretamente");
        }
      }
    } catch {
      toast.error("Erro ao testar link");
    }
    setHealthChecking(null);
  };

  const dismissTutorial = () => {
    setShowTutorial(false);
    localStorage.setItem("panttera_domain_tutorial_dismissed", "true");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Domínios</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure um domínio próprio para seu checkout. Seus eventos de rastreamento (Meta, TikTok) serão enviados automaticamente por esse domínio.
        </p>
      </div>

      <div className="space-y-4">
          {/* Tutorial */}
          {showTutorial && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-display flex items-center gap-2 text-primary">
                    <Rocket className="w-4 h-4" />
                    Como configurar seu domínio customizado
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={dismissTutorial} className="text-muted-foreground hover:text-foreground h-7 px-2">
                    <X className="w-4 h-4 mr-1" /> Pular tutorial
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Step indicators */}
                <div className="flex items-center gap-1 mb-4">
                  {TUTORIAL_STEPS.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-colors cursor-pointer ${
                        i <= tutorialStep ? "bg-primary" : "bg-muted"
                      }`}
                      onClick={() => setTutorialStep(i)}
                    />
                  ))}
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                    {(() => {
                      const StepIcon = TUTORIAL_STEPS[tutorialStep].icon;
                      return <StepIcon className="w-5 h-5 text-primary" />;
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground mb-1">
                      Passo {tutorialStep + 1}: {TUTORIAL_STEPS[tutorialStep].title}
                    </p>
                    <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">
                      {TUTORIAL_STEPS[tutorialStep].description}
                    </p>

                    {tutorialStep === 1 && (
                      <div className="mt-3 bg-muted/50 rounded-lg p-3 border border-border/50">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Registro DNS necessário</p>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Tipo</span>
                            <p className="font-mono font-bold text-foreground">CNAME</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Nome</span>
                            <p className="font-mono font-bold text-foreground">pay</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Valor</span>
                            <div className="flex items-center gap-1">
                              <p className="font-mono font-bold text-primary text-[11px]">fallback.panttera.com.br</p>
                              <button onClick={() => copyToClipboard("fallback.panttera.com.br")} className="text-muted-foreground hover:text-primary">
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between mt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={tutorialStep === 0}
                    onClick={() => setTutorialStep((s) => s - 1)}
                    className="text-xs"
                  >
                    Anterior
                  </Button>
                  {tutorialStep < TUTORIAL_STEPS.length - 1 ? (
                    <Button
                      size="sm"
                      onClick={() => setTutorialStep((s) => s + 1)}
                      className="text-xs gap-1"
                    >
                      Próximo <ChevronRight className="w-3 h-3" />
                    </Button>
                  ) : (
                    <Button size="sm" onClick={dismissTutorial} className="text-xs gap-1">
                      Entendi! <CheckCircle className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {!showTutorial && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowTutorial(true); setTutorialStep(0); }}
              className="text-xs gap-1 text-muted-foreground"
            >
              <Rocket className="w-3 h-3" /> Ver tutorial novamente
            </Button>
          )}

          {/* Custom Domains Card */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-display flex items-center gap-2">
                <Globe className="w-4 h-4" /> Seus Domínios de Checkout
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Configure um subdomínio próprio para seu checkout (ex: pay.seusite.com)
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* DNS instruction banner */}
              <div className="bg-primary/5 rounded-lg p-4 border border-primary/20 space-y-3">
                <div className="flex items-start gap-2">
                  <Settings className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">Antes de adicionar, configure este CNAME no DNS do seu domínio:</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Use um <span className="font-semibold text-foreground">subdomínio dedicado</span> (ex: <span className="font-mono">pay</span>) — nunca o domínio raiz, senão suas landing pages quebram.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-md p-2">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-amber-200/90 leading-relaxed">
                    <span className="font-semibold">Você só precisa criar 1 (um) registro CNAME no DNS do <em>seu</em> domínio</span>, com o valor <span className="font-mono">fallback.panttera.com.br</span>. Não tente criar, editar ou apagar registros chamados <span className="font-mono">worker-fallback.panttera.com.br</span> — esse é interno da infraestrutura da Panttera e fica fora da sua conta.
                  </p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="bg-background/60 rounded p-2 border border-border/40">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Tipo</p>
                    <p className="font-mono text-xs font-bold text-foreground mt-0.5">CNAME</p>
                  </div>
                  <div className="bg-background/60 rounded p-2 border border-border/40">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Nome</p>
                    <p className="font-mono text-xs font-bold text-foreground mt-0.5">pay</p>
                  </div>
                  <div className="bg-background/60 rounded p-2 border border-border/40">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Valor</p>
                    <button
                      onClick={() => copyToClipboard("fallback.panttera.com.br")}
                      className="font-mono text-[11px] font-bold text-primary hover:underline inline-flex items-center gap-1 mt-0.5"
                    >
                      fallback.panttera.com.br <Copy className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="bg-background/60 rounded p-2 border border-border/40">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Proxy</p>
                    <p className="font-mono text-xs font-bold text-foreground mt-0.5">DNS only</p>
                  </div>
                </div>
              </div>

              {customDomains.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhum domínio customizado configurado
                </p>
              ) : (
                <div className="space-y-3">
                  {customDomains.map((d: any) => {
                    const statusInfo = STATUS_MAP[d.status] || { label: d.status, color: "bg-muted text-muted-foreground" };
                    const sslInfo = d.ssl_status ? SSL_STATUS_MAP[d.ssl_status] : null;
                    const health = healthByDomain[d.id];
                    return (
                      <div key={d.id} className="flex flex-col gap-2 bg-muted/30 rounded-lg px-4 py-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-3 flex-wrap">
                            <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="text-sm font-medium text-foreground">{d.hostname}</span>
                            <Badge variant="outline" className={`text-[10px] gap-1 border ${statusInfo.color}`}>
                              {d.status === "active" ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                              {statusInfo.label}
                            </Badge>
                            {sslInfo && (
                              <Badge variant="outline" className={`text-[10px] gap-1 border ${sslInfo.color}`}>
                                <ShieldCheck className="w-3 h-3" />
                                {sslInfo.label}
                              </Badge>
                            )}
                            {health && (
                              <Badge
                                variant="outline"
                                className={`text-[10px] gap-1 border ${
                                  health.ok
                                    ? "bg-green-500/20 text-green-400 border-green-500/30"
                                    : "bg-red-500/20 text-red-400 border-red-500/30"
                                }`}
                                title={health.hint || health.diagnosis}
                              >
                                {health.ok ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                                {health.ok
                                  ? `Link ok · ${health.latency_ms}ms`
                                  : `Link: ${health.diagnosis}`}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {d.status === "active" && (() => {
                              const apStatus = d.stripe_apple_pay_status as string | null;
                              const apMap: Record<string, { label: string; color: string }> = {
                                active: { label: "Apple Pay ativo", color: "bg-green-500/20 text-green-400 border-green-500/30" },
                                pending: { label: "Apple Pay pendente", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
                                inactive: { label: "Apple Pay inativo", color: "bg-red-500/20 text-red-400 border-red-500/30" },
                                not_applicable: { label: "Sem Stripe", color: "bg-muted text-muted-foreground border-border" },
                              };
                              const info = apStatus ? apMap[apStatus] : apMap.pending;
                              return (
                                <Badge variant="outline" className={`text-[10px] gap-1 border ${info.color}`} title="Status do registro de domínio Apple Pay / Google Pay no Stripe">
                                  <Apple className="w-3 h-3" />
                                  {info.label}
                                </Badge>
                              );
                            })()}
                          </div>
                          <div className="flex items-center gap-1">
                            {d.status === "active" && (
                              <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                                <a href={`https://${d.hostname}`} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                                </a>
                              </Button>
                            )}
                            {d.status === "active" && d.stripe_apple_pay_status !== "not_applicable" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => registerApplePay(d.id)}
                                disabled={registeringPmd === d.id}
                                className="h-8 w-8"
                                title="Re-validar registro Apple Pay / Google Pay no Stripe"
                              >
                                {registeringPmd === d.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                ) : (
                                  <Apple className="w-4 h-4 text-muted-foreground" />
                                )}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => runHealthCheck(d.id)}
                              disabled={healthChecking === d.id}
                              className="h-8 w-8"
                              title="Testar link real (verifica se o checkout está respondendo)"
                            >
                              {healthChecking === d.id ? (
                                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                              ) : (
                                <Activity className="w-4 h-4 text-muted-foreground" />
                              )}
                            </Button>
                          </div>
                        </div>
                        {health && !health.ok && health.hint && (
                          <p className="text-[11px] text-muted-foreground pl-7">
                            <span className="text-red-400 font-semibold">Diagnóstico:</span> {health.hint}
                          </p>
                        )}
                        <div className="flex items-center gap-1 self-end -mt-1">

                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="Ver instruções de DNS">
                                <Settings className="w-4 h-4 text-muted-foreground" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-80">
                              {(() => {
                                const parts = String(d.hostname).split(".");
                                const subdomain = parts.length > 2 ? parts[0] : "@";
                                const rootDomain = parts.length > 2 ? parts.slice(1).join(".") : d.hostname;
                                return (
                                  <div className="space-y-3">
                                    <div>
                                      <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                                        <Settings className="w-4 h-4 text-primary" /> Configuração de DNS
                                      </p>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Adicione este registro no painel DNS de <span className="font-mono text-foreground">{rootDomain}</span>
                                      </p>
                                    </div>
                                    <div className="bg-muted/50 rounded-lg p-3 border border-border/50 space-y-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Tipo</span>
                                        <div className="flex items-center gap-1">
                                          <p className="font-mono text-xs font-bold text-foreground">CNAME</p>
                                          <button onClick={() => copyToClipboard("CNAME")} className="text-muted-foreground hover:text-primary">
                                            <Copy className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Nome / Host</span>
                                        <div className="flex items-center gap-1">
                                          <p className="font-mono text-xs font-bold text-primary">{subdomain}</p>
                                          <button onClick={() => copyToClipboard(subdomain)} className="text-muted-foreground hover:text-primary">
                                            <Copy className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Valor</span>
                                        <div className="flex items-center gap-1">
                                          <p className="font-mono text-xs font-bold text-primary">fallback.panttera.com.br</p>
                                          <button onClick={() => copyToClipboard("fallback.panttera.com.br")} className="text-muted-foreground hover:text-primary">
                                            <Copy className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">TTL</span>
                                        <p className="font-mono text-xs font-bold text-foreground">Auto / 3600</p>
                                      </div>
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Proxy</span>
                                        <p className="font-mono text-xs font-bold text-foreground">DNS only</p>
                                      </div>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                                      Salve no seu provedor (Registro.br, GoDaddy, etc), aguarde 5–30 min e clique no <RefreshCw className="w-3 h-3 inline" /> para verificar.
                                    </p>
                                  </div>
                                );
                              })()}
                            </PopoverContent>
                          </Popover>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => checkStatus(d.id)}
                            disabled={checkingStatus === d.id}
                            className="h-8 w-8"
                            title="Verificar status"
                          >
                            {checkingStatus === d.id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                            ) : (
                              <RefreshCw className="w-4 h-4 text-muted-foreground" />
                            )}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => removeCustomDomain(d.id)} className="h-8 w-8">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Input
                  placeholder="ex: pay.seusite.com"
                  value={newHostname}
                  onChange={(e) => setNewHostname(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustomDomain()}
                  className="flex-1"
                />
                <Button onClick={addCustomDomain} disabled={addingCustom || !newHostname} size="sm">
                  {addingCustom ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-1" />
                  )}
                  Adicionar
                </Button>
              </div>
            </CardContent>
          </Card>
      </div>
    </div>
  );
};

export default Domains;
