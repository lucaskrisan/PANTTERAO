CREATE INDEX IF NOT EXISTS idx_review_replies_review_id_created_at
  ON public.review_replies (review_id, created_at ASC);