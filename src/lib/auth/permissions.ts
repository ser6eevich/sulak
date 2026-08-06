import type { AppRole } from '@/lib/auth/dal'

export const EDITABLE_PERMISSION_KEYS = [
  'catalog',
  'clients',
  'orders',
  'production',
  'warehouse',
  'logistician',
  'drivers',
  'payroll',
  'managers',
] as const

export function defaultPermissionsForRole(role: AppRole): Record<string, boolean> {
  return {
    catalog: ['admin', 'owner', 'manager', 'production', 'warehouse', 'logistician', 'driver'].includes(role),
    clients: ['admin', 'owner', 'manager'].includes(role),
    orders: ['admin', 'owner', 'manager', 'production', 'warehouse', 'logistician', 'driver'].includes(role),
    production: ['admin', 'owner', 'production'].includes(role),
    warehouse: ['admin', 'owner', 'warehouse'].includes(role),
    logistician: ['admin', 'owner', 'logistician'].includes(role),
    drivers: ['admin', 'owner', 'logistician', 'manager'].includes(role),
    payroll: ['admin', 'owner'].includes(role),
    managers: ['admin', 'owner'].includes(role),
    mustChangePassword: true,
  }
}

export function sanitizePermissions(input: Record<string, boolean>): Record<string, boolean> {
  return Object.fromEntries(
    EDITABLE_PERMISSION_KEYS.map((key) => [key, input[key] === true])
  )
}
