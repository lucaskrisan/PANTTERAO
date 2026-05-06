// @ts-nocheck
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ShieldCheck, Upload, Loader2, CheckCircle2, XCircle, Clock, Camera, FileText } from "lucide-react";

interface Verification {
  id: string;
  document_type: string;
  document_front_url: string | null;
  document_back_url: string | null;
  selfie_url: string | null;
  address_proof_url: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
}

const DOC_TYPES = [
  { value: "rg", label: "RG (Identidade)" },
  { value: "cnh", label: "CNH (Habilitação)" },
  { value: "passport", label: "Passaporte" },
];

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  pending: { label: "Em análise", color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30", icon: Clock },
  approved: { label: "Verificado", color: "bg-green-500/10 text-green-500 border-green-500/30", icon: CheckCircle2 },
  rejected: { label: "Recusado", color: "bg-red-500/10 text-red-500 border-red-500/30", icon: XCircle },
};

export default function ProducerVerification() {
  const { user } = useAuth();
  const [verification, setVerification] = useState<Verification | null>(null);
  const [profileVerified, setProfileVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [docType, setDocType] = useState("rg");
  const [uploads, setUploads] = useState<Record<string, File | null>>({
    front: null, back: null, selfie: null,
  });
  const [previews, setPreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    loadVerification();
  }, [user]);

  const loadVerification = async () => {
    const [{ data: verData }, { data: profileData }] = await Promise.all([
      supabase
        .from("producer_verifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("verified")
        .eq("id", user!.id)
        .single(),
    ]);
    setVerification(verData);
    setProfileVerified(profileData?.verified === true);
    setLoading(false);
  };

  const handleFileChange = (key: string, file: File | null) => {
    setUploads(prev => ({ ...prev, [key]: file }));
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviews(prev => ({ ...prev, [key]: url }));
    } else {
      setPreviews(prev => { const n = { ...prev }; delete n[key]; return n; });
    }
  };

  const uploadFile = async (file: File, folder: string) => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user!.id}/${folder}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("verification-documents").upload(path, file, { upsert: true });
    if (error) throw error;
    return path;
  };

  const handleSubmit = async () => {
    if (!uploads.front || !uploads.selfie) {
      toast.error("Envie pelo menos: frente do documento e selfie");
      return;
    }
    setSubmitting(true);
    try {
      const frontPath = await uploadFile(uploads.front!, "doc_front");
      const backPath = uploads.back ? await uploadFile(uploads.back, "doc_back") : null;
      const selfiePath = await uploadFile(uploads.selfie!, "selfie");

      const { error } = await supabase.from("producer_verifications").insert({
        user_id: user!.id,
        document_type: docType,
        document_front_url: frontPath,
        document_back_url: backPath,
        selfie_url: selfiePath,
        address_proof_url: null,
      });

      if (error) throw error;
      toast.success("Documentos enviados para análise!");
      setUploads({ front: null, back: null, selfie: null });
      setPreviews({});
      await loadVerification();
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar documentos");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Card className="border-border/50"><CardContent className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></CardContent></Card>;

  const status = verification ? STATUS_MAP[verification.status] || STATUS_MAP.pending : null;

  // Already verified — check both verification record AND profile flag
  if (verification?.status === "approved" || profileVerified) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-10 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Identidade verificada</h3>
          <p className="text-sm text-muted-foreground mt-1">Você já pode vender!</p>
        </CardContent>
      </Card>
    );
  }

  // Pending review
  if (verification?.status === "pending") {
    return (
      <Card className="border-yellow-500/30 bg-yellow-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-display flex items-center gap-2 text-yellow-500">
            <Clock className="w-4 h-4" /> Verificação em Análise
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Seus documentos foram enviados e estão sendo analisados. Você será notificado quando a verificação for concluída.</p>
          <p className="text-xs text-muted-foreground mt-2">Enviado em {new Date(verification.created_at).toLocaleDateString("pt-BR")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-display flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" /> Verificação de Identidade
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Envie seus documentos para obter o selo de verificado no seu perfil. Produtores verificados transmitem mais confiança aos compradores.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {verification?.status === "rejected" && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p className="text-sm font-medium text-red-500">Verificação recusada</p>
            <p className="text-xs text-red-400 mt-1">{verification.rejection_reason || "Documentos não aprovados. Envie novamente."}</p>
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-xs">Tipo de documento</Label>
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FileUploadBox label="Frente do documento *" icon={FileText} file={uploads.front} preview={previews.front} onChange={(f) => handleFileChange("front", f)} />
          <FileUploadBox label="Verso do documento" icon={FileText} file={uploads.back} preview={previews.back} onChange={(f) => handleFileChange("back", f)} />
          <FileUploadBox label="Selfie com documento *" icon={Camera} file={uploads.selfie} preview={previews.selfie} onChange={(f) => handleFileChange("selfie", f)} />
        </div>

        <p className="text-[11px] text-muted-foreground">* Campos obrigatórios. Aceitamos JPG, PNG ou PDF. Máximo 5MB por arquivo.</p>

        <Button onClick={handleSubmit} disabled={submitting} className="w-full">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
          {submitting ? "Enviando..." : "Enviar para verificação"}
        </Button>
      </CardContent>
    </Card>
  );
}

function FileUploadBox({ label, icon: Icon, file, preview, onChange }: {
  label: string; icon: any; file: File | null; preview?: string;
  onChange: (f: File | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div
      onClick={() => ref.current?.click()}
      className="border-2 border-dashed border-border/60 rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
    >
      <input
        ref={ref}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] || null)}
      />
      {preview ? (
        <img src={preview} alt={label} className="w-full h-24 object-cover rounded mb-2" />
      ) : (
        <Icon className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
      )}
      <p className="text-xs font-medium">{file?.name || label}</p>
      {file && <p className="text-[10px] text-muted-foreground mt-1">{(file.size / 1024).toFixed(0)} KB</p>}
    </div>
  );
}
