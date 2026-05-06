import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  ChevronRight, 
  ChevronLeft,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Step {
  title: string;
  description: string;
  targetId: string;
  position: "right" | "left" | "top" | "bottom";
}

const steps: Step[] = [
  {
    title: "Sua Caixa de Ferramentas",
    description: "Aqui estão os componentes que você pode arrastar para o canvas para montar seu funil.",
    targetId: "tutorial-palette",
    position: "right"
  },
  {
    title: "Métricas em Tempo Real",
    description: "Acompanhe os acessos e vendas totais do seu teste conforme ele escala.",
    targetId: "tutorial-stats",
    position: "right"
  },
  {
    title: "Conecte os Pontos",
    description: "Para definir o caminho do cliente, clique e arraste das 'bolinhas' coloridas de um bloco até o outro. É assim que você cria o fluxo!",
    targetId: "tutorial-canvas",
    position: "left"
  },
  {
    title: "Link de Campanha",
    description: "O nó azul contém a sua URL de Entrada. Copie esse link e coloque-o nos seus anúncios do Meta ou Google.",
    targetId: "tutorial-canvas", // Aimed at canvas but will focus contextually
    position: "left"
  },
  {
    title: "Controle de Voo",
    description: "Dê um nome ao projeto e inicie o teste aqui. O sistema cuidará da rotação de tráfego sozinho.",
    targetId: "tutorial-actions",
    position: "bottom"
  }
];

export function AbTestTutorial({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const step = steps[currentStep];
      const element = document.getElementById(step.targetId);
      if (element) {
        const rect = element.getBoundingClientRect();
        let top = rect.top;
        let left = rect.left;

        if (step.position === "right") {
          left = rect.right + 20;
          top = rect.top + (rect.height / 2) - 100;
        } else if (step.position === "bottom") {
          top = rect.bottom + 20;
          left = rect.left + (rect.width / 2) - 150;
        } else if (step.position === "left") {
          left = rect.left - 320;
          top = rect.top + (rect.height / 2) - 100;
        }

        setCoords({ top, left });
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [open, currentStep]);

  if (!open) return null;

  const step = steps[currentStep];

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] pointer-events-auto" onClick={() => onOpenChange(false)} />
      
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 10 }}
          className="absolute pointer-events-auto w-[300px] bg-[#1a1d25] border border-violet-500/30 shadow-[0_0_30px_rgba(139,92,246,0.2)] rounded-xl p-5"
          style={{ top: coords.top, left: coords.left }}
        >
          {/* Arrow */}
          <div 
            className={`absolute w-3 h-3 bg-[#1a1d25] border-t border-l border-violet-500/30 rotate-[-45deg] ${
              step.position === "right" ? "-left-1.5 top-1/2 -translate-y-1/2" :
              step.position === "bottom" ? "-top-1.5 left-1/2 -translate-x-1/2 rotate-[45deg]" :
              step.position === "left" ? "-right-1.5 top-1/2 -translate-y-1/2 rotate-[135deg]" : ""
            }`}
          />

          <div className="flex justify-between items-start mb-3">
            <h3 className="font-bold text-lg text-white leading-tight">{step.title}</h3>
            <button onClick={() => onOpenChange(false)} className="text-zinc-500 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <p className="text-zinc-400 text-sm leading-relaxed mb-6">
            {step.description}
          </p>

          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {steps.map((_, i) => (
                <div 
                  key={i} 
                  className={`h-1 rounded-full transition-all duration-300 ${i === currentStep ? 'w-4 bg-violet-500' : 'w-1 bg-zinc-700'}`}
                />
              ))}
            </div>
            
            <div className="flex gap-2">
              {currentStep > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={(e) => { e.stopPropagation(); setCurrentStep(prev => prev - 1); }}
                  className="h-8 text-xs text-zinc-400"
                >
                  <ChevronLeft className="h-3 w-3 mr-1" /> Voltar
                </Button>
              )}
              <Button 
                size="sm" 
                onClick={(e) => { 
                  e.stopPropagation();
                  if (currentStep < steps.length - 1) setCurrentStep(prev => prev + 1);
                  else onOpenChange(false);
                }}
                className="h-8 text-xs bg-violet-600 hover:bg-violet-700 text-white border-0"
              >
                {currentStep === steps.length - 1 ? "Entendi!" : "Próximo"}
                {currentStep < steps.length - 1 && <ChevronRight className="h-3 w-3 ml-1" />}
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Overlay highlight effect (concept) */}
      <style dangerouslySetInnerHTML={{ __html: `
        #${step.targetId} {
          position: relative;
          z-index: 101;
          box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.5), 0 0 20px rgba(139, 92, 246, 0.3);
          pointer-events: none;
        }
      `}} />
    </div>
  );
}
