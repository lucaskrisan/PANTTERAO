// @ts-nocheck
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const WhatsAppTestMessageDialog = ({ open, onOpenChange }: Props) => {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("Olá! Esta é uma mensagem de teste enviada pela PanteraPay 🐆");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      toast.error("Informe um número válido (com DDD).");
      return;
    }
    if (!message.trim()) {
      toast.error("Escreva uma mensagem.");
      return;
    }

    setSending(true);
    try {
      const normalizedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
      const { data, error } = await supabase.functions.invoke("send-whatsapp-message", {
        body: { to_number: normalizedPhone, message: message.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Mensagem de teste enviada!");
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao enviar mensagem de teste.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar mensagem de teste</DialogTitle>
          <DialogDescription>
            Use seu próprio número para validar que o WhatsApp está enviando corretamente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="test-phone">Número (com DDD)</Label>
            <Input
              id="test-phone"
              placeholder="11 99999-9999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
            />
            <p className="text-xs text-muted-foreground">Adicionamos +55 automaticamente.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="test-message">Mensagem</Label>
            <Textarea
              id="test-message"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button onClick={handleSend} disabled={sending} className="gap-2">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? "Enviando..." : "Enviar teste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WhatsAppTestMessageDialog;
