export interface RetrospectiveOrderInput {
  enabled: boolean
  customCreatedAt?: string | null
  customDeliveredAt?: string | null
  status?: string | null
  paymentStatus?: string | null
}

export interface RetrospectiveOrderFields {
  createdAt: Date
  deliveredAt: Date | null
  status: string
  paymentStatus: string
}

function parseRequiredDate(
  value: string | null | undefined,
  missingMessage: string,
  invalidMessage: string
) {
  if (!value) {
    throw new Error(missingMessage)
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error(invalidMessage)
  }

  return date
}

export function resolveRetrospectiveOrderFields(
  input: RetrospectiveOrderInput
): RetrospectiveOrderFields | null {
  if (!input.enabled) return null

  const status = input.status || 'pending'

  return {
    createdAt: parseRequiredDate(
      input.customCreatedAt,
      'Укажите дату и время создания заказа',
      'Некорректная дата и время создания заказа'
    ),
    deliveredAt: status === 'delivered'
      ? parseRequiredDate(
          input.customDeliveredAt,
          'Укажите дату и время доставки заказа',
          'Некорректная дата и время доставки заказа'
        )
      : null,
    status,
    paymentStatus: input.paymentStatus || 'unpaid',
  }
}
