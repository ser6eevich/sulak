import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import ManagersDashboardClient from './ManagersDashboardClient'
import { Users } from 'lucide-react'

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

  const tgRows = await prisma.$queryRawUnsafe<{ id: string; telegram_username: string | null }[]>(
    `SELECT id, telegram_username FROM public.profiles WHERE role = 'manager'`
  )
  const tgMap = new Map(tgRows.map(r => [r.id, r.telegram_username]))

  const initialManagers = managers.map(m => ({
    ...m,
    telegramUsername: (m as any).telegramUsername || tgMap.get(m.id) || null,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
          <Users className="h-5 w-5 text-[var(--accent-primary)]" />
          Команда менеджеров по продажам
        </h1>
        <p className="text-xs font-normal text-[var(--text-secondary)] mt-1">
          Управление профилями менеджеров, Telegram-тегами для автоуведомлений и аналитикой закрытых сделок
        </p>
      </div>

      <ManagersDashboardClient 
        initialManagers={initialManagers} 
        userRole={profile.role} 
      />
    </div>
  )
}
