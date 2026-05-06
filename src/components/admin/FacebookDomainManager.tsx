import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Trash2, CheckCircle2, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface FacebookDomain {
  id: string;
  domain: string;
  verified: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onDomainsChange?: (domains: FacebookDomain[]) => void;
}

export default function FacebookDomainManager({ open, onClose, onDomainsChange }: Props) {
  const { user } = useAuth();
  const [domains, setDomains] = useState<FacebookDomain[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [adding, setAdding] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);

  const loadDomains = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("facebook_domains")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    const list = (data || []) as FacebookDomain[];
    setDomains(list);
    onDomainsChange?.(list);
    setLoading(false);
  };

  useEffect(() => {
    if (open) loadDomains();
  }, [open, user]);

  const handleAdd = async () => {
    let clean = newDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (!clean) { toast.error("Digite um domínio válido"); return; }
    // Auto-append .com if no TLD
    if (!clean.includes(".")) clean = clean + ".com";
    setAdding(true);
    const { error } = await supabase.from("facebook_domains").insert({
      domain: clean,
      user_id: user?.id,
    });
    if (error) {
      toast.error("Erro ao adicionar domínio");
    } else {
      toast.success("Domínio adicionado!");
      setNewDomain("");
      setShowAddModal(false);
      loadDomains();
    }
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("facebook_domains").delete().eq("id", id);
    toast.success("Domínio removido");
    loadDomains();
  };

  const handleVerify = async (domain: FacebookDomain) => {
    setVerifying(domain.id);
    try {
      const subdomain = `pixels.${domain.domain}`;
      let resolved = false;

      // Check CNAME first
      try {
        const cnameResp = await fetch(`https://dns.google/resolve?name=${subdomain}&type=CNAME`);
        const cnameJson = await cnameResp.json();
        const cnameAnswers = cnameJson.Answer || [];
        resolved = cnameAnswers.some((a: any) =>
          a.type === 5 && a.data?.toLowerCase().includes("paycheckout")
        );
      } catch {}

      // If CNAME not visible (Cloudflare proxy), check if domain resolves at all via A record
      if (!resolved) {
        try {
          const aResp = await fetch(`https://dns.google/resolve?name=${subdomain}&type=A`);
          const aJson = await aResp.json();
          // If it resolves to ANY IP, the CNAME+proxy is working
          resolved = (aJson.Answer || []).length > 0 && aJson.Status === 0;
        } catch {}
      }

      await supabase
        .from("facebook_domains")
        .update({ verified: resolved })
        .eq("id", domain.id);

      if (resolved) {
        toast.success(`✅ DNS de ${subdomain} está funcionando corretamente!`);
      } else {
        toast.error(`❌ DNS de ${subdomain} ainda não está propagado. Aguarde até 72h ou verifique o CNAME no Cloudflare.`);
      }

      loadDomains();
    } catch {
      toast.error("Não foi possível verificar o DNS. Tente novamente em alguns minutos.");
    }
    setVerifying(null);
  };

  if (!open) return null;

  return (
    <>
      {/* Side panel overlay */}
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative w-full max-w-md bg-card border-l border-border shadow-xl flex flex-col animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">Gerenciar domínios do Facebook</h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Add button */}
          <div className="px-5 pt-4">
            <Button onClick={() => setShowAddModal(true)} size="sm" className="w-full">
              Adicionar domínio
            </Button>
          </div>

          {/* Domain list */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">Domínios</p>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : domains.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhum domínio cadastrado.</p>
            ) : (
              domains.map((d) => (
                <div key={d.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg border border-border bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground">{d.domain}</span>
                    {d.verified ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleVerify(d)}
                      disabled={verifying === d.id}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-muted transition-colors disabled:opacity-50"
                      title="Verificar DNS"
                    >
                      {verifying === d.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </button>
                    <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded-md text-destructive hover:text-destructive/80 hover:bg-muted transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}

            {/* Info link */}
            <div className="pt-4">
              <a
                href="https://developers.facebook.com/docs/marketing-api/conversions-api/guides/capi-gateway"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                ℹ️ Aprenda mais sobre os domínios
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Add domain modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar domínio</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Adicione e verifique os domínios que você usa no gerenciador de anúncios do Facebook.
            </p>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Domínio</Label>
              <Input
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="seudominio.com"
              />
            </div>

            <div className="space-y-3">
              <div className="bg-muted/50 rounded-lg px-4 py-3 text-sm text-foreground">
                <span className="font-medium">2.1.</span> Visite o painel de configurações de DNS do seu domínio
              </div>
              <div className="bg-muted/50 rounded-lg px-4 py-3 text-sm text-foreground">
                <span className="font-medium">2.2.</span> Crie um registro CNAME com o valor{" "}
                <strong>pixels.{(newDomain && !newDomain.includes(".") ? newDomain + ".com" : newDomain) || "seudominio.com"}</strong> apontando para{" "}
                <strong>pixels.app.panttera.com.br</strong>
              </div>
              <div className="bg-muted/50 rounded-lg px-4 py-3 text-sm text-foreground">
                <span className="font-medium">2.3.</span> Salve o DNS e clique no botão 🔄 para verificar
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancelar</Button>
              <Button onClick={handleAdd} disabled={adding}>
                {adding && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
