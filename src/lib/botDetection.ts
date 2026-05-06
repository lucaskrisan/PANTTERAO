/**
 * Bot Detection — heurísticas client-side para evitar contar PageView/CAPI
 * de crawlers, scrapers e headless browsers.
 *
 * Camadas (todas combinadas via `detectBot()`):
 *  1. Hard signals — webdriver, UA conhecido, navegador headless
 *  2. Soft signals — falta de plugins, languages vazias, screen 0x0
 *  3. Behavior — sem interação humana em N segundos (mouse/scroll/touch)
 *
 * IMPORTANTE: nada bloqueia o usuário de USAR o site. Só pulamos tracking.
 *
 * Feature flag: window.__BOT_FILTER_ENABLED__ (default: true).
 * Para desligar 100% sem deploy, rode no console:
 *   window.__BOT_FILTER_ENABLED__ = false
 */

const BOT_UA_PATTERNS = [
  /bot/i,
  /crawl/i,
  /spider/i,
  /slurp/i,
  /facebookexternalhit/i,
  /facebookcatalog/i,
  /headlesschrome/i,
  /phantomjs/i,
  /selenium/i,
  /puppeteer/i,
  /playwright/i,
  /lighthouse/i,
  /pagespeed/i,
  /gtmetrix/i,
  /pingdom/i,
  /uptimerobot/i,
  /ahrefs/i,
  /semrush/i,
  /mj12bot/i,
  /dotbot/i,
  /petalbot/i,
  /yandexbot/i,
  /bingbot/i,
  /googlebot/i,
  /duckduckbot/i,
  /baiduspider/i,
  /applebot/i,
  /linkedinbot/i,
  /twitterbot/i,
  // /whatsapp/i, <-- Removido: tráfego real de vendas vem muito daqui
  /telegrambot/i,
  /discordbot/i,
  /preview/i,
  /scraper/i,
  /curl/i,
  /wget/i,
  /python-requests/i,
  /node-fetch/i,
  /axios/i,
];

let humanInteractionDetected = false;
let interactionListenerAttached = false;

function attachInteractionListener() {
  if (interactionListenerAttached || typeof window === "undefined") return;
  interactionListenerAttached = true;

  const markHuman = () => {
    humanInteractionDetected = true;
    window.removeEventListener("mousemove", markHuman);
    window.removeEventListener("scroll", markHuman);
    window.removeEventListener("touchstart", markHuman);
    window.removeEventListener("keydown", markHuman);
    window.removeEventListener("click", markHuman);
  };

  window.addEventListener("mousemove", markHuman, { passive: true, once: true });
  window.addEventListener("scroll", markHuman, { passive: true, once: true });
  window.addEventListener("touchstart", markHuman, { passive: true, once: true });
  window.addEventListener("keydown", markHuman, { passive: true, once: true });
  window.addEventListener("click", markHuman, { passive: true, once: true });
}

if (typeof window !== "undefined") {
  attachInteractionListener();
}

/** Hard signals — se algum bater, é bot quase com certeza. */
function hasHardBotSignals(): { isBot: boolean; reason?: string } {
  if (typeof navigator === "undefined") return { isBot: false };

  // 1. webdriver flag (Selenium/Puppeteer/Playwright)
  if ((navigator as any).webdriver === true) {
    return { isBot: true, reason: "webdriver" };
  }

  // 2. User-Agent declarado como bot
  const ua = navigator.userAgent || "";
  for (const pattern of BOT_UA_PATTERNS) {
    if (pattern.test(ua)) {
      return { isBot: true, reason: `ua:${pattern.source}` };
    }
  }

  // 3. Headless Chrome assina como tal
  if (/HeadlessChrome/i.test(ua)) {
    return { isBot: true, reason: "headless_chrome" };
  }

  // 4. Sem languages (Puppeteer default)
  if (Array.isArray(navigator.languages) && navigator.languages.length === 0) {
    return { isBot: true, reason: "no_languages" };
  }

  // 5. Screen dimensions impossíveis
  if (typeof screen !== "undefined" && (screen.width === 0 || screen.height === 0)) {
    return { isBot: true, reason: "zero_screen" };
  }

  return { isBot: false };
}

/**
 * Verifica se o filtro está ligado. Permite kill-switch sem deploy:
 *   window.__BOT_FILTER_ENABLED__ = false
 */
export function isBotFilterEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const flag = (window as any).__BOT_FILTER_ENABLED__;
  return flag !== false; // default ON
}

/**
 * Detecção principal. Retorna `true` se for considerado bot.
 *
 * @param requireHumanInteraction Se true, exige interação humana detectada.
 *        Use `false` em eventos que disparam após interação (Purchase, AddPaymentInfo).
 */
export function detectBot(requireHumanInteraction = true): {
  isBot: boolean;
  reason?: string;
} {
  if (!isBotFilterEnabled()) return { isBot: false };

  const hard = hasHardBotSignals();
  if (hard.isBot) return hard;

  if (requireHumanInteraction && !humanInteractionDetected) {
    // Janela de tolerância: se a página acabou de carregar, ainda é cedo
    // pra concluir. Damos 10s de carência para conexões lentas (especialmente mobile/3G).
    const pageAge = typeof performance !== "undefined" ? performance.now() : 0;
    if (pageAge > 10000) {
      return { isBot: true, reason: "no_human_interaction_10s" };
    }
  }

  return { isBot: false };
}

/** Helper booleano simples. */
export function isLikelyBot(requireHumanInteraction = true): boolean {
  return detectBot(requireHumanInteraction).isBot;
}

/** Estado de interação humana — útil para casos avançados. */
export function hasHumanInteracted(): boolean {
  return humanInteractionDetected;
}
