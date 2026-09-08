-- Необязательное переопределение цвета для конкретной позиции заказа.
-- Добавление колонки не меняет существующие записи и не влияет на суммы.
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS custom_color TEXT;
