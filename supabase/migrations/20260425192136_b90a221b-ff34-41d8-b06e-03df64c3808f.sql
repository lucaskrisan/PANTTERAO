-- Trigger: quando uma verificação é aprovada, marca profiles.verified = true
-- Quando muda de aprovada pra outro status, marca profiles.verified = false
CREATE OR REPLACE FUNCTION public.sync_profile_verified_from_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Aprovação: marca como verificado
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    UPDATE public.profiles
    SET verified = true, updated_at = now()
    WHERE id = NEW.user_id;
  END IF;

  -- Reprovação ou volta pra pending: remove o selo
  -- (apenas se não houver OUTRA verificação aprovada do mesmo user)
  IF OLD.status = 'approved' AND NEW.status != 'approved' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.producer_verifications
      WHERE user_id = NEW.user_id
        AND status = 'approved'
        AND id != NEW.id
    ) THEN
      UPDATE public.profiles
      SET verified = false, updated_at = now()
      WHERE id = NEW.user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_verified ON public.producer_verifications;
CREATE TRIGGER trg_sync_profile_verified
AFTER INSERT OR UPDATE OF status ON public.producer_verifications
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_verified_from_verification();

-- Correção retroativa: sincroniza todos os profiles que têm verificação aprovada mas profile.verified = false
UPDATE public.profiles p
SET verified = true, updated_at = now()
WHERE verified = false
  AND EXISTS (
    SELECT 1 FROM public.producer_verifications pv
    WHERE pv.user_id = p.id AND pv.status = 'approved'
  );