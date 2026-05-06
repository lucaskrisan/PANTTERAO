import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: isSA, error: rpcError } = await admin.rpc("is_super_admin", { _user_id: caller.id });
    
    if (rpcError) {
      console.error("RPC is_super_admin error:", rpcError);
    }

    // Se o RPC falhar ou retornar falso, fazemos uma checagem direta na tabela user_roles
    let finalIsSA = isSA;
    if (!finalIsSA) {
      const { data: roleData } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", caller.id)
        .eq("role", "super_admin")
        .maybeSingle();
      if (roleData) finalIsSA = true;
    }

    if (!finalIsSA) {
      return new Response(JSON.stringify({ error: "Forbidden - Not Super Admin", userId: caller.id }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: perms } = await admin
      .from("collaborator_permissions")
      .select("user_id, permissions, is_active, created_at")
      .order("created_at", { ascending: false });

    if (!perms || perms.length === 0) {
      return new Response(JSON.stringify({ collaborators: [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ids = perms.map((p) => p.user_id);
    const [{ data: profiles }, { data: usersList }] = await Promise.all([
      admin.from("profiles").select("id, full_name").in("id", ids),
      admin.auth.admin.listUsers({ perPage: 1000 }),
    ]);

    const profileMap = new Map(profiles?.map((p) => [p.id, p.full_name]) || []);
    const emailMap = new Map(usersList.users.map((u) => [u.id, u.email || ""]));

    const collaborators = perms.map((p) => ({
      user_id: p.user_id,
      full_name: profileMap.get(p.user_id) || "",
      email: emailMap.get(p.user_id) || "",
      permissions: p.permissions || {},
      is_active: p.is_active,
      created_at: p.created_at,
    }));

    return new Response(JSON.stringify({ collaborators }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
