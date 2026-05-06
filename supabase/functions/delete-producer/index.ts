import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is super_admin
    const callerClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const {
      data: { user: caller },
    } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: isSA } = await adminClient.rpc("is_super_admin", {
      _user_id: caller.id,
    });
    if (!isSA) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { producer_id } = await req.json();
    if (!producer_id) {
      return new Response(
        JSON.stringify({ error: "producer_id é obrigatório" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Prevent self-deletion
    if (producer_id === caller.id) {
      return new Response(
        JSON.stringify({ error: "Você não pode excluir sua própria conta." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Prevent deleting other super_admins
    const { data: targetIsSA } = await adminClient.rpc("is_super_admin", {
      _user_id: producer_id,
    });
    if (targetIsSA) {
      return new Response(
        JSON.stringify({ error: "Não é possível excluir um Super Admin." }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[delete-producer] Deleting producer ${producer_id}...`);

    // Delete related data in order (cascading)
    // 1. Billing
    await adminClient
      .from("billing_transactions")
      .delete()
      .eq("user_id", producer_id);
    await adminClient
      .from("billing_accounts")
      .delete()
      .eq("user_id", producer_id);

    // 2. Webhook deliveries → endpoints
    const { data: endpoints } = await adminClient
      .from("webhook_endpoints")
      .select("id")
      .eq("user_id", producer_id);
    if (endpoints && endpoints.length > 0) {
      const endpointIds = endpoints.map((e: any) => e.id);
      await adminClient
        .from("webhook_deliveries")
        .delete()
        .in("endpoint_id", endpointIds);
      await adminClient
        .from("webhook_endpoints")
        .delete()
        .eq("user_id", producer_id);
    }

    // 3. Courses → modules → lessons → materials, progress, reviews
    const { data: courses } = await adminClient
      .from("courses")
      .select("id")
      .eq("user_id", producer_id);
    if (courses && courses.length > 0) {
      const courseIds = courses.map((c: any) => c.id);

      // Member access for these courses
      const { data: accesses } = await adminClient
        .from("member_access")
        .select("id")
        .in("course_id", courseIds);
      if (accesses && accesses.length > 0) {
        const accessIds = accesses.map((a: any) => a.id);
        await adminClient
          .from("lesson_progress")
          .delete()
          .in("member_access_id", accessIds);
        await adminClient
          .from("lesson_reviews")
          .delete()
          .in("member_access_id", accessIds);
        await adminClient
          .from("member_access")
          .delete()
          .in("course_id", courseIds);
      }

      const { data: modules } = await adminClient
        .from("course_modules")
        .select("id")
        .in("course_id", courseIds);
      if (modules && modules.length > 0) {
        const moduleIds = modules.map((m: any) => m.id);
        const { data: lessons } = await adminClient
          .from("course_lessons")
          .select("id")
          .in("module_id", moduleIds);
        if (lessons && lessons.length > 0) {
          const lessonIds = lessons.map((l: any) => l.id);
          await adminClient
            .from("lesson_materials")
            .delete()
            .in("lesson_id", lessonIds);
          await adminClient
            .from("course_lessons")
            .delete()
            .in("module_id", moduleIds);
        }
        await adminClient
          .from("course_modules")
          .delete()
          .in("course_id", courseIds);
      }
      await adminClient
        .from("courses")
        .delete()
        .eq("user_id", producer_id);
    }

    // 4. Products and related
    const { data: prods } = await adminClient
      .from("products")
      .select("id")
      .eq("user_id", producer_id);
    if (prods && prods.length > 0) {
      const prodIds = prods.map((p: any) => p.id);
      await adminClient
        .from("order_bumps")
        .delete()
        .in("product_id", prodIds);
      await adminClient
        .from("upsell_offers")
        .delete()
        .in("product_id", prodIds);
      await adminClient
        .from("product_pixels")
        .delete()
        .in("product_id", prodIds);
      await adminClient.from("coupons").delete().in("product_id", prodIds);
      await adminClient
        .from("checkout_builder_configs")
        .delete()
        .in("product_id", prodIds);
      await adminClient
        .from("abandoned_carts")
        .delete()
        .in("product_id", prodIds);
      await adminClient
        .from("sales_pages")
        .delete()
        .in("product_id", prodIds);
      await adminClient
        .from("emq_snapshots")
        .delete()
        .in("product_id", prodIds);
    }

    // 5. Orders and customers
    await adminClient.from("orders").delete().eq("user_id", producer_id);
    await adminClient.from("customers").delete().eq("user_id", producer_id);
    await adminClient.from("products").delete().eq("user_id", producer_id);

    // 6. Other user-level data
    await adminClient
      .from("email_logs")
      .delete()
      .eq("user_id", producer_id);
    await adminClient
      .from("pixel_events")
      .delete()
      .eq("user_id", producer_id);
    await adminClient
      .from("notification_settings")
      .delete()
      .eq("user_id", producer_id);
    await adminClient
      .from("checkout_settings")
      .delete()
      .eq("user_id", producer_id);
    await adminClient
      .from("payment_gateways")
      .delete()
      .eq("user_id", producer_id);
    await adminClient
      .from("custom_domains")
      .delete()
      .eq("user_id", producer_id);
    await adminClient
      .from("facebook_domains")
      .delete()
      .eq("user_id", producer_id);
    await adminClient
      .from("pwa_settings")
      .delete()
      .eq("user_id", producer_id);
    await adminClient
      .from("internal_tasks")
      .delete()
      .eq("user_id", producer_id);
    await adminClient
      .from("appsell_integrations")
      .delete()
      .eq("user_id", producer_id);

    // 7. Roles and profile
    await adminClient
      .from("user_roles")
      .delete()
      .eq("user_id", producer_id);
    await adminClient.from("profiles").delete().eq("id", producer_id);

    // 8. Delete auth user
    const { error: deleteAuthError } =
      await adminClient.auth.admin.deleteUser(producer_id);
    if (deleteAuthError) {
      console.error(
        "[delete-producer] Auth delete error:",
        deleteAuthError.message
      );
      return new Response(
        JSON.stringify({
          error: "Dados removidos, mas erro ao excluir conta: " + deleteAuthError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[delete-producer] Producer ${producer_id} deleted successfully`);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[delete-producer] Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
