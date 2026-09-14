ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS feedback_rating INTEGER;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS feedback_recorded_at TIMESTAMPTZ;

UPDATE public.orders AS orders
SET feedback_recorded_at = COALESCE(
  (
    SELECT logs.created_at
    FROM public.audit_logs AS logs
    WHERE logs.entity_type = 'order'
      AND logs.entity_id = orders.id
      AND logs.action = 'update_feedback'
    ORDER BY logs.created_at DESC
    LIMIT 1
  ),
  orders.updated_at
)
WHERE orders.feedback_type <> 'none'
  AND orders.feedback_recorded_at IS NULL;
