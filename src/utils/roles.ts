export const roles = [
  { value: 'admin', label: 'Администратор' },
  { value: 'owner', label: 'Руководитель' },
  { value: 'manager', label: 'Менеджер' },
  { value: 'production', label: 'Производство' },
  { value: 'warehouse', label: 'Склад' },
  { value: 'logistician', label: 'Логист' },
  { value: 'driver', label: 'Водитель' },
]

export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    admin: 'Администратор',
    owner: 'Руководитель',
    manager: 'Менеджер',
    production: 'Производство',
    warehouse: 'Склад',
    logistician: 'Логист',
    driver: 'Водитель',
  }
  return labels[role] || role
}
