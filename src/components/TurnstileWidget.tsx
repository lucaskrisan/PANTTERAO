import { forwardRef, useEffect, useRef, useCallback } from "react";

const SITE_KEY = "0x4AAAAAACsSrQ-0RiyeU2_T";

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
}

const TurnstileWidget = forwardRef<HTMLDivElement, TurnstileWidgetProps>(({ onVerify, onExpire }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;

    if (!ref) return;

    if (typeof ref === "function") {
      ref(node);
      return;
    }

    ref.current = node;
  }, [ref]);

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !(window as any).turnstile) return;
    
    if (widgetIdRef.current) {
      try { (window as any).turnstile.remove(widgetIdRef.current); } catch {}
    }

    widgetIdRef.current = (window as any).turnstile.render(containerRef.current, {
      sitekey: SITE_KEY,
      theme: "dark",
      size: "invisible",
      callback: onVerify,
      "expired-callback": onExpire,
      "error-callback": () => {
        // On error, retry widget render after a short delay
        console.warn("[Turnstile] Widget error — retrying in 3s");
        setTimeout(() => renderWidget(), 3000);
      },
    });
  }, [onVerify, onExpire]);

  useEffect(() => {
    if ((window as any).turnstile) {
      renderWidget();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => renderWidget();
    document.head.appendChild(script);

    return () => {
      if (widgetIdRef.current) {
        try { (window as any).turnstile.remove(widgetIdRef.current); } catch {}
      }
    };
  }, [renderWidget]);

  return <div ref={setContainerRef} />;
});

TurnstileWidget.displayName = "TurnstileWidget";

export default TurnstileWidget;
