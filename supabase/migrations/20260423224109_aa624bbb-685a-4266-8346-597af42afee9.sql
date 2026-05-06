
-- 1) Tabela de vínculo N:N entre produtos e cursos (áreas de membros)
CREATE TABLE IF NOT EXISTS public.course_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (course_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_course_products_product ON public.course_products(product_id);
CREATE INDEX IF NOT EXISTS idx_course_products_course ON public.course_products(course_id);

ALTER TABLE public.course_products ENABLE ROW LEVEL SECURITY;

-- Leitura pública (necessária para checkout anônimo descobrir quais cursos liberar)
CREATE POLICY "Anyone can read course_products"
ON public.course_products
FOR SELECT
USING (true);

-- Apenas o dono do curso (ou super admin) pode gerenciar vínculos
CREATE POLICY "Course owner manages course_products"
ON public.course_products
FOR ALL
TO authenticated
USING (
  public.owns_course(auth.uid(), course_id)
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  public.owns_course(auth.uid(), course_id)
  OR public.is_super_admin(auth.uid())
);

-- 2) Back-fill: migra todos os vínculos existentes (courses.product_id) para a nova tabela
INSERT INTO public.course_products (course_id, product_id)
SELECT id, product_id
FROM public.courses
WHERE product_id IS NOT NULL
ON CONFLICT (course_id, product_id) DO NOTHING;

-- 3) Helper: lista os course_ids vinculados a um produto (considerando ambos os caminhos:
--    o legado courses.product_id e a nova tabela course_products)
CREATE OR REPLACE FUNCTION public.get_courses_for_product(p_product_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM public.courses WHERE product_id = p_product_id
  UNION
  SELECT course_id FROM public.course_products WHERE product_id = p_product_id;
$$;
