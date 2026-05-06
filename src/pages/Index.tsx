import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { resolveUserDestination } from "@/lib/resolveUserDestination";
import { Loader2 } from "lucide-react";
import HeroSection from "@/components/landing/HeroSection";
import FeaturesGrid from "@/components/landing/FeaturesGrid";
import AllFeatures from "@/components/landing/AllFeatures";
import CTASection from "@/components/landing/CTASection";
import LandingFooter from "@/components/landing/LandingFooter";
import LandingHeader from "@/components/landing/LandingHeader";
import ShowcaseSection from "@/components/landing/ShowcaseSection";
import WhatsAppSection from "@/components/landing/WhatsAppSection";
import IntegrationsSection from "@/components/landing/IntegrationsSection";
import NotificationsSection from "@/components/landing/NotificationsSection";
import AchievementsSection from "@/components/landing/AchievementsSection";
import CheckoutCustomSection from "@/components/landing/CheckoutCustomSection";
import PricingSection from "@/components/landing/PricingSection";

// Note: CookieConsent now mounted globally in App.tsx — no longer needed here.

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setResolving(false);
      setResolved(false);
      return;
    }
    if (resolved) return;

    let cancelled = false;
    setResolving(true);

    resolveUserDestination()
      .then((dest) => {
        if (!cancelled) {
          setResolved(true);
          navigate(dest, { replace: true });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolved(true);
          navigate("/completar-perfil", { replace: true });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user, loading, navigate, resolved]);


  if (loading || (user && resolving && !resolved)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6" role="status" aria-label="Carregando">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-primary/20 bg-card shadow-[0_0_40px_hsl(var(--primary)/0.18)]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-semibold text-foreground">Carregando Panttera...</p>
            <p className="text-sm text-muted-foreground">Se demorar mais de alguns segundos, atualize a preview.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/20">
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[700px] bg-[radial-gradient(ellipse,_rgba(0,230,118,0.04)_0%,_transparent_70%)]" />
      </div>

      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-lg focus:font-bold">
        Pular para o conteúdo principal
      </a>

      <LandingHeader />
      <main id="main-content">
        <HeroSection />
        <ShowcaseSection />
        <WhatsAppSection />
        <FeaturesGrid />
        <CheckoutCustomSection />
        <IntegrationsSection />
        <NotificationsSection />
        <AllFeatures />
        <AchievementsSection />
        <PricingSection />
        <CTASection />
      </main>
      <LandingFooter />
      {/* CookieConsent is mounted globally in App.tsx */}
    </div>
  );
};

export default Index;
