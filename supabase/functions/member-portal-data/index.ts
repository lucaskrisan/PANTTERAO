import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PortalCourse = {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  access_token?: string;
  source: "created" | "purchased";
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

    const email = user.email || "";

    const [{ data: profile }, { data: ownProducts }, { data: ownCourses }, { data: customers }] = await Promise.all([
      supabaseAdmin.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      supabaseAdmin.from("products").select("id, name, description, image_url").eq("user_id", user.id),
      supabaseAdmin.from("courses").select("id, title, description, cover_image_url, product_id").eq("user_id", user.id),
      email
        ? supabaseAdmin.from("customers").select("id").ilike("email", email)
        : Promise.resolve({ data: [] as { id: string }[] }),
    ]);

    // Build a map of product images for fallback
    const productImageMap = new Map<string, string>();
    for (const p of ownProducts || []) {
      if (p.image_url) productImageMap.set(p.id, p.image_url);
    }

    const allCourses: PortalCourse[] = [];
    const addedIds = new Set<string>();
    const courseByProductId = new Map<string, { id: string }>();

    for (const course of ownCourses || []) {
      if (course.product_id) {
        courseByProductId.set(course.product_id, { id: course.id });
      }

      allCourses.push({
        id: course.id,
        title: course.title,
        description: course.description,
        cover_image_url: course.cover_image_url || (course.product_id ? productImageMap.get(course.product_id) : null) || null,
        source: "created",
      });
      addedIds.add(course.id);
    }

    for (const product of ownProducts || []) {
      if (!courseByProductId.has(product.id)) {
        allCourses.push({
          id: `product-${product.id}`,
          title: product.name,
          description: product.description,
          cover_image_url: product.image_url,
          source: "created",
        });
      }
    }

    const customerIds = (customers || []).map((customer: any) => customer.id).filter(Boolean);

    if (customerIds.length > 0) {
      const { data: accesses } = await supabaseAdmin
        .from("member_access")
        .select("course_id, access_token, expires_at, created_at")
        .in("customer_id", customerIds)
        .order("created_at", { ascending: false })
        .limit(500);

      const validAccesses = (accesses || []).filter(
        (access: any) => access.course_id && (!access.expires_at || new Date(access.expires_at) > new Date())
      );

      const purchasedCourseIds = [...new Set(validAccesses.map((access: any) => access.course_id))];

      if (purchasedCourseIds.length > 0) {
        const { data: purchasedCourses } = await supabaseAdmin
          .from("courses")
          .select("id, title, description, cover_image_url, product_id")
          .in("id", purchasedCourseIds);

        // Collect product_ids that need image fallback
        const needImageIds = (purchasedCourses || [])
          .filter((c: any) => !c.cover_image_url && c.product_id)
          .map((c: any) => c.product_id);

        let purchasedProductImages = new Map<string, string>();
        if (needImageIds.length > 0) {
          const { data: prods } = await supabaseAdmin
            .from("products")
            .select("id, image_url")
            .in("id", needImageIds);
          for (const p of prods || []) {
            if (p.image_url) purchasedProductImages.set(p.id, p.image_url);
          }
        }

        const purchasedCourseMap = new Map((purchasedCourses || []).map((course: any) => [course.id, course]));

        for (const access of validAccesses) {
          const purchasedCourse = purchasedCourseMap.get(access.course_id);
          if (!purchasedCourse || addedIds.has(purchasedCourse.id)) continue;

          allCourses.push({
            id: purchasedCourse.id,
            title: purchasedCourse.title,
            description: purchasedCourse.description,
            cover_image_url: purchasedCourse.cover_image_url || (purchasedCourse.product_id ? purchasedProductImages.get(purchasedCourse.product_id) : null) || null,
            access_token: access.access_token,
            source: "purchased",
          });
          addedIds.add(purchasedCourse.id);
        }
      }
    }

    return new Response(
      JSON.stringify({
        customerName: profile?.full_name || email.split("@")[0] || "Aluno",
        customerEmail: email,
        courses: allCourses,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[member-portal-data] Error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});