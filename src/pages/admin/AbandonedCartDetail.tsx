import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, CheckCircle2, Copy, Mail } from "lucide-react";
import WhatsAppIcon from "@/components/WhatsAppIcon";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface CartDetail {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_cpf: string | null;
  payment_method: string | null;
  recovered: boolean;
  created_at: string;
  updated_at: string;
  product_id: string;
  checkout_step: string | null;
  ip_address: string | null;
  user_agent: string | null;
  checkout_url: string | null;
  email_recovery_sent_at: string | null;
  email_recovery_status: string | null;
  notes: string | null;
  product_price: number | null;
  page_url: string | null;
  products?: { name: string; image_url: string | null; price: number } | null;
}

const STEPS = [
  { key: "opened", label: "Checkout aberto" },
  { key: "personal_info", label: "Informações pessoais" },
  { key: "payment", label: "Pagamento" },
];

const stepIndex = (step: string | null) => {
  if (step === "payment") return 2;
  if (step === "personal_info") return 1;
  return 0;
};

const AbandonedCartDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [cart, setCart] = useState<CartDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data } = await supabase
        .from("abandoned_carts")
        .select("*, products(name, image_url, price)")
        .eq("id", id)
        .single();
      if (data) {
        setCart(data as any);
        setNotes((data as any).notes || "");
      }
      setLoading(false);
    };
    load();
  }, [id]);

  const saveNotes = async () => {
    if (!cart) return;
    setSavingNotes(true);
    await supabase
      .from("abandoned_carts")
      .update({ notes } as any)
      .eq("id", cart.id);
    setSavingNotes(false);
    toast.success("Notas salvas!");
  };

  const sendRecoveryEmail = async () => {
    if (!cart) return;
    setSendingEmail(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const res = await supabase.functions.invoke("send-abandoned-cart-email", {
        body: { cart_id: cart.id },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.error) {
        toast.error("Erro ao enviar e-mail: " + (res.error.message || "Erro desconhecido"));
      } else {
        toast.success("E-mail de recuperação enviado!");
        setCart(prev => prev ? {
          ...prev,
          email_recovery_sent_at: new Date().toISOString(),
          email_recovery_status: "sent",
        } : null);
      }
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
    setSendingEmail(false);
  };

  const sendWhatsAppRecovery = async () => {
    if (!cart) return;
    setSendingWhatsApp(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      // Calculate recovery link
      const baseUrl = cart.checkout_url || cart.page_url || "";
      let recoveryLink = baseUrl;
      if (baseUrl) {
        try {
          const u = new URL(baseUrl);
          ["name", "email", "phone", "cpf"].forEach(k => u.searchParams.delete(k));
          u.searchParams.set("cart_id", cart.id);
          u.searchParams.set("utm_source", "manual_recovery");
          u.searchParams.set("utm_medium", "whatsapp");
          recoveryLink = u.toString();
        } catch (_) {}
      }

      const res = await supabase.functions.invoke("whatsapp-dispatch", {
        body: {
          tenant_id: (cart as any).user_id,
          order_id: cart.id,
          customer_phone: cart.customer_phone,
          customer_name: cart.customer_name || "Cliente",
          product_name: cart.products?.name || "Produto",
          product_price: (cart.product_price || cart.products?.price || 0).toString(),
          access_link: recoveryLink,
          category: "abandono",
        },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.error || !res.data?.success) {
        const errorMsg = res.error?.message || res.data?.details || res.data?.error || "Erro desconhecido";
        toast.error("Erro ao enviar WhatsApp: " + errorMsg);
      } else {
        toast.success("Mensagem de WhatsApp enviada com sucesso!");
      }
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
    setSendingWhatsApp(false);
  };

  const copyUrl = () => {
    const url = cart?.checkout_url || cart?.page_url || "";
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const openWhatsApp = () => {
    if (!cart?.customer_phone) return;
    const clean = cart.customer_phone.replace(/\D/g, "");
    const number = clean.startsWith("55") ? clean : `55${clean}`;
    const msg = encodeURIComponent("Olá! Vi que você se interessou pelo nosso produto. Posso te ajudar?");
    window.open(`https://wa.me/${number}?text=${msg}`, "_blank");
  };

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">Carregando...</div>;
  }

  if (!cart) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Carrinho não encontrado.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/admin/abandoned")}>
          Voltar
        </Button>
      </div>
    );
  }

  const isRecovered = cart.recovered === true;
  const currentStep = isRecovered ? STEPS.length : stepIndex(cart.checkout_step);
  const productPrice = cart.product_price || cart.products?.price || 0;
  const checkoutUrl = cart.checkout_url || cart.page_url || "";

  const dropoffMessage = () => {
    if (isRecovered) return "✅ Cliente concluiu a compra";
    if (cart.checkout_step === "payment") return "O cliente chegou ao pagamento mas não finalizou";
    if (cart.checkout_step === "personal_info") return "O cliente parou nas informações pessoais";
    return "O cliente saiu sem preencher nenhuma informação";
  };

  const initial = (cart.customer_name || "?")[0].toUpperCase();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/admin/abandoned")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-xl font-bold text-foreground">
          #{cart.id.slice(0, 8)}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            {format(new Date(cart.created_at), "dd/MM/yyyy h:mma", { locale: ptBR })}
          </span>
        </h1>
      </div>

      {/* Recovery banner */}
      {cart.email_recovery_sent_at && (
        <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-green-800">Email de recuperação de carrinho enviado</p>
            <p className="text-sm text-green-700">Um lembrete foi enviado para o e-mail do seu cliente</p>
            {checkoutUrl && (
              <button onClick={copyUrl} className="mt-2 flex items-center gap-1.5 rounded border border-border bg-background px-3 py-1.5 text-xs font-mono hover:bg-muted/50">
                <Copy className="h-3 w-3" />
                <span className="truncate max-w-[400px]">{checkoutUrl}</span>
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Cart details */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Detalhes do carrinho</CardTitle>
              <p className="text-xs text-muted-foreground">De Loja online</p>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                {cart.products?.image_url && (
                  <img src={cart.products.image_url} alt="" className="w-14 h-14 rounded object-cover" />
                )}
                <div className="flex-1">
                  <p className="font-medium text-primary">{cart.products?.name || "Produto"}</p>
                </div>
                <div className="text-right text-sm">
                  <span>R$ {productPrice.toFixed(2)}</span>
                  <span className="mx-2 text-muted-foreground">×</span>
                  <span>1</span>
                  <span className="ml-4 font-medium">R$ {productPrice.toFixed(2)}</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border text-right">
                <span className="text-sm text-muted-foreground mr-2">Total</span>
                <span className="font-bold">R$ {productPrice.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Checkout progress */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Progresso do checkout</CardTitle>
              <p className="text-xs text-muted-foreground">Jornada do cliente durante o processo de checkout</p>
            </CardHeader>
            <CardContent>
              {/* Timeline */}
              <div className="flex items-center justify-between mb-6">
                {STEPS.map((step, i) => (
                  <div key={step.key} className="flex items-center flex-1">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        i < currentStep
                          ? "bg-green-500 text-white"
                          : i === currentStep
                          ? "bg-amber-500 text-white animate-pulse"
                          : "bg-gray-200 text-gray-500"
                      }`}>
                        {i < currentStep ? "✓" : i === currentStep ? "●" : ""}
                      </div>
                      <p className="text-xs mt-1 text-center max-w-[100px]">{step.label}</p>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`flex-1 h-1 mx-2 rounded ${
                        i < currentStep ? "bg-green-500" : "bg-gray-200"
                      }`} />
                    )}
                  </div>
                ))}
              </div>

              {/* Dropoff alert */}
              <div className={`rounded-lg border p-3 ${isRecovered ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
                <p className={`text-sm font-medium ${isRecovered ? "text-green-800" : "text-amber-800"}`}>{isRecovered ? "" : "⚠ "}{dropoffMessage()}</p>
                <p className={`text-xs mt-1 ${isRecovered ? "text-green-700" : "text-amber-700"}`}>
                  Última atividade: {format(new Date(cart.updated_at), "dd/MM/yyyy h:mma", { locale: ptBR })}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Logs */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Logs de checkout</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {cart.checkout_step === "payment"
                  ? "O cliente chegou até o pagamento mas não finalizou o pedido."
                  : cart.checkout_step === "personal_info"
                  ? "O cliente preencheu informações pessoais mas não avançou para o pagamento."
                  : "O cliente fechou a página do checkout e não finalizou o pedido."}
              </p>
            </CardContent>
          </Card>

          {/* Origin */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Origem do acesso</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IP</TableHead>
                    <TableHead>Tempo</TableHead>
                    <TableHead>Navegador</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-xs font-mono">{cart.ip_address || "—"}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {format(new Date(cart.created_at), "dd/MM/yyyy h:mma", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-xs max-w-[400px] break-all">{cart.user_agent || "—"}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Client card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                  {initial}
                </div>
                <div>
                  <p className="font-medium text-primary">{cart.customer_name || "—"}</p>
                  <p className="text-xs text-muted-foreground">{cart.customer_email || ""}</p>
                </div>
              </div>
              {cart.customer_phone && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">{cart.customer_phone}</span>
                  <button onClick={openWhatsApp} className="text-green-500 hover:text-green-600">
                    <WhatsAppIcon className="h-5 w-5" />
                  </button>
                </div>
              )}

              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium">Notas ✏️</p>
                </div>
                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Adicionar notas sobre este cliente..."
                  className="min-h-[80px] text-sm"
                />
                <Button size="sm" variant="outline" className="mt-2 w-full" onClick={saveNotes} disabled={savingNotes}>
                  {savingNotes ? "Salvando..." : "Salvar notas"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="space-y-2">
            {cart.email_recovery_sent_at ? (
              <Button variant="outline" className="w-full gap-2" disabled>
                <Mail className="w-4 h-4" />
                E-mail já enviado ({format(new Date(cart.email_recovery_sent_at), "dd/MM HH:mm")})
              </Button>
            ) : (
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={sendRecoveryEmail}
                disabled={sendingEmail || !cart.customer_email}
              >
                <Mail className="w-4 h-4" />
                {sendingEmail ? "Enviando..." : "Enviar e-mail de recuperação"}
              </Button>
            )}

            <Button
              variant="default"
              className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={sendWhatsAppRecovery}
              disabled={sendingWhatsApp || !cart.customer_phone}
            >
              <WhatsAppIcon className="w-4 h-4" />
              {sendingWhatsApp ? "Enviando..." : "Enviar WhatsApp Nativo"}
            </Button>

            <Button
              variant="ghost"
              className="w-full gap-2 text-muted-foreground text-xs"
              onClick={openWhatsApp}
              disabled={!cart.customer_phone}
            >
              <WhatsAppIcon className="w-3 h-3 opacity-70" />
              Abrir conversa manual (wa.me)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AbandonedCartDetail;
