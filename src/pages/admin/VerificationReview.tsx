// @ts-nocheck
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  ShieldCheck, Loader2, CheckCircle2, XCircle, Clock, Eye, Search,
} from "lucide-react";

interface Verification {
  id: string;
  user_id: string;
  document_type: string;
  document_front_url: string | null;
  document_back_url: string | null;
  selfie_url: string | null;
  address_proof_url: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  profiles?: { full_name: string | null };
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "secondary" },
  approved: { label: "Aprovado", variant: "default" },
  rejected: { label: "Recusado", variant: "destructive" },
};

const VerificationReview = () => {
  const { user, isSuperAdmin } = useAuth();
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Verification | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [filter, setFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user && isSuperAdmin) loadData();
  }, [user, isSuperAdmin, filter]);

  const loadData = async () => {
    setLoading(true);
    let query = supabase
      .from("producer_verifications")
      .select("*")
      .order("created_at", { ascending: false });

    if (filter !== "all") {
      query = query.eq("status", filter);
    }

    const { data: verData } = await query;
    const items = (verData ?? []) as unknown as Verification[];

    // Fetch profile names for all user_ids
    const userIds = [...new Set(items.map(v => v.user_id))];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]));
      items.forEach(v => { v.profiles = { full_name: profileMap.get(v.user_id) || null }; });
    }

    setVerifications(items);
    setLoading(false);
  };

  const getSignedUrl = async (path: string) => {
    if (!path) return null;
    if (signedUrls[path]) return signedUrls[path];
    const { data } = await supabase.storage
      .from("verification-documents")
      .createSignedUrl(path, 600);
    if (data?.signedUrl) {
      setSignedUrls(prev => ({ ...prev, [path]: data.signedUrl }));
      return data.signedUrl;
    }
    return null;
  };

  const openReview = async (v: Verification) => {
    setSelected(v);
    setRejectionReason(v.rejection_reason || "");
    // Pre-load signed URLs
    const paths = [v.document_front_url, v.document_back_url, v.selfie_url, v.address_proof_url].filter(Boolean) as string[];
    await Promise.all(paths.map(getSignedUrl));
  };

  const handleDecision = async (decision: "approved" | "rejected") => {
    if (!selected) return;
    if (decision === "rejected" && !rejectionReason.trim()) {
      toast.error("Informe o motivo da rejeição");
      return;
    }
    setProcessing(true);
    try {
      const { error } = await supabase
        .from("producer_verifications")
        .update({
          status: decision,
          rejection_reason: decision === "rejected" ? rejectionReason : null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user!.id,
        })
        .eq("id", selected.id);

      if (error) throw error;

      // Update profile verified flag
      if (decision === "approved") {
        await supabase
          .from("profiles")
          .update({ verified: true })
          .eq("id", selected.user_id);
      }

      toast.success(decision === "approved" ? "Produtor verificado ✅" : "Verificação rejeitada");
      setSelected(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar");
    } finally {
      setProcessing(false);
    }
  };

  if (!isSuperAdmin) return null;

  const filtered = verifications.filter(v => {
    if (!search) return true;
    const name = (v.profiles?.full_name || "").toLowerCase();
    return name.includes(search.toLowerCase()) || v.user_id.includes(search);
  });

  const counts = {
    pending: verifications.filter(v => v.status === "pending").length,
    all: verifications.length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="w-6 h-6" /> Verificação de Produtores
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Revise documentos enviados pelos produtores para validação de identidade
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {[
          { key: "pending", label: "Pendentes", count: counts.pending },
          { key: "approved", label: "Aprovados" },
          { key: "rejected", label: "Rejeitados" },
          { key: "all", label: "Todos", count: counts.all },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filter === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 border border-border text-foreground hover:bg-muted"
            }`}
          >
            {f.label} {f.count !== undefined && `(${f.count})`}
          </button>
        ))}
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar produtor..."
            className="pl-8 h-8 text-xs w-48"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <ShieldCheck className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma verificação {filter === "pending" ? "pendente" : "encontrada"}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Produtor</TableHead>
                  <TableHead className="text-xs">Documento</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(v => {
                  const st = STATUS_MAP[v.status] || STATUS_MAP.pending;
                  return (
                    <TableRow key={v.id}>
                      <TableCell className="py-3">
                        <p className="text-sm font-medium">{v.profiles?.full_name || "—"}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{v.user_id.slice(0, 8)}</p>
                      </TableCell>
                      <TableCell className="py-3 text-xs text-muted-foreground uppercase">{v.document_type}</TableCell>
                      <TableCell className="py-3">
                        <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                      </TableCell>
                      <TableCell className="py-3 text-xs text-muted-foreground">
                        {new Date(v.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => openReview(v)}>
                          <Eye className="w-3.5 h-3.5 mr-1" /> Revisar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Review Modal */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              Revisão — {selected?.profiles?.full_name || selected?.user_id.slice(0, 8)}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Documento: {selected?.document_type?.toUpperCase()} · Enviado em {selected ? new Date(selected.created_at).toLocaleDateString("pt-BR") : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Document images */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: "Frente do Documento", path: selected?.document_front_url },
                { label: "Verso do Documento", path: selected?.document_back_url },
                { label: "Selfie com Documento", path: selected?.selfie_url },
              ]
                .filter(d => d.path)
                .map(d => (
                  <div key={d.label} className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">{d.label}</p>
                    {signedUrls[d.path!] ? (
                      <img
                        src={signedUrls[d.path!]}
                        alt={d.label}
                        className="w-full rounded-lg border border-border object-contain max-h-64 bg-muted/30"
                      />
                    ) : (
                      <div className="w-full h-32 rounded-lg border border-border bg-muted/30 flex items-center justify-center">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                ))}
            </div>

            {/* Rejection reason */}
            {selected?.status !== "approved" && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Motivo da rejeição (obrigatório para rejeitar)</p>
                <Textarea
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="Ex: Documento ilegível, selfie não corresponde..."
                  className="text-sm min-h-[80px]"
                />
              </div>
            )}

            {/* Actions */}
            {selected?.status === "pending" && (
              <div className="flex gap-3 pt-2">
                <Button
                  className="flex-1 gap-2"
                  onClick={() => handleDecision("approved")}
                  disabled={processing}
                >
                  {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Aprovar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 gap-2"
                  onClick={() => handleDecision("rejected")}
                  disabled={processing}
                >
                  {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Rejeitar
                </Button>
              </div>
            )}

            {selected?.status === "approved" && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-center">
                <CheckCircle2 className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-sm font-medium text-primary">Verificação aprovada</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Revisado em {selected.reviewed_at ? new Date(selected.reviewed_at).toLocaleDateString("pt-BR") : "—"}
                </p>
              </div>
            )}

            {selected?.status === "rejected" && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <XCircle className="w-5 h-5 text-destructive mx-auto mb-1" />
                <p className="text-sm font-medium text-destructive text-center">Verificação rejeitada</p>
                <p className="text-xs text-muted-foreground mt-1">{selected.rejection_reason}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VerificationReview;