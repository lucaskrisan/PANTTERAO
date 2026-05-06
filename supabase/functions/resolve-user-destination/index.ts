import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("profile_completed")
        .eq("id", user.id)
        .maybeSingle(),
      supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id),
    ]);

    const profileCompleted = profile?.profile_completed === true;
    const isAdmin = (roles || []).some((r: any) => r.role === "admin" || r.role === "super_admin" || r.role === "collaborator");

    let hasBuyerAccess = false;
    if (user.email) {
      const { data: customers } = await supabaseAdmin
        .from("customers")
        .select("id")
        .ilike("email", user.email);

      const customerIds = (customers || []).map((customer: any) => customer.id).filter(Boolean);

      if (customerIds.length > 0) {
        const { data: accesses } = await supabaseAdmin
          .from("member_access")
          .select("expires_at")
          .in("customer_id", customerIds)
          .limit(100);

        hasBuyerAccess = (accesses || []).some(
          (access: any) => !access.expires_at || new Date(access.expires_at) > new Date()
        );
      }
    }

    // Priority: incomplete profile → admin panel (producer) → buyer portal → admin fallback
    const isSuperAdmin = (roles || []).some((r: any) => r.role === "admin" || r.role === "super_admin");
    const isCollaborator = (roles || []).some((r: any) => r.role === "collaborator");

    const destination = !profileCompleted
      ? "/completar-perfil"
      : isSuperAdmin
        ? "/admin"
        : isCollaborator
          ? "/admin/marketplace"
          : hasBuyerAccess
            ? "/minha-conta"
            : "/admin";

    return new Response(
      JSON.stringify({
        destination,
        profileCompleted,
        isAdmin,
        hasBuyerAccess,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
