-- View for unclaimed opportunities
CREATE OR REPLACE VIEW public.unclaimed_opportunities AS
WITH claimed_ids AS (
    SELECT reference_id, type 
    FROM public.recovery_opportunities 
    WHERE status = 'claimed'
)
SELECT 
    'abandoned_cart' as type,
    ac.id as reference_id,
    ac.customer_name,
    ac.customer_phone,
    ac.product_price as amount,
    ac.created_at,
    p.name as product_name
FROM public.abandoned_carts ac
LEFT JOIN public.products p ON ac.product_id = p.id
WHERE ac.recovered = false
  AND NOT EXISTS (SELECT 1 FROM claimed_ids WHERE reference_id = ac.id AND type = 'abandoned_cart')

UNION ALL

SELECT 
    'pix' as type,
    o.id as reference_id,
    c.name as customer_name,
    c.phone as customer_phone,
    o.amount,
    o.created_at,
    p.name as product_name
FROM public.orders o
LEFT JOIN public.customers c ON o.customer_id = c.id
LEFT JOIN public.products p ON o.product_id = p.id
WHERE o.status = 'pending' 
  AND o.payment_method = 'pix'
  AND NOT EXISTS (SELECT 1 FROM claimed_ids WHERE reference_id = o.id AND type = 'pix');

-- Grant access
GRANT SELECT ON public.unclaimed_opportunities TO authenticated;
