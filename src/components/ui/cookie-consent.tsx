import * as React from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Shield } from "lucide-react";

const STORAGE_KEY = "cookie_consent_given";
const CONSENT_PREFS_KEY = "cookie_consent_prefs";

type ConsentPrefs = {
  analytics: boolean;
  marketing: boolean;
};

const DEFAULT_PREFS: ConsentPrefs = { analytics: true, marketing: true };

type Lang = "pt" | "en" | "es" | "fr" | "de" | "it";

interface CookieTexts {
  message: (cookies: React.ReactNode, privacy: React.ReactNode) => React.ReactNode;
  cookiesPolicy: string;
  privacyPolicy: string;
  preferences: string;
  rejectOptional: string;
  acceptAll: string;
  essential: string;
  essentialDesc: string;
  analytics: string;
  analyticsDesc: string;
  marketing: string;
  marketingDesc: string;
  savePreferences: string;
}

const TEXTS: Record<Lang, CookieTexts> = {
  pt: {
    message: (c, p) => <>Utilizamos cookies para melhorar sua experiência. Ao continuar navegando, você concorda com nossa {c} e {p}.</>,
    cookiesPolicy: "Política de Cookies",
    privacyPolicy: "Política de Privacidade",
    preferences: "Preferências",
    rejectOptional: "Rejeitar opcionais",
    acceptAll: "Aceitar todos",
    essential: "Essenciais",
    essentialDesc: "Necessários para o funcionamento",
    analytics: "Análise",
    analyticsDesc: "Estatísticas de navegação",
    marketing: "Marketing",
    marketingDesc: "Anúncios personalizados",
    savePreferences: "Salvar preferências",
  },
  es: {
    message: (c, p) => <>Utilizamos cookies para mejorar tu experiencia. Al continuar navegando, aceptas nuestra {c} y {p}.</>,
    cookiesPolicy: "Política de Cookies",
    privacyPolicy: "Política de Privacidad",
    preferences: "Preferencias",
    rejectOptional: "Rechazar opcionales",
    acceptAll: "Aceptar todas",
    essential: "Esenciales",
    essentialDesc: "Necesarias para el funcionamiento",
    analytics: "Análisis",
    analyticsDesc: "Estadísticas de navegación",
    marketing: "Marketing",
    marketingDesc: "Anuncios personalizados",
    savePreferences: "Guardar preferencias",
  },
  en: {
    message: (c, p) => <>We use cookies to improve your experience. By continuing to browse, you agree to our {c} and {p}.</>,
    cookiesPolicy: "Cookie Policy",
    privacyPolicy: "Privacy Policy",
    preferences: "Preferences",
    rejectOptional: "Reject optional",
    acceptAll: "Accept all",
    essential: "Essential",
    essentialDesc: "Required for operation",
    analytics: "Analytics",
    analyticsDesc: "Browsing statistics",
    marketing: "Marketing",
    marketingDesc: "Personalized ads",
    savePreferences: "Save preferences",
  },
  fr: {
    message: (c, p) => <>Nous utilisons des cookies pour améliorer votre expérience. En continuant à naviguer, vous acceptez notre {c} et notre {p}.</>,
    cookiesPolicy: "Politique de cookies",
    privacyPolicy: "Politique de confidentialité",
    preferences: "Préférences",
    rejectOptional: "Refuser les optionnels",
    acceptAll: "Tout accepter",
    essential: "Essentiels",
    essentialDesc: "Nécessaires au fonctionnement",
    analytics: "Analyse",
    analyticsDesc: "Statistiques de navigation",
    marketing: "Marketing",
    marketingDesc: "Publicités personnalisées",
    savePreferences: "Enregistrer les préférences",
  },
  de: {
    message: (c, p) => <>Wir verwenden Cookies, um Ihre Erfahrung zu verbessern. Wenn Sie weiter browsen, stimmen Sie unserer {c} und {p} zu.</>,
    cookiesPolicy: "Cookie-Richtlinie",
    privacyPolicy: "Datenschutzrichtlinie",
    preferences: "Einstellungen",
    rejectOptional: "Optionale ablehnen",
    acceptAll: "Alle akzeptieren",
    essential: "Erforderlich",
    essentialDesc: "Für den Betrieb notwendig",
    analytics: "Analyse",
    analyticsDesc: "Browsing-Statistiken",
    marketing: "Marketing",
    marketingDesc: "Personalisierte Werbung",
    savePreferences: "Einstellungen speichern",
  },
  it: {
    message: (c, p) => <>Utilizziamo cookie per migliorare la tua esperienza. Continuando a navigare, accetti la nostra {c} e la nostra {p}.</>,
    cookiesPolicy: "Politica sui cookie",
    privacyPolicy: "Politica sulla privacy",
    preferences: "Preferenze",
    rejectOptional: "Rifiuta opzionali",
    acceptAll: "Accetta tutti",
    essential: "Essenziali",
    essentialDesc: "Necessari per il funzionamento",
    analytics: "Analisi",
    analyticsDesc: "Statistiche di navigazione",
    marketing: "Marketing",
    marketingDesc: "Annunci personalizzati",
    savePreferences: "Salva preferenze",
  },
};

