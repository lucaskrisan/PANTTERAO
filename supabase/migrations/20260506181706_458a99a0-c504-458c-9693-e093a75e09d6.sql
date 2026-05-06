-- 1. Add specific ID columns for better joining
ALTER TABLE public.recovery_opportunities
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id),
  ADD COLUMN IF NOT EXISTS abandoned_cart_id uuid REFERENCES public.abandoned_carts(id);

-- 2. Trigger function to sync these columns
CREATE OR REPLACE FUNCTION public.sync_recovery_opportunity_ids()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'pix' THEN
    NEW.order_id = NEW.reference_id;
    NEW.abandoned_cart_id = NULL;
  ELSIF NEW.type = 'abandoned_cart' THEN
    NEW.abandoned_cart_id = NEW.reference_id;
    NEW.order_id = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_sync_recovery_opportunity_ids
BEFORE INSERT OR UPDATE ON public.recovery_opportunities
FOR EACH ROW
EXECUTE FUNCTION public.sync_recovery_opportunity_ids();

-- 3. Populate existing data
UPDATE public.recovery_opportunities
SET order_id = reference_id
WHERE type = 'pix';

UPDATE public.recovery_opportunities
SET abandoned_cart_id = reference_id
WHERE type = 'abandoned_cart';
