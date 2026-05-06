// @ts-nocheck
import { lazy, Suspense, useState, useEffect, useRef, useCallback } from "react";

const WhatsAppTemplates = lazy(() => import("@/components/admin/WhatsAppTemplates"));
const WhatsAppFeatureFlags = lazy(() => import("@/components/admin/WhatsAppFeatureFlags"));
const WhatsAppSendLog = lazy(() => import("@/components/admin/WhatsAppSendLog"));
const WhatsAppStarterTemplates = lazy(() => import("@/components/admin/WhatsAppStarterTemplates"));
const WhatsAppMetricsCard = lazy(() => import("@/components/admin/WhatsAppMetricsCard"));
const WhatsAppRecoveryTab = lazy(() => import("@/components/admin/WhatsAppRecoveryTab"));
import WhatsAppTestMessageDialog from "@/components/admin/WhatsAppTestMessageDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare, Phone, Power, PowerOff, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Clock, Send, RotateCw, Activity, ShieldCheck, Zap, Workflow } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const formatPhone = (raw: string) => {
  if (!raw) return "";
  const d = raw.replace(/\D/g, "");
  if (d.length === 13) return `+${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 12) return `+${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 8)}-${d.slice(8)}`;
  return `+${d}`;
};

const formatRelative = (iso: string | null) => {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `há ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `há ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `há ${hr}h`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `há ${days} dia${days > 1 ? "s" : ""}`;
  const months = Math.floor(days / 30);
  return `há ${months} ${months > 1 ? "meses" : "mês"}`;
};

const WhatsApp = () => {
  const { user, isSuperAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "connection";
  
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [qrcode, setQrcode] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("disconnected");
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [connectedAt, setConnectedAt] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [qrAge, setQrAge] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrAgeRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initial load + periodic status check
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("whatsapp_sessions")
        .select("*")
        .eq("tenant_id", user.id)
        .maybeSingle();
      if (data) {
        setStatus(data.status);
        setPhoneNumber(data.phone_number);
        setInstanceId(data.instance_id);
        setConnectedAt(data.connected_at);
      }
      setLastChecked(new Date());
    };
    load();

    statusPollRef.current = setInterval(async () => {
      const { data } = await supabase
        .from("whatsapp_sessions")
        .select("status, phone_number, instance_id, connected_at")
        .eq("tenant_id", user.id)
        .maybeSingle();
      if (data) {
        setStatus(data.status);
        setPhoneNumber(data.phone_number);
        setInstanceId(data.instance_id);
        setConnectedAt(data.connected_at);
      }
      setLastChecked(new Date());
    }, 60_000);

    return () => {
      if (statusPollRef.current) clearInterval(statusPollRef.current);
    };
  }, [user]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (qrRefreshRef.current) {
      clearInterval(qrRefreshRef.current);
      qrRefreshRef.current = null;
    }
    if (qrAgeRef.current) {
      clearInterval(qrAgeRef.current);
      qrAgeRef.current = null;
    }
    setQrAge(0);
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const refreshQrCode = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("connect-whatsapp");
      if (error) throw error;
      if (data?.qrcode) {
        setQrcode(data.qrcode);
        setQrAge(0);
      }
    } catch (err) {
      console.error("QR refresh error:", err);
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    let attempts = 0;
    const maxAttempts = 80; // ~4 min at 3s

    // Status poll every 3s
    pollingRef.current = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        stopPolling();
        setStatus("disconnected");
        setQrcode(null);
        toast.error("Tempo esgotado. Tente conectar novamente.");
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("check-whatsapp-status");
        if (error) throw error;
        setLastChecked(new Date());

        if (data?.state === "open") {
          setStatus("connected");
          setPhoneNumber(data.phone_number);
          if (data.instance_id) setInstanceId(data.instance_id);
          setConnectedAt(new Date().toISOString());
          setQrcode(null);
          stopPolling();
          toast.success("WhatsApp conectado com sucesso!");
        } else if (data?.error) {
          stopPolling();
          setErrorMsg(data.details || data.error);
          setQrcode(null);
          setStatus("disconnected");
        }
      } catch (err: any) {
        console.error("Polling error:", err);
      }
    }, 3000);

    // QR auto-refresh every 30s (Evolution QRs expire ~60s)
    qrRefreshRef.current = setInterval(() => {
      refreshQrCode();
    }, 30_000);

    // QR age counter (UI countdown)
    qrAgeRef.current = setInterval(() => {
      setQrAge((a) => a + 1);
    }, 1000);
  }, [stopPolling, refreshQrCode]);

  const handleConnect = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke("connect-whatsapp");
      if (error) throw error;

      if (data?.error) {
        setErrorMsg(data.details || data.error);
        toast.error(data.error);
        return;
      }

      if (data?.qrcode) {
        setQrcode(data.qrcode);
        setStatus("connecting");
        if (data.instance_id) setInstanceId(data.instance_id);
        startPolling();
      } else {
        toast.error("QR Code não retornado. Tente novamente.");
      }
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || "Não foi possível conectar. Tente novamente.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    stopPolling();
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke("disconnect-whatsapp");
      if (error) throw error;

      if (data?.error) {
        setErrorMsg(data.details || data.error);
        toast.error(data.error);
        return;
      }

      setStatus("disconnected");
      setPhoneNumber(null);
      setInstanceId(null);
      setConnectedAt(null);
      setQrcode(null);
      toast.success("WhatsApp desconectado.");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao desconectar. Tente novamente.");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleReconnect = async () => {
    setReconnecting(true);
    setErrorMsg(null);
    try {
      await supabase.functions.invoke("disconnect-whatsapp");
      setStatus("disconnected");
      setPhoneNumber(null);
      setQrcode(null);

      const { data, error } = await supabase.functions.invoke("connect-whatsapp");
      if (error) throw error;
      if (data?.error) {
        setErrorMsg(data.details || data.error);
        toast.error(data.error);
        return;
      }
      if (data?.qrcode) {
        setQrcode(data.qrcode);
        setStatus("connecting");
        if (data.instance_id) setInstanceId(data.instance_id);
        startPolling();
        toast.success("Escaneie o novo QR Code para reconectar.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao reconectar.");
    } finally {
      setReconnecting(false);
    }
  };

  const qrSrc = qrcode
    ? qrcode.startsWith("data:image")
      ? qrcode
      : `data:image/png;base64,${qrcode.replace(/\s/g, "")}`
    : null;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold font-display text-foreground">WhatsApp Hub</h1>
            <Badge variant="outline" className="bg-gold/5 text-gold border-gold/20 gap-1.5 py-0.5">
              <Zap className="w-3 h-3 fill-gold" />
              Empresa Verificada
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Gestão centralizada de conexões, templates e automações.
          </p>
        </div>
      </div>

      <Tabs defaultValue={defaultTab} onValueChange={(val) => setSearchParams({ tab: val })} className="space-y-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <TabsList className="h-11 w-full lg:w-fit bg-muted/40 p-1 backdrop-blur-md border border-border/50 rounded-xl shadow-sm">
            <TabsTrigger value="connection" className="flex-1 lg:flex-none gap-2 px-6 py-2 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all duration-200">
              <ShieldCheck className="w-4 h-4" />
              Conexão
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex-1 lg:flex-none gap-2 px-6 py-2 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all duration-200">
              <MessageSquare className="w-4 h-4" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="recovery" className="flex-1 lg:flex-none gap-2 px-6 py-2 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all duration-200">
              <RotateCw className="w-4 h-4" />
              Recuperação
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex-1 lg:flex-none gap-2 px-6 py-2 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all duration-200">
              <Activity className="w-4 h-4" />
              Logs
            </TabsTrigger>
            {isSuperAdmin && (
              <TabsTrigger value="admin" className="flex-1 lg:flex-none gap-2 px-6 py-2 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all duration-200">
                <Zap className="w-4 h-4" />
                Admin
              </TabsTrigger>
            )}
          </TabsList>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-1.5 rounded-full border border-border/60 bg-muted/20 px-4 py-2 text-[11px] font-medium text-muted-foreground lg:flex">
              <Clock className="h-3.5 w-3.5 text-gold" />
              Último check: {formatRelative(lastChecked?.toISOString() ?? null)}
            </div>
            {status === "connected" && (
              <Badge className="h-9 border-emerald-500/10 bg-emerald-500/5 px-4 text-emerald-600 font-medium text-[11px] gap-2 rounded-full shadow-none">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Instância Ativa
              </Badge>
            )}
          </div>
        </div>

        <TabsContent value="connection" className="space-y-6 animate-in fade-in duration-300">
          {errorMsg && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Erro de conexão</p>
                <p className="mt-0.5 opacity-90">{errorMsg}</p>
              </div>
            </div>
          )}

          <Card className="overflow-hidden border-border/40 bg-card/30 backdrop-blur-sm shadow-none rounded-[24px]">
            <CardHeader className="relative z-10 border-b border-border/40 bg-muted/5 pb-5 pt-6 px-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/5 text-primary border border-primary/10">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold">Status do Sistema</CardTitle>
                    <p className="text-xs text-muted-foreground">Monitoramento da conexão principal</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative z-10 p-6">
              {status === "connected" ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 flex flex-col justify-between gap-6 p-6 rounded-2xl bg-emerald-500/[0.02] border border-emerald-500/10">
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base font-bold text-foreground">Conexão Ativa</h3>
                          {phoneNumber && (
                            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2 mt-1">
                              <Phone className="w-3.5 h-3.5 text-emerald-500" />
                              {formatPhone(phoneNumber)}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-emerald-500/10">
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Atividade</p>
                          <p className="text-xs font-medium text-foreground">{formatRelative(connectedAt)}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Instância</p>
                          <p className="text-xs font-mono text-foreground truncate">{instanceId}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button onClick={() => setTestOpen(true)} className="h-11 w-full gap-2 rounded-xl bg-primary text-primary-foreground font-semibold shadow-sm">
                        <Send className="w-4 h-4" />
                        Testar Disparo
                      </Button>
                      <Button onClick={handleReconnect} disabled={reconnecting} variant="outline" className="h-11 w-full gap-2 rounded-xl border-border/60 hover:bg-muted/50 transition-all font-medium">
                        {reconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
                        Reconectar
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={handleDisconnect}
                        disabled={disconnecting}
                        className="h-11 w-full gap-2 rounded-xl text-destructive hover:bg-destructive/5 transition-all font-medium"
                      >
                        {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PowerOff className="w-4 h-4" />}
                        Desconectar
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl border border-border/40 bg-muted/10 flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Status</p>
                        <p className="text-xs font-bold">100% Operacional</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : status === "connecting" && qrSrc ? (
                <div className="mx-auto max-w-lg space-y-8 py-4 text-center">
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-foreground">Conecte seu WhatsApp</h3>
                    <p className="text-muted-foreground">Escaneie o código abaixo com o aparelho que enviará as mensagens.</p>
                  </div>

                  <div className="relative mx-auto w-fit p-8 bg-white rounded-[40px] border shadow-2xl transition-all hover:scale-[1.02]">
                    <div className="absolute inset-0 border-[12px] border-primary/5 rounded-[40px] pointer-events-none" />
                    <img
                      src={qrSrc}
                      alt="QR Code WhatsApp"
                      className="w-64 h-64 object-contain relative z-10"
                    />
                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-primary px-6 py-2 text-[10px] font-bold text-primary-foreground shadow-xl tabular-nums">
                      RENOVA EM {Math.max(0, 30 - qrAge)}s
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                    <div className="flex gap-3 p-4 rounded-2xl bg-muted/30 border border-border/40">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold">1</div>
                      <p className="text-xs text-muted-foreground leading-relaxed">Abra o <strong>WhatsApp</strong> no seu celular</p>
                    </div>
                    <div className="flex gap-3 p-4 rounded-2xl bg-muted/30 border border-border/40">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold">2</div>
                      <p className="text-xs text-muted-foreground leading-relaxed">Vá em <strong>Aparelhos Conectados</strong> e escaneie</p>
                    </div>
                  </div>

                  <Button onClick={refreshQrCode} variant="ghost" size="sm" className="gap-2 text-xs hover:bg-gold/5 hover:text-gold transition-colors">
                    <RotateCw className="w-3 h-3" />
                    Não está carregando? Gerar novo QR
                  </Button>
                </div>
              ) : (
                <div className="mx-auto max-w-sm space-y-6 py-10 text-center">
                  <div className="flex justify-center">
                    <div className="h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 flex border border-border/50 text-muted-foreground">
                      <MessageSquare className="h-8 w-8" />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold">Automação WhatsApp</h3>
                    <p className="text-sm text-muted-foreground">Conecte sua instância para ativar notificações e recuperações automáticas.</p>
                  </div>

                  <Button 
                    onClick={handleConnect} 
                    disabled={loading} 
                    className="h-12 w-full gap-2 rounded-xl bg-primary font-bold shadow-sm"
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5 fill-primary-foreground" />}
                    {loading ? "Iniciando..." : "Conectar Instância"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {status === "connected" && (
            <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
              <WhatsAppMetricsCard />
            </Suspense>
          )}
        </TabsContent>

        <TabsContent value="recovery" className="animate-in fade-in duration-300">
          <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
            <WhatsAppRecoveryTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6 animate-in fade-in duration-300">
          <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
            <WhatsAppStarterTemplates />
          </Suspense>
          <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
            <WhatsAppTemplates />
          </Suspense>
        </TabsContent>

        <TabsContent value="logs" className="animate-in fade-in duration-300">
          <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
            <WhatsAppSendLog />
          </Suspense>
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="admin" className="animate-in fade-in duration-300">
            <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
              <WhatsAppFeatureFlags />
            </Suspense>
          </TabsContent>
        )}
      </Tabs>

      <WhatsAppTestMessageDialog open={testOpen} onOpenChange={setTestOpen} />
    </div>
  );
};

export default WhatsApp;
