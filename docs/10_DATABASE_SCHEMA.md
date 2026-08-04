# Предварительная схема базы данных

## Пользователи и аудит

### profiles
id, full_name, phone, email, role, is_active, avatar_url, created_at, updated_at.

### audit_logs
id, user_id, entity_type, entity_id, action, old_data JSONB, new_data JSONB, comment, created_at.

## Клиенты

### clients
id, full_name, primary_phone, additional_phone, region, city, address, postal_code, source, avito_account, comment, created_by, created_at, updated_at, archived_at.

## Каталог

### product_categories
id, name, slug, is_active, sort_order.

### products
id, category_id, name, description, base_sku, unit, track_inventory, is_active, created_at, updated_at, archived_at.

### product_variants
id, product_id, sku, size, color, material, thickness, attributes JSONB, purchase_price, sale_price, weight, volume, is_active.

## Заказы

### orders
id, order_number, client_id, manager_id, region, city, address, source, avito_account, desired_delivery_date, planned_ready_date, customer_comment, internal_comment, goods_amount, discount_amount, delivery_amount, lifting_amount, extra_amount, total_amount, order_status, production_status, fulfillment_status, delivery_status, payment_status, created_at, updated_at, cancelled_at, completed_at.

### order_items
id, order_id, product_variant_id, product_name_snapshot, sku_snapshot, attributes_snapshot JSONB, quantity, unit_price, discount_amount, total_amount, requires_production, created_at.

## Склад

### warehouse_locations
id, name, type, vehicle_id, is_active.

### inventory_movements
id, movement_type, product_variant_id, quantity, from_location_id, to_location_id, order_id, trip_id, production_task_id, performed_by, comment, idempotency_key, created_at.

### inventory_reservations
id, order_id, order_item_id, product_variant_id, location_id, quantity, status, created_at, released_at, consumed_at.

### inventory_thresholds
id, product_variant_id, location_id, minimum_quantity.

### stocktakes / stocktake_items
Документы инвентаризации и строки с системным, фактическим и разностным количеством.

## Производство

### production_tasks
id, task_number, order_id, status, priority, planned_ready_date, assigned_to, comment, created_at, completed_at.

### production_task_items
id, production_task_id, order_item_id, product_variant_id, requested_quantity, ready_quantity, status.

## Логистика

### drivers
id, profile_id, phone, license_info, is_active.

### vehicles
id, name, registration_number, max_weight, max_volume, max_places, body_type, is_active.

### trips
id, trip_number, driver_id, vehicle_id, planned_departure_at, actual_departure_at, status, direction, comment, created_at, completed_at.

### trip_orders
id, trip_id, order_id, stop_order, delivery_window_from, delivery_window_to, logistic_comment, status.

## Финансы

### payments
id, order_id, amount, payment_type, payment_method, status, driver_id, created_by, comment, idempotency_key, paid_at, created_at.

## Файлы и уведомления

### attachments
id, entity_type, entity_id, file_url, file_name, mime_type, uploaded_by, created_at.

### notifications
id, user_id, type, title, body, entity_type, entity_id, read_at, created_at.

### notification_deliveries
id, notification_id, channel, status, error, sent_at.

Это предварительная схема. Перед реализацией агент должен построить ER-диаграмму, добавить внешние ключи, индексы, ограничения, enum или справочники и объяснить изменения.
