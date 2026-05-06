import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CreditCard, ShieldCheck, Zap, Info, ExternalLink, Activity } from "lucide-react";
import type { GatewayConfig } from "@/pages/admin/Gateways";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gateway: GatewayConfig | null;
  onSaved: () => void;
}

const GatewayFormDialog = ({ open, onOpenChange, gateway, onSaved }: Props) => {
  const { user } = useAuth();
  const [form, setForm] = useState<GatewayConfig>({
    provider: "asaas",
    name: "",
    environment: "sandbox",
    active: false,
    payment_methods: [],
    config: {},
  });
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState(false);

  useEffect(() => {
    if (gateway) {
      setForm({ ...gateway });
      setValidated(false);
    }
  }, [gateway]);

  const isEditing = !!form.id;
  const usesGlobalSecret = form.config.credential_source === "global_secret";

  const updateConfig = (key: string, value: any) => {
    setForm((f) => ({ ...f, config: { ...f.config, [key]: value } }));
  };

  const togglePaymentMethod = (method: string) => {
    setForm((f) => ({
      ...f,
      payment_methods: f.payment_methods.includes(method)
        ? f.payment_methods.filter((m) => m !== method)
        : [...f.payment_methods, method],
    }));
  };

  const validateApiKey = async (): Promise<boolean> => {
    setValidating(true);
    try {
      console.log("[validate-gateway] Calling with:", {
        provider: form.provider,
        environment: form.environment,
        has_api_key: !!form.config.api_key,
        api_key_prefix: form.config.api_key ? String(form.config.api_key).substring(0, 8) : null,
      });

      const { data, error } = await supabase.functions.invoke("validate-gateway", {
        body: {
          provider: form.provider,
          api_key: form.config.api_key,
          environment: form.environment,
        },
      });

      console.log("[validate-gateway] Response:", { data, error });

      if (error) {
        console.error("[validate-gateway] Invoke error:", error);
        toast.error(`Erro ao validar chave: ${error.message || "tente novamente"}`);
        return false;
      }

      if (!data?.valid) {
        toast.error(data?.error || "Chave API inválida.");
        return false;
      }

      if (data.warning) {
        toast.warning(data.warning);
      }

      setValidated(true);
      return true;
    } catch (err: any) {
      console.error("[validate-gateway] Exception:", err);
      toast.error(`Erro ao validar chave: ${err?.message || "erro desconhecido"}`);
      return false;
    } finally {
      setValidating(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Nome da conexão é obrigatório");
      return;
    }

    if (!usesGlobalSecret && !form.config.api_key?.trim()) {
      toast.error("API Key é obrigatória");
      return;
    }

    // Stripe-specific validation
    if (form.provider === "stripe") {
      const sk = String(form.config.api_key || "").trim();
      const pk = String(form.config.publishable_key || "").trim();
      if (!sk.startsWith("sk_")) {
        toast.error('Secret Key inválida. Deve começar com "sk_test_" ou "sk_live_".');
        return;
      }
      if (!pk) {
        toast.error("Publishable Key é obrigatória para Stripe.");
        return;
      }
      if (!pk.startsWith("pk_")) {
        toast.error('Publishable Key inválida. Deve começar com "pk_test_" ou "pk_live_".');
        return;
      }
      if (sk.startsWith("pk_")) {
        toast.error("Você colou uma Publishable Key (pk_) no campo Secret Key.");
        return;
      }
      if (pk.startsWith("sk_")) {
        toast.error("Você colou uma Secret Key (sk_) no campo Publishable Key.");
        return;
      }
      const isTest = sk.startsWith("sk_test_");
      const pkIsTest = pk.startsWith("pk_test_");
      if (isTest !== pkIsTest) {
        toast.error("Secret Key e Publishable Key precisam ser do mesmo ambiente (ambas test ou ambas live).");
        return;
      }
    }

    // Validate API key before saving. Global secrets are already stored securely in the backend.
    if (!usesGlobalSecret) {
      const isValid = await validateApiKey();
      if (!isValid) return;
    }

    setSaving(true);

    const configPayload: Record<string, any> = usesGlobalSecret
      ? { ...form.config, credential_source: "global_secret" }
      : { ...form.config, credential_source: "user_provided" };

    const payload = {
      provider: form.provider,
      name: form.name,
      environment: form.environment,
      active: form.active,
      payment_methods: form.payment_methods,
      config: configPayload,
      updated_at: new Date().toISOString(),
    };

    console.log("[save-gateway] Payload:", {
      ...payload,
      config: { ...payload.config, api_key: "***", publishable_key: payload.config.publishable_key ? "***" : undefined },
      user_id: user?.id,
      isEditing,
    });

    let error;
    if (isEditing) {
      ({ error } = await supabase.from("payment_gateways").update(payload).eq("id", form.id!));
    } else {
      ({ error } = await supabase.from("payment_gateways").insert({ ...payload, user_id: user?.id }));
    }

    setSaving(false);
    if (error) {
      console.error("[save-gateway] Supabase error:", error);
      const msg = error.message || "";
      if (msg.includes("payment_gateways_provider_check") || msg.includes("violates check constraint")) {
        toast.error("Provedor não permitido pelo banco. Atualize a página e tente novamente — o schema acabou de ser corrigido.");
      } else {
        toast.error(`Erro ao salvar: ${msg || "tente novamente"}`);
      }
    } else {
      toast.success(isEditing ? "Gateway atualizado!" : "Gateway criado! ✓ Chave validada");
      onSaved();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 bg-[#0d0f15] border-white/10 shadow-2xl overflow-hidden">
        <DialogHeader className="p-8 pb-4 border-b border-white/5 bg-gradient-to-br from-primary/10 via-transparent to-transparent">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center shadow-lg">
              <CreditCard className="w-6 h-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-foreground">
                {isEditing ? "Configurar" : "Nova Conexão"} — {
                  form.provider === "asaas" ? "Asaas" :
                  form.provider === "pagarme" ? "Pagar.me" :
                  form.provider === "mercadopago" ? "Mercado Pago" : "Stripe"
                }
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {form.provider === "asaas"
                  ? "Aceite pagamentos via Pix e Cartão de Crédito de forma simples e segura."
                  : form.provider === "pagarme"
                  ? "Processamento rápido e confiável de pagamentos com Pix e Cartão."
                  : form.provider === "mercadopago"
                  ? "O gateway mais popular do Brasil. PIX, Cartão e Boleto."
                  : "Gateway global para cartões internacionais e PIX."}
              </p>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] px-8 py-6">
          <div className="space-y-6 pt-4">
            {/* Basic settings */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Configuração da Conexão</h3>

              <div className="space-y-1.5">
                <Label>Nome da Conexão *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder='Ex: "Conta PIX", "Conta Cartão"' />
              </div>

              <div className="space-y-1.5">
                <Label>Ambiente</Label>
                <Select value={form.environment} onValueChange={(v: "sandbox" | "production") => setForm({ ...form, environment: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox (Testes)</SelectItem>
                    <SelectItem value="production">Produção</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Selecione "Produção" apenas quando estiver pronto para receber pagamentos reais</p>
              </div>

              <div className="space-y-1.5">
                <Label>
                  {form.provider === "stripe" ? "Secret Key (sk_…) *" : usesGlobalSecret ? "API Key" : "API Key *"}
                </Label>
                {usesGlobalSecret && (
                  <div className="flex items-center gap-2 rounded-md border border-border bg-accent/30 px-3 py-2 text-sm text-foreground">
                    <Badge variant="secondary">Conectado</Badge>
                    <span className="text-muted-foreground">Chave segura já configurada no backend.</span>
                  </div>
                )}
                <Input
                  type="password"
                  value={usesGlobalSecret ? "••••••••••••••••" : form.config.api_key ?? ""}
                  onChange={(e) => {
                    updateConfig("api_key", e.target.value);
                    if (form.config.credential_source === "global_secret") {
                      updateConfig("credential_source", "user_provided");
                    }
                  }}
                  disabled={usesGlobalSecret}
                  placeholder={
                    form.provider === "asaas" ? "Cole sua API Key do Asaas" :
                    form.provider === "pagarme" ? "Cole sua Secret Key do Pagar.me" :
                    form.provider === "mercadopago" ? "Cole seu Access Token do Mercado Pago" :
                    "sk_test_… ou sk_live_…"
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {form.provider === "asaas"
                    ? "Encontre em: Minha Conta > Integrações > API"
                    : form.provider === "pagarme"
                    ? "Encontre em: Pagar.me Dashboard > Configurações > Chaves"
                    : form.provider === "mercadopago"
                    ? "Encontre em: Suas Integrações > Credenciais"
                    : "Encontre em: Stripe Dashboard → Developers → API Keys → Secret key"}
                </p>
              </div>

              {form.provider === "stripe" && (
                <div className="space-y-1.5">
                  <Label>Publishable Key (pk_…) *</Label>
                  <Input
                    type="text"
                    value={form.config.publishable_key ?? ""}
                    onChange={(e) => updateConfig("publishable_key", e.target.value)}
                    placeholder="pk_test_… ou pk_live_…"
                  />
                  <p className="text-xs text-muted-foreground">
                    Encontre em: Stripe Dashboard → Developers → API Keys → <strong>Publishable key</strong>. Necessária para renderizar o formulário de cartão no checkout.
                  </p>
                </div>
              )}

              {form.provider === "stripe" && (
                <div className="rounded-lg border border-border bg-accent/30 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <Label className="text-sm font-semibold text-foreground">Stripe Tax</Label>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Coleta IVA / VAT / GST automaticamente por país (EU, México, Colômbia, Austrália, etc).
                        Requer <strong>Stripe Tax habilitado</strong> no dashboard do Stripe e registros de imposto configurados.
                        <br />
                        <span className="text-[11px]">Custo adicional: +0,5% por transação cobrado pela Stripe.</span>
                      </p>
                    </div>
                    <Switch
                      checked={form.config.tax_enabled === true}
                      onCheckedChange={(v) => updateConfig("tax_enabled", v)}
                    />
                  </div>
                </div>
              )}
            </div>

            {form.provider === "asaas" && (
              <>
                <Separator />
                {/* Antifraude notice */}
                <div className="bg-accent/50 border border-border rounded-lg p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">⚠️ Importante: Antifraude e Endereço</h4>
                  <p className="text-xs text-muted-foreground">
                    Se o Antifraude Asaas estiver <strong>ATIVO</strong>: é obrigatório coletar o endereço completo dos clientes.
                    Para pagamentos via PIX ou Boleto, o endereço é sempre opcional.
                  </p>
                </div>

                <Separator />
                {/* PIX fees */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">Taxas PIX</h3>
                  <p className="text-xs text-muted-foreground">Quem paga: Você (vendedor) · Para quem: Asaas</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Taxa Percentual (%)</Label>
                      <Input type="number" step="0.01" value={form.config.pix_fee_percent ?? 0} onChange={(e) => updateConfig("pix_fee_percent", parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Taxa Fixa (R$)</Label>
                      <Input type="number" step="0.01" value={form.config.pix_fee_fixed ?? 0.44} onChange={(e) => updateConfig("pix_fee_fixed", parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Validade do PIX (dias)</Label>
                      <Input type="number" value={form.config.pix_validity_days ?? 1} onChange={(e) => updateConfig("pix_validity_days", parseInt(e.target.value) || 1)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Timer PIX (minutos)</Label>
                      <Select value={String(form.config.pix_timer_minutes ?? 30)} onValueChange={(v) => updateConfig("pix_timer_minutes", parseInt(v))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15 minutos</SelectItem>
                          <SelectItem value="30">30 minutos (padrão)</SelectItem>
                          <SelectItem value="60">60 minutos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />
                {/* Debit fees */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">Taxas Cartão de Débito</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Taxa Percentual (%)</Label>
                      <Input type="number" step="0.01" value={form.config.debit_fee_percent ?? 1.89} onChange={(e) => updateConfig("debit_fee_percent", parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Taxa Fixa (R$)</Label>
                      <Input type="number" step="0.01" value={form.config.debit_fee_fixed ?? 0.35} onChange={(e) => updateConfig("debit_fee_fixed", parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>
                </div>

                <Separator />
                {/* Credit MDR fees */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">Taxas Cartão de Crédito (MDR)</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>À Vista (%)</Label>
                      <Input type="number" step="0.01" value={form.config.credit_fee_1x ?? 2.99} onChange={(e) => updateConfig("credit_fee_1x", parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>2 a 6x (%)</Label>
                      <Input type="number" step="0.01" value={form.config.credit_fee_2_6x ?? 2.99} onChange={(e) => updateConfig("credit_fee_2_6x", parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>7 a 12x (%)</Label>
                      <Input type="number" step="0.01" value={form.config.credit_fee_7_12x ?? 2.99} onChange={(e) => updateConfig("credit_fee_7_12x", parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>13 a 21x (%)</Label>
                      <Input type="number" step="0.01" value={form.config.credit_fee_13_21x ?? 4.29} onChange={(e) => updateConfig("credit_fee_13_21x", parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Custo de Processamento (R$)</Label>
                    <Input type="number" step="0.01" value={form.config.credit_processing_fee ?? 0.44} onChange={(e) => updateConfig("credit_processing_fee", parseFloat(e.target.value) || 0)} />
                  </div>
                </div>

                <Separator />
                {/* Billing description */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">Como Aparece para o Cliente</h3>
                  <div className="space-y-1.5">
                    <Label>Texto da cobrança</Label>
                    <Input value={form.config.billing_description ?? ""} onChange={(e) => updateConfig("billing_description", e.target.value)} placeholder="Ex: Pagamento de produto" maxLength={100} />
                    <p className="text-xs text-muted-foreground">Deixe em branco para usar a descrição do produto. Máximo: 100 caracteres.</p>
                  </div>
                </div>

                <Separator />
                {/* Installments */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">Configuração de Parcelamento (Juros)</h3>
                  <p className="text-xs text-muted-foreground">Quem paga: Cliente · Para quem: Você (vendedor)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Máximo de Parcelas</Label>
                      <Select value={String(form.config.max_installments ?? 12)} onValueChange={(v) => updateConfig("max_installments", parseInt(v))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 18, 21].map((n) => (
                            <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Valor Mínimo Parcela (R$)</Label>
                      <Input type="number" step="0.01" value={form.config.min_installment_value ?? 5} onChange={(e) => updateConfig("min_installment_value", parseFloat(e.target.value) || 5)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Parcelas Sem Juros</Label>
                      <Select value={String(form.config.free_installments ?? 1)} onValueChange={(v) => updateConfig("free_installments", parseInt(v))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                            <SelectItem key={n} value={String(n)}>{n}x sem juros</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Taxa de Juros Inicial (%)</Label>
                      <Input type="number" step="0.01" value={form.config.interest_rate_initial ?? 6.58} onChange={(e) => updateConfig("interest_rate_initial", parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Taxa Incremental (%)</Label>
                      <Input type="number" step="0.01" value={form.config.interest_rate_incremental ?? 1.45} onChange={(e) => updateConfig("interest_rate_incremental", parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>
                </div>
              </>
            )}

            {form.provider === "pagarme" && (
              <>
                <Separator />
                {/* Antifraude notice */}
                <div className="bg-accent/50 border border-border rounded-lg p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">⚠️ Importante: Antifraude e Endereço</h4>
                  <p className="text-xs text-muted-foreground">
                    Se o Antifraude Pagar.me estiver <strong>ATIVO</strong>: é obrigatório coletar o endereço completo dos clientes.
                    Se estiver <strong>DESLIGADO</strong>: o endereço é opcional.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Dica: Verifique no dashboard do Pagar.me em Configurações → Antifraude se está ativo ou não.
                  </p>
                </div>

                <Separator />
                {/* Pagar.me guide */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">📋 Como obter sua Secret Key</h3>
                  <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                    <li>Acesse <strong>dashboard.pagar.me</strong></li>
                    <li>Vá em <strong>Configurações → Chaves</strong></li>
                    <li>Copie a <strong>Secret Key</strong> (começa com <code className="bg-muted px-1 rounded">sk_</code>)</li>
                    <li>Cole no campo <strong>API Key</strong> acima</li>
                  </ol>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => window.open("https://dashboard.pagar.me", "_blank")}>
                    Abrir Dashboard Pagar.me ↗
                  </Button>
                </div>

                <Separator />
                {/* Taxas PIX */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">Taxas PIX</h3>
                  <p className="text-xs text-muted-foreground">Quem paga: Você (vendedor) · Para quem: Gateway de pagamento</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Taxa Percentual (%)</Label>
                      <Input type="number" step="0.01" value={form.config.pix_fee_percent ?? 0.89} onChange={(e) => updateConfig("pix_fee_percent", parseFloat(e.target.value) || 0)} />
                      <p className="text-xs text-muted-foreground">Ex: 0.89% (Pagar.me padrão)</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Taxa Fixa (R$)</Label>
                      <Input type="number" step="0.01" value={form.config.pix_fee_fixed ?? 0.44} onChange={(e) => updateConfig("pix_fee_fixed", parseFloat(e.target.value) || 0)} />
                      <p className="text-xs text-muted-foreground">Ex: R$ 0,44 por transação</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Timer PIX (minutos)</Label>
                    <Select value={String(form.config.pix_timer_minutes ?? 30)} onValueChange={(v) => updateConfig("pix_timer_minutes", parseInt(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 minutos</SelectItem>
                        <SelectItem value="30">30 minutos (padrão)</SelectItem>
                        <SelectItem value="60">60 minutos</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Tempo exibido no timer da página de pagamento PIX para o cliente.</p>
                  </div>
                </div>

                <Separator />
                {/* Taxas Cartão de Crédito (MDR) */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">Taxas Cartão de Crédito (MDR)</h3>
                  <p className="text-xs text-muted-foreground">Quem paga: Você (vendedor) · Para quem: Gateway de pagamento</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>À Vista (%)</Label>
                      <Input type="number" step="0.01" value={form.config.credit_fee_1x ?? 2.99} onChange={(e) => updateConfig("credit_fee_1x", parseFloat(e.target.value) || 0)} />
                      <p className="text-xs text-muted-foreground">Crédito em 1x</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>2 a 6x (%)</Label>
                      <Input type="number" step="0.01" value={form.config.credit_fee_2_6x ?? 2.99} onChange={(e) => updateConfig("credit_fee_2_6x", parseFloat(e.target.value) || 0)} />
                      <p className="text-xs text-muted-foreground">Parcelado até 6x</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>7 a 12x (%)</Label>
                      <Input type="number" step="0.01" value={form.config.credit_fee_7_12x ?? 2.99} onChange={(e) => updateConfig("credit_fee_7_12x", parseFloat(e.target.value) || 0)} />
                      <p className="text-xs text-muted-foreground">Parcelado 7x ou mais</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Custo de Processamento (R$)</Label>
                    <Input type="number" step="0.01" value={form.config.credit_processing_fee ?? 0.44} onChange={(e) => updateConfig("credit_processing_fee", parseFloat(e.target.value) || 0)} />
                    <p className="text-xs text-muted-foreground">Custo fixo por transação de cartão</p>
                  </div>
                </div>

                <Separator />
                {/* Soft descriptor */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">Como Aparece na Fatura do Cartão</h3>
                  <div className="space-y-1.5">
                    <Label>Nome que aparece para o cliente</Label>
                    <Input value={form.config.soft_descriptor ?? ""} onChange={(e) => updateConfig("soft_descriptor", e.target.value.slice(0, 13))} placeholder="Ex: MINHA LOJA" maxLength={13} />
                    <p className="text-xs text-muted-foreground">Este nome aparece na fatura do cartão do cliente. Máximo: 13 caracteres. Deixe em branco para usar o nome padrão.</p>
                  </div>
                </div>

                <Separator />
                {/* Installments */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">Configuração de Parcelamento (Juros)</h3>
                  <p className="text-xs text-muted-foreground">Quem paga: Cliente · Para quem: Você (vendedor)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Máximo de Parcelas</Label>
                      <Select value={String(form.config.max_installments ?? 12)} onValueChange={(v) => updateConfig("max_installments", parseInt(v))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                            <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Valor Mínimo Parcela (R$)</Label>
                      <Input type="number" step="0.01" value={form.config.min_installment_value ?? 5} onChange={(e) => updateConfig("min_installment_value", parseFloat(e.target.value) || 5)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Parcelas Sem Juros</Label>
                      <Select value={String(form.config.free_installments ?? 1)} onValueChange={(v) => updateConfig("free_installments", parseInt(v))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                            <SelectItem key={n} value={String(n)}>{n}x sem juros</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Taxa de Juros Inicial (%)</Label>
                      <Input type="number" step="0.01" value={form.config.interest_rate_initial ?? 6.58} onChange={(e) => updateConfig("interest_rate_initial", parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Taxa Incremental (%)</Label>
                      <Input type="number" step="0.01" value={form.config.interest_rate_incremental ?? 1.45} onChange={(e) => updateConfig("interest_rate_incremental", parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>
                </div>

                <Separator />
                {/* Exemplo prático */}
                <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-foreground">📊 Exemplo Prático: Como as Taxas Funcionam</h4>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <div>
                      <p className="font-medium text-foreground">Venda PIX - R$ 100,00</p>
                      <p>Você paga: {form.config.pix_fee_percent ?? 0.89}% + R$ {(form.config.pix_fee_fixed ?? 0.44).toFixed(2)} = R$ {((100 * (form.config.pix_fee_percent ?? 0.89) / 100) + (form.config.pix_fee_fixed ?? 0.44)).toFixed(2)}</p>
                      <p>Recebe líquido: R$ {(100 - ((100 * (form.config.pix_fee_percent ?? 0.89) / 100) + (form.config.pix_fee_fixed ?? 0.44))).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Venda Cartão 1x - R$ 100,00</p>
                      <p>Você paga: MDR {form.config.credit_fee_1x ?? 2.99}% + R$ {(form.config.credit_processing_fee ?? 0.44).toFixed(2)}</p>
                      <p>Recebe líquido: R$ {(100 - ((100 * (form.config.credit_fee_1x ?? 2.99) / 100) + (form.config.credit_processing_fee ?? 0.44))).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {(form.provider === "mercadopago" || form.provider === "stripe") && (
              <>
                {form.provider === "stripe" && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-foreground">🔗 Configuração do Webhook</h3>
                      <div className="bg-accent/50 border border-border rounded-lg p-4 space-y-3">
                        <p className="text-xs text-muted-foreground">
                          Para receber confirmações de pagamento automáticas, configure um webhook no painel do Stripe:
                        </p>
                        <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                          <li>Acesse <strong>Stripe Dashboard → Developers → Webhooks</strong></li>
                          <li>Clique em <strong>"Add endpoint"</strong></li>
                          <li>Cole a URL: <code className="bg-muted px-1.5 py-0.5 rounded text-[10px] select-all">https://vipltojtcrqatwvzobro.supabase.co/functions/v1/stripe-webhook</code></li>
                          <li>Selecione os eventos: <strong>checkout.session.completed, charge.refunded</strong></li>
                          <li>Copie o <strong>Signing Secret</strong> (começa com <code className="bg-muted px-1 rounded">whsec_</code>) e cole abaixo</li>
                        </ol>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Webhook Signing Secret</Label>
                        <Input
                          type="password"
                          value={form.config.webhook_secret ?? ""}
                          onChange={(e) => updateConfig("webhook_secret", e.target.value)}
                          placeholder="whsec_..."
                        />
                        <p className="text-xs text-muted-foreground">Encontre em: Stripe Dashboard → Developers → Webhooks → Signing secret</p>
                      </div>
                    </div>
                  </>
                )}

                <Separator />
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">
                    Taxas {form.provider === "mercadopago" ? "Mercado Pago" : "Stripe"}
                  </h3>
                  <p className="text-xs text-muted-foreground">Informativo — as taxas são cobradas diretamente pelo gateway</p>
                  {form.provider === "mercadopago" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Taxa PIX (%)</Label>
                        <Input type="number" step="0.01" value={form.config.pix_fee_percent ?? 0.99} onChange={(e) => updateConfig("pix_fee_percent", parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Taxa Cartão 1x (%)</Label>
                        <Input type="number" step="0.01" value={form.config.credit_fee_1x ?? 4.98} onChange={(e) => updateConfig("credit_fee_1x", parseFloat(e.target.value) || 0)} />
                      </div>
                    </div>
                  )}
                  {form.provider === "stripe" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Taxa Cartão (%)</Label>
                        <Input type="number" step="0.01" value={form.config.credit_fee_percent ?? 3.99} onChange={(e) => updateConfig("credit_fee_percent", parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Taxa Fixa (R$)</Label>
                        <Input type="number" step="0.01" value={form.config.credit_fee_fixed ?? 0.39} onChange={(e) => updateConfig("credit_fee_fixed", parseFloat(e.target.value) || 0)} />
                      </div>
                    </div>
                  )}
                </div>

                <Separator />
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">Parcelamento</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Máximo de Parcelas</Label>
                      <Select value={String(form.config.max_installments ?? 12)} onValueChange={(v) => updateConfig("max_installments", parseInt(v))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                            <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Valor Mínimo Parcela (R$)</Label>
                      <Input type="number" step="0.01" value={form.config.min_installment_value ?? 5} onChange={(e) => updateConfig("min_installment_value", parseFloat(e.target.value) || 5)} />
                    </div>
                  </div>
                </div>
              </>
            )}

            <Separator />
            {/* Payment methods */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Métodos de Pagamento</h3>
              <p className="text-xs text-muted-foreground">Selecione quais métodos de pagamento deseja ativar para este gateway</p>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div>
                    <span className="text-sm font-medium">PIX</span>
                  </div>
                  <Switch
                    checked={form.payment_methods.includes("pix")}
                    onCheckedChange={() => togglePaymentMethod("pix")}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div>
                    <span className="text-sm font-medium">Cartão de Crédito</span>
                  </div>
                  <Switch
                    checked={form.payment_methods.includes("credit_card")}
                    onCheckedChange={() => togglePaymentMethod("credit_card")}
                  />
                </div>
              </div>
            </div>

            <Separator className="bg-white/5" />
            
            {/* Activate */}
            <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-xl">
              <div>
                <span className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  Ativar Gateway
                </span>
                <p className="text-xs text-muted-foreground mt-0.5">Disponibilizar este gateway no checkout imediatamente</p>
              </div>
              <Switch 
                checked={form.active} 
                onCheckedChange={(v) => setForm({ ...form, active: v })}
                className="data-[state=checked]:bg-primary"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button 
                onClick={handleSave} 
                disabled={saving || validating} 
                className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold h-11"
              >
                {validating ? (
                  <span className="flex items-center gap-2">
                    <Activity className="w-4 h-4 animate-spin" />
                    Validando...
                  </span>
                ) : saving ? (
                  "Salvando..."
                ) : (
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    {isEditing ? "Validar e Salvar Alterações" : "Validar e Criar Conexão"}
                  </span>
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="border-white/10 hover:bg-white/5 h-11"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default GatewayFormDialog;
