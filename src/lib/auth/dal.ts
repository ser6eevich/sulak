import 'server-only'

import { cache } from 'react'
import prisma from '@/lib/prisma'
import { getCurrentUserSession } from '@/lib/auth'

export const APP_ROLES = [
  'admin',
  'owner',
  'manager',
  'production',
  'warehouse',
  'logistician',
  'driver',
] as const

export type AppRole = (typeof APP_ROLES)[number]
export type AppPermissions = Record<string, boolean>

export const getCurrentProfile = cache(async () => {
  const session = await getCurrentUserSession()
  if (!session) return null

  const profile = await prisma.profile.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
      permissions: true,
    },
  })

  if (!profile?.isActive) {
    return null
  }

  return {
    ...profile,
    permissions: (profile.permissions as AppPermissions | null) ?? {},
  }
})

export async function requireCurrentProfile() {
  const profile = await getCurrentProfile()
  if (!profile) throw new Error('Не авторизован')
  return profile
}

export async function requireRole(allowedRoles: readonly AppRole[]) {
  const profile = await requireCurrentProfile()
  if (!allowedRoles.includes(profile.role as AppRole)) {
    throw new Error('Недостаточно прав')
  }
  return profile
}

export async function requireAccess(
  permission: string,
  allowedRoles: readonly AppRole[] = []
) {
  const profile = await requireCurrentProfile()
  const hasRole = allowedRoles.includes(profile.role as AppRole)
  if (!hasRole && profile.permissions[permission] !== true) {
    throw new Error('Недостаточно прав')
  }
  return profile
}
