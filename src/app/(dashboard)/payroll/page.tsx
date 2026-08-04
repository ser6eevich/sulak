import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import PayrollClient from './PayrollClient'
import { DollarSign } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function PayrollPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  })

  const userPerms = profile && typeof profile.permissions === 'object'
    ? (profile.permissions as Record<string, boolean>)
    : {}
  const hasAccess = ['admin', 'owner'].includes(profile?.role || '') || userPerms.payroll === true

  if (!profile || !profile.isActive || !hasAccess) {
    redirect('/unauthorized')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-[var(--accent-primary)]" />
            Расчет зарплаты менеджеров
          </h1>
          <p className="text-xs font-normal text-[var(--text-secondary)] mt-1">
            Автоматический расчет выплат на основе сетки ставок, объема доставленных заказов и коэффициента отзывов
          </p>
        </div>
      </div>

      <PayrollClient />
    </div>
  )
}
