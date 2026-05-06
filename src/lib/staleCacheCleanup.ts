/**
 * Limpeza preventiva de caches obsoletos do navegador.
 *
 * O painel admin foi historicamente servido por um Service Worker próprio (`/sw.js`),
 * mas essa estratégia foi descontinuada — o único SW ativo agora é o do OneSignal.
 * Navegadores que instalaram uma versão antiga do PWA podem manter SWs órfãos
 * controlando a página, servindo bundles antigos e causando "white screen" /
 * "Algo deu errado" mesmo após o usuário publicar uma nova versão.
 *
 * Esta rotina roda silenciosamente no boot e:
 * 1) Desregistra qualquer Service Worker que NÃO seja do OneSignal.
 * 2) Apaga Cache Storage antigo do app (mantém caches do OneSignal).
 *
 * É segura para rodar em todo carregamento — operações são idempotentes.
 */

const ALLOWED_SW_PATHS = [
  "/OneSignalSDKWorker.js",
  "/OneSignalSDKUpdaterWorker.js",
  "/pwa-sw.js",
];

const ALLOWED_CACHE_PREFIXES = ["onesignal", "OneSignal"];

const isAllowedScript = (scriptURL: string) =>
  ALLOWED_SW_PATHS.some((path) => scriptURL.includes(path));

const isAllowedCache = (cacheName: string) =>
  ALLOWED_CACHE_PREFIXES.some((prefix) => cacheName.includes(prefix));

export async function cleanupStaleBrowserCaches() {
  if (typeof window === "undefined") return;

  // 1) Desregistrar Service Workers órfãos (não-OneSignal)
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map(async (reg) => {
          const scriptURL = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || "";
          if (!isAllowedScript(scriptURL)) {
            try {
              await reg.unregister();
              // eslint-disable-next-line no-console
              console.info("[cache-cleanup] unregistered stale SW:", scriptURL);
            } catch {
              // ignore
            }
          }
        }),
      );
    }
  } catch {
    // ignore — feature pode não estar disponível
  }

  // 2) Apagar Cache Storage antigo do app
  try {
    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(async (name) => {
          if (!isAllowedCache(name)) {
            try {
              await caches.delete(name);
              // eslint-disable-next-line no-console
              console.info("[cache-cleanup] deleted stale cache:", name);
            } catch {
              // ignore
            }
          }
        }),
      );
    }
  } catch {
    // ignore
  }
}
