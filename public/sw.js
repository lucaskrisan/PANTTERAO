// Stub vazio. O único Service Worker ativo é o do OneSignal (OneSignalSDKWorker.js).
// Mantido apenas para evitar 404 caso alguma versão antiga do PWA tente buscar /sw.js.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
