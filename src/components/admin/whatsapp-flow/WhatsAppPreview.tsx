// @ts-nocheck
import { useMemo } from "react";
import { CheckCircle2, Smartphone } from "lucide-react";

interface Props {
  body: string;
  sampleData?: Record<string, string>;
}

const DEFAULT_SAMPLES: Record<string, string> = {
  "{nome}": "João Silva",
  "{produto}": "Curso Marketing Digital",
  "{valor}": "R$ 297,00",
  "{link}": "https://minha-plataforma.com/acesso/abc123",
  "{telefone}": "(11) 99999-8888",
};

const WhatsAppPreview = ({ body, sampleData }: Props) => {
  const samples = { ...DEFAULT_SAMPLES, ...sampleData };

  const rendered = useMemo(() => {
    let text = body || "Sua mensagem aparecerá aqui...";
    for (const [key, value] of Object.entries(samples)) {
      text = text.replace(new RegExp(key.replace(/[{}]/g, "\\$&"), "gi"), value);
    }
    return text;
  }, [body, samples]);

  return (
    <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Smartphone className="h-4 w-4 text-gold" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold/80">
          Preview WhatsApp
        </p>
      </div>

      <div className="mx-auto max-w-[280px]">
        {/* Phone frame */}
        <div className="rounded-[24px] border-2 border-border/80 bg-[#0b141a] p-1 shadow-2xl">
          {/* Status bar */}
          <div className="flex items-center justify-between px-4 py-1.5">
            <span className="text-[10px] text-white/60">09:41</span>
            <div className="flex gap-1">
              <div className="h-2 w-2 rounded-full bg-white/40" />
              <div className="h-2 w-2 rounded-full bg-white/40" />
            </div>
          </div>

          {/* Chat header */}
          <div className="flex items-center gap-2 bg-[#1f2c34] px-3 py-2 rounded-t-lg">
            <div className="h-8 w-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">
              B
            </div>
            <div>
              <p className="text-[12px] font-medium text-white">Sua Empresa</p>
              <p className="text-[10px] text-white/50">online</p>
            </div>
          </div>

          {/* Chat area */}
          <div className="bg-[#0b141a] min-h-[200px] p-3 space-y-2" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 10 L35 20 L30 15 L25 20Z' fill='%23ffffff05'/%3E%3C/svg%3E\")" }}>
            {/* Message bubble */}
            <div className="ml-auto max-w-[85%]">
              <div className="rounded-xl rounded-tr-sm bg-[#005c4b] px-3 py-2 shadow">
                <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-white/95">
                  {rendered}
                </p>
                <div className="flex items-center justify-end gap-1 mt-1">
                  <span className="text-[9px] text-white/40">09:41</span>
                  <CheckCircle2 className="h-3 w-3 text-blue-300/80" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppPreview;
