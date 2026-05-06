import { useEffect } from "react";

export function useOneSignalInit(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;

    const win = window as any;

    const syncOneSignalIdentity = () => {
      win.OneSignalDeferred = win.OneSignalDeferred || [];
      win.OneSignalDeferred.push(async (OneSignal: any) => {
        try {
          if (!win.__oneSignalInitialized) {
            await OneSignal.init({
              appId: "5ba5218a-5026-4270-92ce-d2e0ab5509e0",
              serviceWorkerParam: { scope: "/" },
              serviceWorkerPath: "/OneSignalSDKWorker.js",
              serviceWorkerUpdaterPath: "/OneSignalSDKUpdaterWorker.js",
              notifyButton: { enable: false },
              allowLocalhostAsSecureOrigin: true,
              promptOptions: {
                slidedown: {
                  prompts: [{
                    type: "push",
                    autoPrompt: true,
                    text: {
                      actionMessage: "Deseja receber notificações de vendas em tempo real?",
                      acceptButton: "Permitir",
                      cancelButton: "Agora não",
                    },
                    delay: { pageViews: 1, timeDelay: 2 },
                  }],
                },
              },
            });
            win.__oneSignalInitialized = true;
          }

          // Sempre adiciona a tag user_id (método legado que sempre funcionou)
          if (typeof OneSignal.User?.addTags === "function") {
            await OneSignal.User.addTags({ user_id: userId });
          } else if (typeof OneSignal.User?.addTag === "function") {
            await OneSignal.User.addTag("user_id", userId);
          }

          // Adiciona alias como complemento (não substitui tag)
          if (typeof OneSignal.login === "function") {
            try {
              await OneSignal.login(userId);
            } catch (e) {
              console.warn("[OneSignal] login failed (non-fatal):", e);
            }
          }

          console.log("[OneSignal] synced:", {
            userId,
            permission: OneSignal.Notifications?.permissionNative ?? Notification.permission,
            subscriptionId: OneSignal.User?.PushSubscription?.id ?? null,
            optedIn: OneSignal.User?.PushSubscription?.optedIn ?? null,
          });
        } catch (err) {
          console.error("[OneSignal] init error:", err);
        }
      });
    };

    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"]');
    if (existingScript) {
      syncOneSignalIdentity();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
    script.defer = true;
    script.onload = syncOneSignalIdentity;
    document.head.appendChild(script);
  }, [userId]);
}
