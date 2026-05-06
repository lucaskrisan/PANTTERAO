import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Trash2, FileText, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Material {
  id: string;
  title: string;
  description: string | null;
  file_url: string | null;
  material_type: string;
  sort_order: number;
}

export default function LessonMaterialsManager({ lessonId }: { lessonId: string }) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [uploading, setUploading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("file");
  const [newUrl, setNewUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase
      .from("lesson_materials")
      .select("*")
      .eq("lesson_id", lessonId)
      .order("sort_order");
    setMaterials(data || []);
  };

  useEffect(() => { load(); }, [lessonId]);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${lessonId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("course-materials")
      .upload(path, file);

    if (uploadError) {
      toast.error("Erro no upload: " + uploadError.message);
      setUploading(false);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("course-materials")
      .getPublicUrl(path);

    setUploading(false);
    return urlData.publicUrl;
  };

  const addMaterial = async () => {
    if (!newTitle.trim()) { toast.error("Título obrigatório"); return; }

    let fileUrl = newUrl;

    if (newType === "file" && fileRef.current?.files?.[0]) {
      const url = await handleFileUpload(fileRef.current.files[0]);
      if (!url) return;
      fileUrl = url;
    }

    if (!fileUrl) { toast.error("Selecione um arquivo ou informe uma URL"); return; }

    setAdding(true);
    const maxOrder = materials.length > 0 ? Math.max(...materials.map(m => m.sort_order)) + 1 : 0;

    const { error } = await supabase.from("lesson_materials").insert({
      lesson_id: lessonId,
      title: newTitle.trim(),
      material_type: newType,
      file_url: fileUrl,
      sort_order: maxOrder,
    });

    if (error) {
      toast.error("Erro ao adicionar material");
    } else {
      toast.success("Material adicionado!");
      setNewTitle("");
      setNewUrl("");
      if (fileRef.current) fileRef.current.value = "";
      load();
    }
    setAdding(false);
  };

  const deleteMaterial = async (id: string) => {
    if (!confirm("Excluir este material?")) return;
    await supabase.from("lesson_materials").delete().eq("id", id);
    toast.success("Material excluído");
    load();
  };

  return (
    <div className="space-y-4 border-t pt-4 mt-4">
      <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
        <FileText className="w-4 h-4" /> Materiais Complementares
      </h4>

      {/* Existing materials */}
      {materials.length > 0 && (
        <div className="space-y-2">
          {materials.map(m => (
            <div key={m.id} className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{m.title}</p>
                <p className="text-xs text-muted-foreground capitalize">{m.material_type}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMaterial(m.id)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add new material */}
      <div className="space-y-3 bg-muted/20 rounded-lg p-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Título</Label>
            <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Ex: Apostila PDF" className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tipo</Label>
            <Select value={newType} onValueChange={setNewType}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="file">Arquivo (Upload)</SelectItem>
                <SelectItem value="pdf">PDF (Upload)</SelectItem>
                <SelectItem value="link">Link externo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {newType === "link" ? (
          <div className="space-y-1">
            <Label className="text-xs">URL</Label>
            <Input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://..." className="h-8 text-sm" />
          </div>
        ) : (
          <div className="space-y-1">
            <Label className="text-xs">Arquivo</Label>
            <Input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt,.csv,.mp3,.mp4" className="h-8 text-sm" />
          </div>
        )}

        <Button
          size="sm"
          onClick={addMaterial}
          disabled={uploading || adding}
          className="gap-2 w-full"
        >
          {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
          {uploading ? "Enviando..." : "Adicionar Material"}
        </Button>
      </div>
    </div>
  );
}
