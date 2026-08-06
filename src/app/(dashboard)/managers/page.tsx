import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import ManagersDashboardClient from './ManagersDashboardClient'

export const dynamic = 'force-dynamic'

export default async function ManagersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  })

  const userPerms = profile && typeof profile.permissions === 'object'
    ? (profile.permissions as Record<string, boolean>)
    : {}
  const hasAccess = ['admin', 'owner'].includes(profile?.role || '') || userPerms.managers === true

  if (!profile || !profile.isActive || !hasAccess) {
    redirect('/unauthorized')
  }

  const managers = await prisma.profile.findMany({
    where: {
      role: 'manager',
    },
    include: {
      sellerOrders: {
        include: {
          client: {
            select: {
              fullName: true,
              primaryPhone: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
    orderBy: {
      fullName: 'asc',
    },
  })

  const initialManagers = managers.map(m => ({
    ...m,
    telegramUsername: m.telegramUsername,
  }))

  return (
    <div className="min-w-0 space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
          Команда менеджеров
        </h1>
        <p className="mt-1 text-xs font-normal text-[var(--text-secondary)]">
          Профили сотрудников, Telegram-уведомления и результаты продаж
        </p>
      </div>

      <ManagersDashboardClient 
        initialManagers={initialManagers} 
        userRole={profile.role} 
      />
    </div>
  )
}
