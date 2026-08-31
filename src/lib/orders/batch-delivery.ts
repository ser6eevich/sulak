export interface BatchDeliveryOrderPreview {
  id: string
  number: string
  status: string
  totalPrice: number
  discount: number
  deliveryPrice: number
  assemblyPrice: number
  client: {
    fullName: string
  }
  seller: {
    fullName: string
  } | null
}

export function extractBatchOrderNumbers(input: string): string[] {
  const uniqueNumbers = new Set<string>()

  for (const rawToken of input.replace(/[№#]/g, ' ').split(/[\s,;]+/)) {
    const token = rawToken.trim().replace(/^[«"'([{]+|[»"')\]}:.!?]+$/g, '')
    if (!/^\d+$/.test(token)) continue

    uniqueNumbers.add(token.replace(/^0+(?=\d)/, ''))
  }

  return Array.from(uniqueNumbers)
}
