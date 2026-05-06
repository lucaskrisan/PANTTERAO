CREATE OR REPLACE FUNCTION public.get_revenue_summary(p_user_id uuid)
RETURNS TABLE(
  total_revenue numeric,
  total_fees numeric,
  total_pending numeric,
  paid_count bigint,
  pending_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(CASE WHEN status IN ('paid', 'approved') THEN amount ELSE 0 END), 0) AS total_revenue,
    COALESCE(SUM(CASE WHEN status IN ('paid', 'approved') THEN COALESCE(platform_fee_amount, 0) ELSE 0 END), 0) AS total_fees,
    COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS total_pending,
    COUNT(*) FILTER (WHERE status IN ('paid', 'approved')) AS paid_count,
    COUNT(*) FILTER (WHERE status = 'pending') AS pending_count
  FROM public.orders
  WHERE user_id = p_user_id;
$$;