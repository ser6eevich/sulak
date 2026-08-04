import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  })

  if (!profile) {
    await supabase.auth.signOut()
    redirect('/login')
  }

  // Перенаправляем пользователя на его стартовую страницу согласно роли
  switch (profile.role) {
    case 'admin':
    case 'owner':
      redirect('/dashboard')
    case 'manager':
      redirect('/orders')
    case 'production':
      redirect('/production/dashboard')
    case 'warehouse':
      redirect('/warehouse/dashboard')
    case 'logistician':
      redirect('/logistician/dashboard')
    case 'driver':
      redirect('/unauthorized')
    default:
      redirect('/unauthorized')
  }
}
