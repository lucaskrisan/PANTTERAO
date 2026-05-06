CREATE INDEX IF NOT EXISTS idx_courses_user_id ON public.courses USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_course_modules_course_id_sort_order ON public.course_modules USING btree (course_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_course_lessons_module_id_sort_order ON public.course_lessons USING btree (module_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_lesson_materials_lesson_id_sort_order ON public.lesson_materials USING btree (lesson_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_lesson_reviews_lesson_id_created_at ON public.lesson_reviews USING btree (lesson_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_replies_review_id_created_at ON public.review_replies USING btree (review_id, created_at);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_member_access_completed_lesson ON public.lesson_progress USING btree (member_access_id, completed, lesson_id);