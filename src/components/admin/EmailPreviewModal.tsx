import { useState } from "react";
import DOMPurify from "dompurify";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Loader2, Eye, Pencil, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EmailPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: string;
  body: string;
  fullHtml: string;
  to: string;
  customerName: string;
  productName: string;
  orderId?: string | null;
  emailType?: string;
  onSend: (subject: string, body: string) => Promise<void>;
}

const FUNNEL_OPTIONS = [
  { value: "pix_reminder", label: "🔔 Lembrete PIX" },
  { value: "abandoned_cart", label: "🛒 Carrinho Abandonado" },
  { value: "payment_confirmed", label: "✅ Pagamento Confirmado" },
  { value: "access_link", label: "🔗 Link de Acesso" },
  { value: "follow_up", label: "💬 Follow-up" },
];

export function EmailPreviewModal({
  open,
  onOpenChange,
  subject: initialSubject,
  body: initialBody,
  fullHtml,
  to,
  customerName,
  productName,
  orderId,
  emailType,
  onSend,
}: EmailPreviewModalProps) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [tab, setTab] = useState<string>("preview");
  const [funnelType, setFunnelType] = useState<string>(emailType || "pix_reminder");

  // Sync when props change (new modal open)
  const [prevSubject, setPrevSubject] = useState(initialSubject);
  if (initialSubject !== prevSubject) {
    setSubject(initialSubject);
    setBody(initialBody);
    setPrevSubject(initialSubject);
    setTab("preview");
    setFunnelType(emailType || "pix_reminder");
  }

  const handleSend = async () => {
    setSending(true);
    try {
      await onSend(subject, body);
      onOpenChange(false);
    } finally {
      setSending(false);
    }
  };

  const handleGenerateAI = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-email-copy", {
        body: {
          funnel_type: funnelType,
          customer_name: customerName,
          product_name: productName,
          order_id: orderId,
        },
      });

      if (error) throw error;

      if (data?.subject) setSubject(data.subject);
      if (data?.body) setBody(data.body);

      toast.success("Email gerado pela IA com sucesso!");
      setTab("edit");
    } catch (err) {
      console.error("AI generation error:", err);
      toast.error("Falha ao gerar email com IA. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  };

  // Build a simple preview by replacing body in the fullHtml template
  const previewHtml = fullHtml.replace(initialBody, body);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            ✉️ Email — {customerName}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Para: <strong>{to}</strong> · Produto: <strong>{productName}</strong>
          </p>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="preview" className="gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="edit" className="gap-1.5">
              <Pencil className="w-3.5 h-3.5" />
              Editar
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              IA
            </TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="flex-1 min-h-0 overflow-auto mt-3">
            <div className="space-y-3">
              <div className="px-3 py-2 bg-muted rounded-md">
                <p className="text-xs text-muted-foreground">Assunto</p>
                <p className="text-sm font-medium text-foreground">{subject}</p>
              </div>
              <div className="border border-border rounded-lg overflow-hidden">
                <iframe
                  srcDoc={previewHtml}
                  className="w-full h-[400px] bg-white"
                  title="Email preview"
                  sandbox=""
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="edit" className="flex-1 min-h-0 overflow-auto mt-3">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Assunto do email</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Assunto do email..."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Corpo do email <span className="text-muted-foreground font-normal">(HTML)</span>
                </Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={12}
                  className="font-mono text-xs"
                  placeholder="HTML do corpo do email..."
                />
                <p className="text-xs text-muted-foreground">
                  O bloco do produto, botão de pagamento e rodapé são adicionados automaticamente.
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="ai" className="flex-1 min-h-0 overflow-auto mt-3">
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">Gerar Email com IA</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Selecione o tipo de funil e a IA vai gerar um email personalizado com base no produto e cliente.
                </p>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Tipo de Funil</Label>
                    <Select value={funnelType} onValueChange={setFunnelType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FUNNEL_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-2 bg-background rounded border border-border">
                      <p className="text-xs text-muted-foreground">Cliente</p>
                      <p className="font-medium text-foreground">{customerName}</p>
                    </div>
                    <div className="p-2 bg-background rounded border border-border">
                      <p className="text-xs text-muted-foreground">Produto</p>
                      <p className="font-medium text-foreground">{productName}</p>
                    </div>
                  </div>

                  <Button
                    onClick={handleGenerateAI}
                    disabled={generating}
                    className="w-full gap-2"
                    size="lg"
                  >
                    {generating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    {generating ? "Gerando com IA..." : "Gerar Email com IA"}
                  </Button>
                </div>
              </div>

              {body && (
                <div className="p-3 bg-muted/30 rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Preview do corpo gerado:</p>
                  <div
                    className="text-sm text-foreground prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(body) }}
                  />
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button onClick={handleSend} disabled={sending} className="gap-2">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
