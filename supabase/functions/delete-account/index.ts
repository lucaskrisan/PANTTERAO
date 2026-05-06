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

    const userId = user.id;

    // Delete all user data from public tables in order (respecting FK constraints)
    // Tables with user_id column
    const userTables = [
      "notification_settings",
      "billing_transactions",
      "billing_accounts",
      "pixel_events",
      "emq_snapshots",
      "product_pixels",
      "checkout_builder_configs",
      "checkout_settings",
      "order_bumps",
      "upsell_offers",
      "facebook_domains",
      "webhook_endpoints",
      "email_logs",
      "pwa_settings",
      "internal_tasks",
      "abandoned_carts",
      "coupons",
      "payment_gateways",
    ];

    for (const table of userTables) {
      await supabaseAdmin.from(table).delete().eq("user_id", userId);
    }

    // Delete orders (has FK to products and customers)
    await supabaseAdmin.from("orders").delete().eq("user_id", userId);

    // Delete course content (lessons → modules → courses)
    const { data: courses } = await supabaseAdmin
      .from("courses")
      .select("id")
      .eq("user_id", userId);

    if (courses && courses.length > 0) {
      const courseIds = courses.map((c) => c.id);

      // Get modules for these courses
      const { data: modules } = await supabaseAdmin
        .from("course_modules")
        .select("id")
        .in("course_id", courseIds);

      if (modules && modules.length > 0) {
        const moduleIds = modules.map((m) => m.id);

        // Get lessons
        const { data: lessons } = await supabaseAdmin
          .from("course_lessons")
          .select("id")
          .in("module_id", moduleIds);

        if (lessons && lessons.length > 0) {
          const lessonIds = lessons.map((l) => l.id);
          await supabaseAdmin.from("lesson_materials").delete().in("lesson_id", lessonIds);
          await supabaseAdmin.from("lesson_progress").delete().in("lesson_id", lessonIds);
          await supabaseAdmin.from("lesson_reviews").delete().in("lesson_id", lessonIds);
        }

        await supabaseAdmin.from("course_lessons").delete().in("module_id", moduleIds);
      }

      await supabaseAdmin.from("course_modules").delete().in("course_id", courseIds);

      // Delete member_access for these courses
      await supabaseAdmin.from("member_access").delete().in("course_id", courseIds);

      await supabaseAdmin.from("courses").delete().eq("user_id", userId);
    }

    // Delete products
    await supabaseAdmin.from("products").delete().eq("user_id", userId);

    // Delete customers owned by this user
    await supabaseAdmin.from("customers").delete().eq("user_id", userId);

    // Delete profile and roles
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("profiles").delete().eq("id", userId);

    // Finally, delete the auth user
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      return new Response(JSON.stringify({ error: "Erro ao deletar conta: " + deleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
