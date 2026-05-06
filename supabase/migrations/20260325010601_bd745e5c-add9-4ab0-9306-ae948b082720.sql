
-- Add moderation columns to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'pending_review',
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Set all existing products to approved
UPDATE public.products SET moderation_status = 'approved' WHERE moderation_status = 'pending_review';