/** Push a Consent Mode v2 update to the dataLayer */
function pushConsentUpdate(prefs: ConsentPrefs) {
  if (typeof window === "undefined") return;
  const w = window as any;
  w.dataLayer = w.dataLayer || [];
  function gtag(...args: any[]) { w.dataLayer.push(args); }
  gtag("consent", "update", {
    ad_storage: prefs.marketing ? "granted" : "denied",
    ad_user_data: prefs.marketing ? "granted" : "denied",
    ad_personalization: prefs.marketing ? "granted" : "denied",
    analytics_storage: prefs.analytics ? "granted" : "denied",
  });
}

/** Restore consent on page load if user already accepted */
function restoreConsent() {
  try {
    const raw = localStorage.getItem(CONSENT_PREFS_KEY);
    if (raw) {
      const prefs: ConsentPrefs = JSON.parse(raw);
      pushConsentUpdate(prefs);
    }
  } catch {
    // noop
  }
}

interface CookieConsentProps {
  className?: string;
  onAccept?: () => void;
  /** Override language. Defaults to "pt". */
  lang?: Lang;
}

function CookieConsent({ className, onAccept, lang = "pt" }: CookieConsentProps) {
  const [show, setShow] = React.useState(false);
  const [showPrefs, setShowPrefs] = React.useState(false);
  const [prefs, setPrefs] = React.useState<ConsentPrefs>(DEFAULT_PREFS);
  const t = TEXTS[lang] || TEXTS.pt;

  React.useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "true") {
        restoreConsent();
      } else {
        setShow(true);
      }
    } catch {
      setShow(true);
    }
  }, []);

  const accept = React.useCallback(
    (selectedPrefs: ConsentPrefs) => {
      try {
        localStorage.setItem(STORAGE_KEY, "true");
        localStorage.setItem(CONSENT_PREFS_KEY, JSON.stringify(selectedPrefs));
      } catch {
        // silently fail
      }
      pushConsentUpdate(selectedPrefs);
      setShow(false);
      onAccept?.();
    },
    [onAccept]
  );

  const handleAcceptAll = React.useCallback(() => {
    accept({ analytics: true, marketing: true });
  }, [accept]);

  const handleAcceptSelected = React.useCallback(() => {
    accept(prefs);
  }, [accept, prefs]);

  const handleRejectOptional = React.useCallback(() => {
    accept({ analytics: false, marketing: false });
  }, [accept]);

  const cookiesLink = (
    <Link to="/cookies" className="font-medium text-primary underline-offset-2 hover:underline">
      {t.cookiesPolicy}
    </Link>
  );
  const privacyLink = (
    <Link to="/privacidade" className="font-medium text-primary underline-offset-2 hover:underline">
      {t.privacyPolicy}
    </Link>
  );

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={cn(
            "fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md",
            className
          )}
        >
          <div className="mx-auto max-w-5xl px-4 py-4">
            {/* Main row */}
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between sm:gap-4">
              <div className="flex items-start gap-3 text-center sm:text-left">
                <Shield className="mt-0.5 hidden h-5 w-5 shrink-0 text-primary sm:block" />
                <p className="text-sm text-muted-foreground">
                  {t.message(cookiesLink, privacyLink)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => setShowPrefs((v) => !v)}
                  className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
                >
                  {t.preferences}
                </button>
                <button
                  onClick={handleRejectOptional}
                  className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
                >
                  {t.rejectOptional}
                </button>
                <button
                  onClick={handleAcceptAll}
                  className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  {t.acceptAll}
                </button>
              </div>
            </div>

            {/* Preferences panel */}
            <AnimatePresence>
              {showPrefs && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 grid gap-3 rounded-lg border border-border bg-background/60 p-4 sm:grid-cols-3">
                    {/* Essential — always on */}
                    <label className="flex items-center gap-3 text-sm">
                      <input type="checkbox" checked disabled className="accent-primary h-4 w-4 rounded" />
                      <div>
                        <span className="font-medium text-foreground">{t.essential}</span>
                        <p className="text-xs text-muted-foreground">{t.essentialDesc}</p>
                      </div>
                    </label>

                    {/* Analytics */}
                    <label className="flex cursor-pointer items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={prefs.analytics}
                        onChange={(e) => setPrefs((p) => ({ ...p, analytics: e.target.checked }))}
                        className="accent-primary h-4 w-4 rounded"
                      />
                      <div>
                        <span className="font-medium text-foreground">{t.analytics}</span>
                        <p className="text-xs text-muted-foreground">{t.analyticsDesc}</p>
                      </div>
                    </label>

                    {/* Marketing */}
                    <label className="flex cursor-pointer items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={prefs.marketing}
                        onChange={(e) => setPrefs((p) => ({ ...p, marketing: e.target.checked }))}
                        className="accent-primary h-4 w-4 rounded"
                      />
                      <div>
                        <span className="font-medium text-foreground">{t.marketing}</span>
                        <p className="text-xs text-muted-foreground">{t.marketingDesc}</p>
                      </div>
                    </label>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={handleAcceptSelected}
                      className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      {t.savePreferences}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export { CookieConsent };
export type { CookieConsentProps, Lang as CookieConsentLang };
