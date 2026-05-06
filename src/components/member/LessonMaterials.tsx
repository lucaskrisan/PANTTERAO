import { useEffect, useState, useCallback } from "react";
import { Download, FileText, Link2, Video, File, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MemberTranslations } from "@/lib/memberI18n";

interface Material { id: string; title: string; description: string | null; file_url: string | null; material_type: string; }
const materialIcons: Record<string, typeof FileText> = { file: File, pdf: FileText, link: Link2, video: Video };

function extractStoragePath(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/\/storage\/v1\/object\/(?:public\/)?course-materials\/(.+)/);
  return match ? match[1] : null;
}

export default function LessonMaterials({ lessonId, client, accessToken, t }: { lessonId: string; client: SupabaseClient; accessToken?: string; t: MemberTranslations; }) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    client.from("lesson_materials").select("*").eq("lesson_id", lessonId).order("sort_order").then(({ data }) => setMaterials(data || []));
  }, [lessonId]);

  const handleDownload = useCallback(async (material: Material) => {
    if (!material.file_url) return;
    const storagePath = extractStoragePath(material.file_url);
    if (!storagePath) { window.open(material.file_url, "_blank"); return; }
    setDownloading(material.id);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY };
      if (accessToken) headers['x-access-token'] = accessToken;
      const { data: { session } } = await client.auth.getSession();
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/signed-material-url`, { method: 'POST', headers, body: JSON.stringify({ file_path: storagePath }) });
      const result = await res.json();
      if (res.ok && result.signedUrl) {
        const a = document.createElement("a"); a.href = result.signedUrl; a.target = "_blank"; a.rel = "noopener noreferrer";
        a.setAttribute("download", storagePath.split("/").pop() || material.title);
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      } else {
        const { data, error } = await client.storage.from("course-materials").createSignedUrl(storagePath, 3600);
        if (data?.signedUrl) { const a = document.createElement("a"); a.href = data.signedUrl; a.target = "_blank"; a.rel = "noopener noreferrer"; document.body.appendChild(a); a.click(); document.body.removeChild(a); }
        else { alert(t.errorLoading); }
      }
    } catch { alert(t.errorLoading); }
    finally { setDownloading(null); }
  }, [client, accessToken, t]);

  if (materials.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 rounded-2xl border p-5" style={{ background: "hsl(220 18% 10%)", borderColor: "hsl(220 15% 14%)" }}>
      <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
        <Download className="w-4 h-4 text-[hsl(145,65%,50%)]" />{t.supplementaryMaterial}
      </h3>
      <div className="space-y-2">
        {materials.map((m) => {
          const Icon = materialIcons[m.material_type] || File;
          const isLoading = downloading === m.id;
          return (
            <button key={m.id} onClick={() => handleDownload(m)} disabled={isLoading} className="flex items-center gap-3 p-3 rounded-xl transition-all hover:scale-[1.01] w-full text-left" style={{ background: "hsl(220,18%,14%)" }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "hsl(220,18%,18%)" }}>
                <Icon className="w-4 h-4 text-[hsl(145,65%,50%)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{m.title}</p>
                {m.description && <p className="text-[hsl(220,10%,45%)] text-xs truncate">{m.description}</p>}
              </div>
              {isLoading ? <Loader2 className="w-4 h-4 text-[hsl(145,65%,50%)] flex-shrink-0 animate-spin" /> : <Download className="w-4 h-4 text-[hsl(220,10%,40%)] flex-shrink-0" />}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
