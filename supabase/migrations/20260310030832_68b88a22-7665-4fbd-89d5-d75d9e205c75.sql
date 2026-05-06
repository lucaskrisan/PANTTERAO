-- Courses table (linked to products)
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Modules within a course
CREATE TABLE public.course_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lessons within a module
CREATE TABLE public.course_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.course_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text', -- text, link, pdf, video_embed
  content TEXT, -- HTML/markdown content, URL, or embed code
  file_url TEXT, -- for downloadable files
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Member access (linked to customer + order)
CREATE TABLE public.member_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  access_token UUID NOT NULL DEFAULT gen_random_uuid(),
  expires_at TIMESTAMPTZ, -- null = lifetime
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(customer_id, course_id)
);

-- Lesson progress tracking
CREATE TABLE public.lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_access_id UUID NOT NULL REFERENCES public.member_access(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  UNIQUE(member_access_id, lesson_id)
);

-- Enable RLS
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

-- Admin policies
CREATE POLICY "Admins can manage courses" ON public.courses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage modules" ON public.course_modules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage lessons" ON public.course_lessons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage access" ON public.member_access FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage progress" ON public.lesson_progress FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Public read via access_token (members access their content)
CREATE POLICY "Members can read courses via token" ON public.courses FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Members can read modules" ON public.course_modules FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Members can read lessons" ON public.course_lessons FOR SELECT TO anon, authenticated
  USING (true);

-- Member access readable by token holder (handled in app logic)
CREATE POLICY "Anyone can read own access" ON public.member_access FOR SELECT TO anon, authenticated
  USING (true);

-- Progress: insert/update by anyone (token validated in app)
CREATE POLICY "Anyone can insert progress" ON public.lesson_progress FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update progress" ON public.lesson_progress FOR UPDATE TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can read progress" ON public.lesson_progress FOR SELECT TO anon, authenticated
  USING (true);