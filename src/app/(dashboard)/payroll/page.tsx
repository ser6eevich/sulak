import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import PayrollClient from './PayrollClient'

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
    <div className="min-w-0 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
            Расчёт зарплаты
          </h1>
          <p className="mt-1 text-xs font-normal text-[var(--text-secondary)]">
            Начисления менеджерам по доставленным заказам, ставкам и отзывам клиентов
          </p>
        </div>
      </div>

      <PayrollClient />
    </div>
  )
}
