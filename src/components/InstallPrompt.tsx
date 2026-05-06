import { useState, useEffect, useCallback } from "react";
import { X, Download, Share, MoreVertical, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "android" | "ios" | "desktop" | "unknown";

function detectPlatform(): Platform {
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Windows|Mac|Linux/.test(ua) && !/Mobile/.test(ua)) return "desktop";
  return "unknown";
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [platform] = useState<Platform>(detectPlatform);

  useEffect(() => {
    if (isStandalone()) return;
    const dismissed = sessionStorage.getItem("install-prompt-dismissed");
    if (dismissed) return;

    let promptCaptured = false;

    const handler = (e: Event) => {
      e.preventDefault();
      console.log("[InstallPrompt] beforeinstallprompt capturado");
      promptCaptured = true;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show popup immediately after capturing the native prompt
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // For iOS/browsers that don't fire beforeinstallprompt, show after 2s with instructions
    const timer = setTimeout(() => {
      if (!promptCaptured) {
        console.log("[InstallPrompt] Sem prompt nativo, exibindo instruções (iOS/outro)");
        setShowPrompt(true);
        setShowInstructions(true);
      }
    }, 2000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(timer);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      console.log("[InstallPrompt] Disparando prompt nativo de instalação...");
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log("[InstallPrompt] Resultado:", outcome);
        if (outcome === "accepted") {
          setShowPrompt(false);
          sessionStorage.setItem("install-prompt-dismissed", "1");
        }
      } catch (err) {
        console.error("[InstallPrompt] Erro no prompt:", err);
      }
      setDeferredPrompt(null);
    } else {
      // Fallback: show manual instructions
      setShowInstructions(true);
    }
  }, [deferredPrompt]);

  const handleDismiss = () => {
    setShowPrompt(false);
    setShowInstructions(false);
    sessionStorage.setItem("install-prompt-dismissed", "1");
  };

  if (!showPrompt || isStandalone()) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-sm mx-4 mb-4 sm:mb-0 rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground">
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1 rounded-full hover:bg-white/20 transition"
          >
            <X size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">
              <Smartphone size={28} />
            </div>
            <div>
              <h3 className="font-bold text-lg">Instalar PanteraPay</h3>
              <p className="text-sm opacity-90">Acesso rápido na tela inicial</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5">
          {!showInstructions ? (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                Instale o app para acessar suas vendas com um toque, receber notificações e usar offline.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={handleDismiss}>
                  Agora não
                </Button>
                <Button className="flex-1 gap-2" onClick={handleInstall}>
                  <Download size={18} />
                  Instalar
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              {platform === "ios" && (
                <>
                  <p className="text-sm font-medium text-foreground">No Safari:</p>
                  <div className="flex items-start gap-3 text-sm text-muted-foreground">
                    <Share size={20} className="shrink-0 text-primary mt-0.5" />
                    <span>Toque no botão <strong>Compartilhar</strong> (ícone de quadrado com seta para cima)</span>
                  </div>
                  <div className="flex items-start gap-3 text-sm text-muted-foreground">
                    <Download size={20} className="shrink-0 text-primary mt-0.5" />
                    <span>Selecione <strong>"Adicionar à Tela de Início"</strong></span>
                  </div>
                </>
              )}
              {platform === "android" && (
                <>
                  <p className="text-sm font-medium text-foreground">No Chrome:</p>
                  <div className="flex items-start gap-3 text-sm text-muted-foreground">
                    <MoreVertical size={20} className="shrink-0 text-primary mt-0.5" />
                    <span>Toque no menu <strong>⋮</strong> (três pontos no canto superior)</span>
                  </div>
                  <div className="flex items-start gap-3 text-sm text-muted-foreground">
                    <Download size={20} className="shrink-0 text-primary mt-0.5" />
                    <span>Selecione <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong></span>
                  </div>
                </>
              )}
              {(platform === "desktop" || platform === "unknown") && (
                <>
                  <p className="text-sm font-medium text-foreground">No navegador:</p>
                  <div className="flex items-start gap-3 text-sm text-muted-foreground">
                    <Download size={20} className="shrink-0 text-primary mt-0.5" />
                    <span>Clique no ícone de <strong>instalar</strong> na barra de endereço do navegador</span>
                  </div>
                </>
              )}
              <Button variant="outline" className="w-full mt-2" onClick={handleDismiss}>
                Entendi
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstallPrompt;
