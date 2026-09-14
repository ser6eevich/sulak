ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS feedback_rating INTEGER;
