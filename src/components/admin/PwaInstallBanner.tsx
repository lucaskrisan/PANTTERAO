import { useEffect, useState, useCallback } from "react";
import { Smartphone, Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent || "");
}

interface Props {
  userId?: string;
  collapsed?: boolean;
}

/* ── Conteúdos dos popovers (isolados) ───────────────── */

const IOSInstructions = () => (
  <>
    <p className="font-semibold text-foreground mb-2 flex items-center gap-1.5">
      <Share className="w-3.5 h-3.5 text-primary" />
      Instalar no iPhone
    </p>
    <p className="text-muted-foreground">
      Toque em <strong className="text-foreground">Compartilhar</strong>{" "}
      → <strong className="text-foreground">Adicionar à Tela de Início</strong>.
    </p>
  </>
);

const DesktopInstructions = () => (
  <>
    <p className="font-semibold text-foreground mb-2 flex items-center gap-1.5">
      <Download className="w-3.5 h-3.5 text-primary" />
      Instalar no Desktop
    </p>
    <p className="text-muted-foreground">
      No Chrome/Edge, clique no ícone{" "}
      <strong className="text-foreground">Instalar</strong> na barra de endereço,
      ou acesse <strong className="text-foreground">Menu → Instalar App</strong>.
    </p>
  </>
);

export default function PwaInstallBanner({ userId, collapsed }: Props) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  // Fluxos completamente independentes
  const [iosOpen, setIosOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    if (isStandalone()) return;
    if (typeof window !== "undefined" && localStorage.getItem("pwa-banner-dismissed") === "true") return;

    setVisible(true);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const onInstalled = () => {
      setVisible(false);
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [userId]);

  const dismissPermanently = useCallback(() => {
    try {
      localStorage.setItem("pwa-banner-dismissed", "true");
    } catch {}
    setVisible(false);
  }, []);

  const handleInstall = useCallback(async () => {
    // Fluxo iOS — tooltip de atalho (único caminho possível no Safari)
    if (isIOS()) {
      setDesktopOpen(false);
      setIosOpen(true);
      return;
    }

    // Fluxo Desktop/Android — tenta popup nativo se o evento foi capturado
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
          setVisible(false);
        }
      } catch (err) {
        console.error("[PwaInstallBanner] prompt error:", err);
      }
      setDeferredPrompt(null);
      return;
    }

    // Fluxo Desktop sem evento (preview ou navegador sem suporte):
    // mostra tooltip com instruções via barra de endereço
    setIosOpen(false);
    setDesktopOpen(true);
  }, [deferredPrompt]);

  if (!visible) return null;

  // Versão colapsada (apenas ícone)
  if (collapsed) {
    const Content = isIOS() ? IOSInstructions : DesktopInstructions;
    const open = isIOS() ? iosOpen : desktopOpen;
    const setOpen = isIOS() ? setIosOpen : setDesktopOpen;

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            onClick={handleInstall}
            aria-label="Baixar app"
            className="mx-auto mb-2 w-9 h-9 rounded-lg bg-sidebar-primary/10 hover:bg-sidebar-primary/20 flex items-center justify-center transition-colors"
          >
            <Smartphone className="w-4 h-4 text-sidebar-primary" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="right" align="end" className="w-64 text-xs leading-relaxed">
          <Content />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className="mx-2 mb-2 rounded-xl border border-sidebar-border/60 bg-sidebar-accent/30 p-3 relative">
      <button
        type="button"
        onClick={dismissPermanently}
        aria-label="Fechar"
        className="absolute top-1.5 right-1.5 w-5 h-5 rounded-md flex items-center justify-center text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
      <div className="flex items-center gap-2 mb-1 pr-5">
        <div className="w-7 h-7 rounded-lg bg-sidebar-primary/15 flex items-center justify-center shrink-0">
          <Smartphone className="w-3.5 h-3.5 text-sidebar-primary" />
        </div>
        <p className="text-[13px] font-semibold text-sidebar-accent-foreground leading-tight">
          Baixe nosso App
        </p>
      </div>

      <p className="text-[11px] text-sidebar-foreground/70 mb-2.5 leading-snug">
        Gerencie suas vendas de qualquer lugar
      </p>

      {/* Popover iOS — isolado */}
      <Popover open={iosOpen} onOpenChange={setIosOpen}>
        <PopoverTrigger asChild>
          {/* trigger invisível — controlado via state */}
          <span className="hidden" aria-hidden />
        </PopoverTrigger>
        <PopoverContent side="right" align="end" className="w-64 text-xs leading-relaxed">
          <IOSInstructions />
        </PopoverContent>
      </Popover>

      {/* Popover Desktop — isolado */}
      <Popover open={desktopOpen} onOpenChange={setDesktopOpen}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="secondary"
            className="w-full h-8 gap-1.5 text-xs tabular-nums"
            onClick={handleInstall}
          >
            <Download className="w-3.5 h-3.5" />
            Instalar
          </Button>
        </PopoverTrigger>
        <PopoverContent side="right" align="end" className="w-64 text-xs leading-relaxed">
          <DesktopInstructions />
        </PopoverContent>
      </Popover>
    </div>
  );
}
