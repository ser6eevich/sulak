import 'server-only'

export const MIN_PASSWORD_LENGTH = 10

export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Пароль должен содержать не менее ${MIN_PASSWORD_LENGTH} символов`
  }
  if (!/[a-zA-Zа-яА-Я]/.test(password) || !/\d/.test(password)) {
    return 'Пароль должен содержать хотя бы одну букву и одну цифру'
  }
  return null
}
