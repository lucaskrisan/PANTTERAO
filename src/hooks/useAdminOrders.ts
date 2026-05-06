import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { playNotificationSound } from "@/lib/notificationSounds";

const PAID_STATUSES = new Set(["paid", "approved"]);

export function useAdminOrders(userId: string | undefined, isSuperAdmin: boolean = false) {
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [paidCount, setPaidCount] = useState(0);
  const notificationSoundRef = useRef("kaching");
  const playApprovedSaleSoundRef = useRef(true);

  const fetchRevenue = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase.rpc("get_revenue_summary", { p_user_id: userId });
    if (!error && data && data.length > 0) {
      setTotalRevenue(Number(data[0].total_revenue));
      setPaidCount(Number(data[0].paid_count) || 0);
    }
  }, [userId]);

  // Load initial revenue + notification settings
  useEffect(() => {
    if (!userId) return;

    const load = async () => {
      const [, settingsRes] = await Promise.all([
        fetchRevenue(),
        supabase
          .from("notification_settings")
          .select("notification_sound, send_approved")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

      notificationSoundRef.current = settingsRes.data?.notification_sound || "kaching";
      playApprovedSaleSoundRef.current = settingsRes.data?.send_approved ?? true;
    };

    load();
  }, [userId, fetchRevenue]);

  // Realtime order updates — refresh count for everyone, sound only for non-super-admin
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`admin-orders-sound-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload: any) => {
          const newStatus = String(payload?.new?.status || "").toLowerCase();
          const oldStatus = String(payload?.old?.status || "").toLowerCase();

          const becamePaid =
            (payload?.eventType === "INSERT" && PAID_STATUSES.has(newStatus)) ||
            (payload?.eventType === "UPDATE" && PAID_STATUSES.has(newStatus) && !PAID_STATUSES.has(oldStatus));

          // Sound is muted for super admins (they see ALL orders globally)
          if (becamePaid && playApprovedSaleSoundRef.current && !isSuperAdmin) {
            playNotificationSound(notificationSoundRef.current);
          }

          // Always refresh aggregated count so gamification stays live
          if (payload?.eventType === "INSERT" || payload?.eventType === "UPDATE") {
            fetchRevenue();
          }
        }
      )
      .subscribe();

    // Lightweight polling as fallback (every 60s) so the bar never goes stale
    const pollId = setInterval(fetchRevenue, 60_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollId);
    };
  }, [userId, isSuperAdmin, fetchRevenue]);

  return { totalRevenue, paidCount };
}
