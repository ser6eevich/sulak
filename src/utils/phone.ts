export function normalizePhoneNumber(phone: string): string {
  // Оставляем только цифры
  const cleaned = phone.replace(/\D/g, '')
  
  // Если ввели 10 цифр (например, 9281234567)
  if (cleaned.length === 10 && cleaned.startsWith('9')) {
    return `+7${cleaned}`
  }
  
  // Если ввели 11 цифр (например, 89281234567 или 79281234567)
  if (cleaned.length === 11 && (cleaned.startsWith('8') || cleaned.startsWith('7')) && cleaned[1] === '9') {
    return `+7${cleaned.slice(1)}`
  }

  return ''
}

export function validatePhoneNumber(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone)
  // Проверяем формат +79XXXXXXXXX (российские мобильные)
  return /^\+79\d{9}$/.test(normalized)
}
