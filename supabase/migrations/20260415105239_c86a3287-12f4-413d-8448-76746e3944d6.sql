-- Create member_access for all paid orders that are missing access
INSERT INTO member_access (course_id, customer_id, order_id)
SELECT 
  '47e9e174-1d88-4fca-886e-91e433acc578'::uuid,
  o.customer_id,
  o.id
FROM orders o
WHERE o.status IN ('paid', 'approved')
  AND o.created_at > now() - interval '30 days'
  AND o.product_id = '35621f66-987c-4dfb-bba1-6f933540005e'
  AND o.customer_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM member_access ma WHERE ma.order_id = o.id)
ON CONFLICT DO NOTHING;