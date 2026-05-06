import { useState } from "react";
import { BookOpen, ChevronDown, ChevronRight, ExternalLink, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface Props {
  hasPixels: boolean;
}

const steps = [
  {
    number: 1,
    title: "Crie seu produto",
    description: "Acesse a página de Produtos e cadastre seu produto com nome, preço e imagem. Esse será o produto vinculado ao seu pixel.",
    action: { label: "Ir para Produtos", route: "/admin/products" },
  },
  {
    number: 2,
    title: "Obtenha seu Pixel ID do Meta",
    description: "No Gerenciador de Eventos do Facebook, copie o ID do seu Pixel. Ele tem o formato de um número com ~15 dígitos (ex: 123456789012345).",
    tip: "Acesse business.facebook.com → Gerenciador de Eventos → Selecione seu Pixel → Copie o ID.",
    externalLink: "https://business.facebook.com/events_manager2",
  },
  {
    number: 3,
    title: "Gere o Token CAPI (Conversions API)",
    description: "Ainda no Gerenciador de Eventos, vá em Configurações → Gerar token de acesso. Esse token permite que o servidor envie eventos diretamente ao Meta, aumentando a precisão.",
    tip: "O token CAPI é essencial para o disparo server-side (CAPI). Sem ele, você terá apenas rastreamento via navegador, que é bloqueado por adblockers.",
    externalLink: "https://business.facebook.com/events_manager2",
  },
  {
    number: 4,
    title: "Configure o Pixel no produto",
    description: "Edite seu produto → aba Pixels → Cole o Pixel ID e o Token CAPI. Salve. O sistema vai configurar automaticamente o disparo híbrido (Browser + Server).",
    action: { label: "Ir para Produtos", route: "/admin/products" },
  },
  {
    number: 5,
    title: "Gere o script de integração",
    description: "Volte ao painel de Rastreamento → Script de Integração → Selecione o produto → Copie o código e cole na sua landing page, antes do </head>.",
    tip: "O script já inclui PageView, ViewContent e propagação cross-domain de fbclid, fbp e visitor_id automaticamente.",
  },
  {
    number: 6,
    title: "Verifique com o Diagnóstico",
    description: "Use a ferramenta de Diagnóstico abaixo para validar se tudo está funcionando. Cole a URL da sua landing page na verificação de página e execute o diagnóstico do produto.",
    tip: "O ideal é ter 100% de saúde e o selo DUAL ✓ em todos os eventos, confirmando que Browser e Server estão sincronizados.",
  },
];

const TrackingOnboardingGuide = ({ hasPixels }: Props) => {
  const [expanded, setExpanded] = useState(!hasPixels);
  const navigate = useNavigate();

  return (
    <div className="rounded-lg bg-slate-800/50 border border-slate-700/30 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-2.5 hover:bg-slate-700/20 transition-colors"
      >
        <BookOpen className="w-4 h-4 text-amber-400" />
        <div className="text-left flex-1">
          <h2 className="text-sm font-semibold text-slate-200">
            Guia de Configuração do Pixel + CAPI
          </h2>
          <p className="text-[10px] text-slate-500">
            {hasPixels
              ? "Passo a passo para configurar o rastreamento avançado"
              : "⚡ Nenhum pixel configurado — siga o guia para começar"}
          </p>
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-500" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-1">
          {/* Progress bar */}
          {hasPixels && (
            <div className="flex items-center gap-2 mb-3 px-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] text-emerald-400 font-medium">
                Pixel configurado! Revise os passos abaixo se precisar ajustar algo.
              </span>
            </div>
          )}

          <div className="space-y-2">
            {steps.map((step) => (
              <StepCard key={step.number} step={step} navigate={navigate} />
            ))}
          </div>

          {/* Quick tip */}
          <div className="mt-4 rounded-md bg-amber-500/5 border border-amber-500/20 p-3">
            <p className="text-[11px] text-amber-300/80 leading-relaxed">
              💡 <strong>Dica:</strong> Após configurar, o feed ao vivo mostrará os eventos em tempo real.
              Eventos com o selo <span className="text-cyan-300 font-mono text-[10px] bg-cyan-400/10 px-1 rounded">DUAL ✓</span> confirmam
              que o disparo híbrido (Browser + Server) está funcionando e a deduplicação no Meta está ativa.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

const StepCard = ({
  step,
  navigate,
}: {
  step: (typeof steps)[0];
  navigate: (path: string) => void;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-md bg-slate-900/40 border border-slate-700/20 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-slate-700/10 transition-colors"
      >
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold shrink-0">
          {step.number}
        </span>
        <span className="text-xs font-medium text-slate-200 text-left flex-1">
          {step.title}
        </span>
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
        )}
      </button>

      {open && (
        <div className="px-3 pb-3 pl-11 space-y-2">
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {step.description}
          </p>

          {step.tip && (
            <p className="text-[10px] text-slate-500 leading-relaxed italic">
              💡 {step.tip}
            </p>
          )}

          <div className="flex items-center gap-2 pt-1">
            {step.action && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[10px] gap-1 border-slate-600 text-slate-300 hover:bg-slate-700"
                onClick={() => navigate(step.action!.route)}
              >
                {step.action.label}
              </Button>
            )}
            {step.externalLink && (
              <a
                href={step.externalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Abrir no Meta
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TrackingOnboardingGuide;
