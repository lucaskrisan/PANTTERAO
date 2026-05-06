// @ts-nocheck
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

function safeId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `v_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function useCheckoutPresence(
  mode: "track" | "watch",
  productId?: string,
  ownerProductIds?: string[],
) {
  const [onlineCount, setOnlineCount] = useState(0);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cleanupIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const visitorIdRef = useRef(safeId());
  const presenceCountRef = useRef(0);
  const heartbeatMapRef = useRef<Map<string, { ts: number; product_id: string }>>(new Map());
  const ownerIdsRef = useRef<Set<string> | null>(null);
  const modeRef = useRef(mode);
  const productIdRef = useRef(productId);

  // Keep refs in sync without triggering reconnects
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    productIdRef.current = productId;
  }, [productId]);

  useEffect(() => {
    ownerIdsRef.current = ownerProductIds && ownerProductIds.length > 0
      ? new Set(ownerProductIds)
      : null;
  }, [ownerProductIds]);

  useEffect(() => {
    mountedRef.current = true;
    let destroyed = false;

    const countPresenceForOwner = (state: Record<string, any[]>) => {
      const allowed = ownerIdsRef.current;
      // SECURITY: In watch mode, if no product IDs are provided, return 0
      // to prevent cross-tenant data leakage while products are loading.
      if (!allowed && modeRef.current === "watch") return 0;
      let count = 0;
      for (const [key, presences] of Object.entries(state)) {
        if (key.startsWith("_watcher")) continue;
        if (!allowed) { count++; continue; }
        const pid = presences?.[0]?.product_id;
        if (pid && allowed.has(pid)) count++;
      }
      return count;
    };

    const updateCount = () => {
      if (destroyed) return;
      const now = Date.now();
      const ttlMs = 25000;
      const allowed = ownerIdsRef.current;

      // SECURITY: In watch mode with no product IDs, show 0
      if (!allowed && modeRef.current === "watch") {
        setOnlineCount(0);
        return;
      }

      for (const [id, entry] of heartbeatMapRef.current.entries()) {
        if (now - entry.ts > ttlMs) heartbeatMapRef.current.delete(id);
      }

      let heartbeatCount = 0;
      for (const entry of heartbeatMapRef.current.values()) {
        if (!allowed || allowed.has(entry.product_id)) heartbeatCount++;
      }

      setOnlineCount(Math.max(presenceCountRef.current, heartbeatCount));
    };

    const cleanup = () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
        cleanupIntervalRef.current = null;
      }
      if (channelRef.current) {
        try { supabase.removeChannel(channelRef.current); } catch {}
        channelRef.current = null;
      }
    };

    const connect = () => {
      if (destroyed) return;
      cleanup();

      const currentMode = modeRef.current;
      const currentProductId = productIdRef.current;
      const presenceKey = currentMode === "track"
        ? visitorIdRef.current
        : `_watcher_${visitorIdRef.current}`;

      // Use a unique suffix to guarantee a fresh channel instance
      const channelName = `checkout-presence-global`;
      const channel = supabase.channel(channelName, {
        config: {
          presence: { key: presenceKey },
          broadcast: { self: false, ack: false },
        },
      });

      channelRef.current = channel;

      const syncPresence = () => {
        try {
          const state = channel.presenceState();
          presenceCountRef.current = countPresenceForOwner(state);
          updateCount();
        } catch {}
      };

      // Register ALL callbacks BEFORE subscribing
      channel
        .on("presence", { event: "sync" }, syncPresence)
        .on("presence", { event: "join" }, syncPresence)
        .on("presence", { event: "leave" }, syncPresence)
        .on("broadcast", { event: "checkout_ping" }, ({ payload }) => {
          const p = payload as { id?: string; product_id?: string };
          if (!p?.id || p.id.startsWith("_watcher")) return;
          heartbeatMapRef.current.set(p.id, {
            ts: Date.now(),
            product_id: p.product_id || "unknown",
          });
          updateCount();
        })
        .subscribe(async (status) => {
          if (destroyed) return;

          if (status === "SUBSCRIBED") {
            if (retryRef.current) {
              clearTimeout(retryRef.current);
              retryRef.current = null;
            }

            if (currentMode === "track") {
              try {
                await channel.track({
                  product_id: currentProductId || "unknown",
                  joined_at: new Date().toISOString(),
                });
              } catch {}

              const sendPing = async () => {
                try {
                  await channel.send({
                    type: "broadcast",
                    event: "checkout_ping",
                    payload: {
                      id: visitorIdRef.current,
                      product_id: currentProductId || "unknown",
                      ts: Date.now(),
                    },
                  });
                } catch {}
              };

              await sendPing();
              heartbeatIntervalRef.current = setInterval(sendPing, 10000);
            } else {
              cleanupIntervalRef.current = setInterval(updateCount, 5000);
            }
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            if (!destroyed && !retryRef.current) {
              retryRef.current = setTimeout(() => {
                retryRef.current = null;
                connect();
              }, 2500);
            }
          }
        });
    };

    connect();

    return () => {
      destroyed = true;
      mountedRef.current = false;
      if (retryRef.current) {
        clearTimeout(retryRef.current);
        retryRef.current = null;
      }
      cleanup();
    };
  }, []); // stable — reads current values from refs

  return onlineCount;
}
