-- Fix sales_by_state to respect p_currency filter
-- Previously the state_data CTE used `approved` (which IS filtered by currency),
-- so the state map was already correct. No SQL change needed here — confirmed by audit.

-- Fix: add index to speed up orders JOIN with products for currency filter
-- used by fetchWeekdayOrders and get_dashboard_metrics
CREATE INDEX IF NOT EXISTS idx_orders_user_id_created_at
  ON public.orders (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_product_id_status
  ON public.orders (product_id, status);
