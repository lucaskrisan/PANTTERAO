import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useCollaboratorPermissions(userId: string | undefined, enabled: boolean) {
  const [permissions, setPermissions] = useState<Record<string, boolean> | null>(null);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled || !userId) {
      setPermissions(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("collaborator_permissions")
      .select("permissions, is_active")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.is_active) {
          setPermissions((data.permissions as Record<string, boolean>) || {});
        } else {
          setPermissions({});
        }
        setLoading(false);
      });
  }, [userId, enabled]);

  const can = (key: string) => permissions?.[key] === true;
  return { permissions, can, loading };
}
