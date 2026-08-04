/**
 * Вычисляет общую сумму позиций заказа (в рублях)
 */
export function calculateItemsTotal(items: { quantity: number; unitPrice: number }[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
}

/**
 * Вычисляет итоговую сумму заказа к оплате (в рублях)
 */
export function calculateGrandTotal(
  itemsTotal: number,
  deliveryPrice: number,
  assemblyPrice: number,
  discount: number
): number {
  const total = itemsTotal + deliveryPrice + assemblyPrice - discount
  return Math.max(0, total)
}
