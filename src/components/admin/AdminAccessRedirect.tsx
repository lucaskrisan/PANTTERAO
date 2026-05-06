import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface Props {
  refreshRoles: () => Promise<void>;
  userId: string;
}

export default function AdminAccessRedirect({ refreshRoles, userId }: Props) {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await refreshRoles();
        if (cancelled) return;

        const [{ data: roles }, { data: profile }] = await Promise.all([
          supabase.from("user_roles").select("role").eq("user_id", userId),
          supabase.from("profiles").select("profile_completed").eq("id", userId).maybeSingle(),
        ]);

        if (cancelled) return;

        const roleNames = (roles ?? []).map((r: any) => r.role);
        const isSuperAdmin = roleNames.includes("admin") || roleNames.includes("super_admin");
        const isCollaborator = roleNames.includes("collaborator");

        setChecked(true);

        if (isSuperAdmin) {
          navigate("/admin", { replace: true });
          return;
        }

        if (isCollaborator) {
          navigate("/admin/marketplace", { replace: true });
          return;
        }

        navigate(profile?.profile_completed ? "/minha-conta" : "/completar-perfil", { replace: true });
      } catch {
        if (cancelled) return;
        setChecked(true);
        navigate("/login", { replace: true });
      }
    };

    run();
    return () => { cancelled = true; };
  }, [refreshRoles, navigate, userId]);

  if (checked) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}
