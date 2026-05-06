// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function resolveUserDestination() {
  const {
    data: { session: initialSession },
  } = await supabase.auth.getSession();

  let session = initialSession;

  // After OAuth redirects there can be a brief race before token/session is hydrated.
  if (!session?.access_token) {
    await wait(250);
    const {
      data: { session: retriedSession },
    } = await supabase.auth.getSession();
    session = retriedSession;
  }

  if (!session?.user?.id || !session.access_token) {
    return "/login";
  }

  const invokeDestination = async () =>
    supabase.functions.invoke("resolve-user-destination", {
      body: {},
      headers: {
        Authorization: `Bearer ${session!.access_token}`,
      },
    });

  let { data, error } = await invokeDestination();

  // One retry for transient auth race on first call
  if (error) {
    await wait(250);
    ({ data, error } = await invokeDestination());
  }

  if (!error && typeof data?.destination === "string" && data.destination.length > 0) {
    return data.destination as string;
  }

  // Safe fallback (prevents returning users from being trapped in onboarding)
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase
      .from("profiles")
      .select("profile_completed")
      .eq("id", session.user.id)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", session.user.id),
  ]);

  const profileCompleted = profile?.profile_completed === true;
  const roleNames = (roles ?? []).map((r) => r.role);
  const isSuperAdmin = roleNames.includes("admin") || roleNames.includes("super_admin");
  const isCollaborator = roleNames.includes("collaborator");

  if (!profileCompleted) return "/completar-perfil";
  if (isSuperAdmin) return "/admin";
  if (isCollaborator) return "/admin/marketplace";
  return "/minha-conta";
}

