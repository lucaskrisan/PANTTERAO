// Service Worker mínimo para PWA-installability.
// O Chrome exige um SW com handler de `fetch` registrado para disparar
// `beforeinstallprompt` (popup nativo "Instalar App"). Este SW NÃO faz
// cache de recursos — apenas responde passthrough para a rede — evitando
// bugs de "bundle antigo" / tela branca que motivaram a descontinuação
// do SW anterior. Se precisar de offline real, adicionar cache aqui.

const SW_VERSION = "panttera-pwa-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Handler fetch obrigatório para installability — passthrough puro.
self.addEventListener("fetch", (event) => {
  // Não interceptamos nada — deixa o browser resolver normalmente.
  // A presença deste listener já satisfaz o critério do Chrome.
  return;
});
