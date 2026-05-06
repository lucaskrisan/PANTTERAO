import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-access-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function extractStoragePath(input: string): string | null {
  let value = input.trim();
  if (!value) return null;

  try {
    if (value.startsWith('http://') || value.startsWith('https://')) {
      const parsed = new URL(value);
      value = parsed.pathname;
    }
  } catch {
    // ignore malformed url and keep raw value
  }

  value = value.split('?')[0].split('#')[0];
  value = value.replace(/^\/+/, '');

  const match =
    value.match(/^storage\/v1\/object\/(?:public|sign)\/course-materials\/(.+)$/) ||
    value.match(/^storage\/v1\/object\/course-materials\/(.+)$/) ||
    value.match(/^course-materials\/(.+)$/);

  const rawPath = match ? match[1] : value;
  if (!rawPath) return null;

  try {
    return decodeURIComponent(rawPath);
  } catch {
    return rawPath;
  }
}

async function resolveCourseIdForMaterial(
  supabaseAdmin: any,
  materialId: string | null,
  normalizedPath: string,
): Promise<{ courseId: string | null; lessonId: string | null; filePath: string | null }> {
  let lessonId: string | null = null;
  let filePath = normalizedPath;

  if (materialId) {
    const { data: material } = await supabaseAdmin
      .from('lesson_materials')
      .select('id, lesson_id, file_url')
      .eq('id', materialId)
      .maybeSingle();

    if (!material) {
      return { courseId: null, lessonId: null, filePath: null };
    }

    lessonId = material.lesson_id;

    if (typeof material.file_url === 'string' && material.file_url.length > 0) {
      const canonicalFromMaterial = extractStoragePath(material.file_url);
      if (canonicalFromMaterial) {
        filePath = canonicalFromMaterial;
      }
    }
  }

  const firstSegment = (filePath ?? '').split('/')[0] ?? '';
  if (!lessonId && firstSegment && isUuid(firstSegment)) {
    const { data: lesson } = await supabaseAdmin
      .from('course_lessons')
      .select('id')
      .eq('id', firstSegment)
      .maybeSingle();

    if (lesson) {
      lessonId = lesson.id;
    }
  }

  if (lessonId) {
    const { data: lessonWithModule } = await supabaseAdmin
      .from('course_lessons')
      .select('module_id')
      .eq('id', lessonId)
      .maybeSingle();

    if (!lessonWithModule?.module_id) {
      return { courseId: null, lessonId, filePath };
    }

    const { data: moduleData } = await supabaseAdmin
      .from('course_modules')
      .select('course_id')
      .eq('id', lessonWithModule.module_id)
      .maybeSingle();

    return { courseId: moduleData?.course_id ?? null, lessonId, filePath };
  }

  // Legacy fallback: allow paths prefixed by course_id
  if (firstSegment && isUuid(firstSegment)) {
    const { data: course } = await supabaseAdmin
      .from('courses')
      .select('id')
      .eq('id', firstSegment)
      .maybeSingle();

    if (course) {
      return { courseId: course.id, lessonId: null, filePath };
    }
  }

  return { courseId: null, lessonId: null, filePath };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return new Response(
        JSON.stringify({ error: 'Payload inválido.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const rawFilePath = typeof body.file_path === 'string' ? body.file_path : '';
    const materialId = typeof body.material_id === 'string' ? body.material_id : null;

    if (!rawFilePath) {
      return new Response(
        JSON.stringify({ error: 'file_path é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (materialId && !isUuid(materialId)) {
      return new Response(
        JSON.stringify({ error: 'material_id inválido.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const normalizedFilePath = extractStoragePath(rawFilePath);

    if (!normalizedFilePath) {
      return new Response(
        JSON.stringify({ error: 'file_path inválido.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Sanitize file_path: prevent path traversal
    if (
      normalizedFilePath.includes('..') ||
      normalizedFilePath.startsWith('/') ||
      normalizedFilePath.includes('\\') ||
      normalizedFilePath.length > 1024
    ) {
      return new Response(
        JSON.stringify({ error: 'Caminho inválido.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const {
      courseId: targetCourseId,
      filePath,
    } = await resolveCourseIdForMaterial(supabaseAdmin, materialId, normalizedFilePath);

    if (!targetCourseId || !filePath) {
      return new Response(
        JSON.stringify({ error: 'Material inválido.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
    const accessToken = req.headers.get('x-access-token');

    let hasAccess = false;

    // 1. Check JWT auth — admins get immediate access, regular users check member_access
    if (authHeader) {
      const supabaseUser = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user } } = await supabaseUser.auth.getUser();
      if (user) {
        // Check if admin/super_admin — instant access
        const { data: roles } = await supabaseAdmin
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['admin', 'super_admin'])
          .limit(1);

        if (roles?.some((r: any) => r.role === 'admin' || r.role === 'super_admin')) {
          hasAccess = true;
        }

        // Course owner can always access their own material
        if (!hasAccess) {
          const { data: ownCourse } = await supabaseAdmin
            .from('courses')
            .select('id')
            .eq('id', targetCourseId)
            .eq('user_id', user.id)
            .maybeSingle();

          if (ownCourse) {
            hasAccess = true;
          }
        }

        // If not admin/owner, check if authenticated user has access to THIS course
        if (!hasAccess) {
          const customerIds = new Set<string>();

          const { data: customersByUser } = await supabaseAdmin
            .from('customers')
            .select('id')
            .eq('user_id', user.id)
            .limit(200);

          for (const customer of customersByUser || []) {
            customerIds.add(customer.id);
          }

          if (user.email) {
            const { data: customersByEmail } = await supabaseAdmin
              .from('customers')
              .select('id')
              .ilike('email', user.email)
              .limit(200);

            for (const customer of customersByEmail || []) {
              customerIds.add(customer.id);
            }
          }

          if (customerIds.size > 0) {
            const { data: accessRecords } = await supabaseAdmin
              .from('member_access')
              .select('id, expires_at')
              .in('customer_id', [...customerIds])
              .eq('course_id', targetCourseId)
              .order('created_at', { ascending: false })
              .limit(5);

            if ((accessRecords || []).some((rec: any) => !rec.expires_at || new Date(rec.expires_at) > new Date())) {
              hasAccess = true;
            }
          }
        }
      }
    }

    // 2. Check x-access-token (token-based access for buyers via link) scoped to requested course
    if (!hasAccess && accessToken && targetCourseId) {
      const { data: access } = await supabaseAdmin
        .from('member_access')
        .select('id, expires_at')
        .eq('access_token', accessToken)
        .eq('course_id', targetCourseId)
        .maybeSingle();

      if (access) {
        const notExpired = !access.expires_at || new Date(access.expires_at) > new Date();
        if (notExpired) hasAccess = true;
      }
    }

    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: 'Acesso negado. Token inválido ou expirado.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Generate signed URL using service role
    const { data, error } = await supabaseAdmin.storage
      .from('course-materials')
      .createSignedUrl(filePath, 3600); // 1 hour

    if (error || !data?.signedUrl) {
      console.error('[signed-material-url] Error:', error);
      return new Response(
        JSON.stringify({ error: 'Não foi possível gerar o link de download.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ signedUrl: data.signedUrl }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[signed-material-url] Error:', err);
    return new Response(
      JSON.stringify({ error: 'Erro interno.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
