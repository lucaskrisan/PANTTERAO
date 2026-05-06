import { useState, useEffect, useCallback } from "react";
import { Download, X, Smartphone, Share, MoreVertical } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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

/**
 * Subtle PWA install banner for the member area.
 * Non-intrusive: a small floating pill at the bottom.
 */
const MemberInstallBanner = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [platform] = useState<Platform>(detectPlatform);

  useEffect(() => {
    if (isStandalone()) return;
    const dismissed = localStorage.getItem("member-install-dismissed");
    if (dismissed) return;

    let captured = false;

    const handler = (e: Event) => {
      e.preventDefault();
      captured = true;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show after a delay so it doesn't distract from content loading
      setTimeout(() => setVisible(true), 5000);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // For iOS — show instructions after delay
    const timer = setTimeout(() => {
      if (!captured) {
        setShowInstructions(true);
        setVisible(true);
      }
    }, 8000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(timer);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
          setVisible(false);
          localStorage.setItem("member-install-dismissed", "1");
        }
      } catch (err) {
        console.error("[MemberInstall] Error:", err);
      }
      setDeferredPrompt(null);
    } else {
      setShowInstructions(true);
    }
  }, [deferredPrompt]);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem("member-install-dismissed", "1");
  };

  if (!visible || isStandalone()) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 60 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-sm"
        >
          {!showInstructions ? (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-2xl backdrop-blur-xl"
              style={{
                background: "hsla(220, 18%, 10%, 0.95)",
                borderColor: "hsl(145, 65%, 30%)",
                boxShadow: "0 8px 32px hsla(145, 65%, 20%, 0.2)",
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "linear-gradient(135deg, hsl(145,65%,42%), hsl(160,70%,36%))" }}
              >
                <Smartphone className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold leading-tight">Instalar App</p>
                <p className="text-[hsl(220,10%,50%)] text-xs">Acesse seus cursos com um toque</p>
              </div>
              <button
                onClick={handleInstall}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-white flex-shrink-0 transition-transform hover:scale-105 active:scale-95"
                style={{ background: "hsl(145,65%,42%)" }}
              >
                <Download className="w-3.5 h-3.5 inline mr-1" />
                Instalar
              </button>
              <button
                onClick={dismiss}
                className="p-1 rounded-full hover:bg-white/10 transition flex-shrink-0"
              >
                <X className="w-4 h-4 text-[hsl(220,10%,40%)]" />
              </button>
            </div>
          ) : (
            <div
              className="px-5 py-4 rounded-2xl border shadow-2xl"
              style={{
                background: "hsl(220, 18%, 10%)",
                borderColor: "hsl(145, 65%, 30%)",
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-white text-sm font-semibold">Instalar App</p>
                <button onClick={dismiss} className="p-1 rounded-full hover:bg-white/10">
                  <X className="w-4 h-4 text-[hsl(220,10%,40%)]" />
                </button>
              </div>
              {platform === "ios" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-[hsl(220,10%,55%)]">
                    <Share className="w-4 h-4 text-[hsl(145,65%,50%)]" />
                    <span>Toque em <strong className="text-white">Compartilhar</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[hsl(220,10%,55%)]">
                    <Download className="w-4 h-4 text-[hsl(145,65%,50%)]" />
                    <span><strong className="text-white">Adicionar à Tela de Início</strong></span>
                  </div>
                </div>
              )}
              {platform === "android" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-[hsl(220,10%,55%)]">
                    <MoreVertical className="w-4 h-4 text-[hsl(145,65%,50%)]" />
                    <span>Menu <strong className="text-white">⋮</strong> → <strong className="text-white">Instalar app</strong></span>
                  </div>
                </div>
              )}
              {(platform === "desktop" || platform === "unknown") && (
                <div className="flex items-center gap-2 text-xs text-[hsl(220,10%,55%)]">
                  <Download className="w-4 h-4 text-[hsl(145,65%,50%)]" />
                  <span>Clique no ícone de <strong className="text-white">instalar</strong> na barra de endereço</span>
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MemberInstallBanner;
