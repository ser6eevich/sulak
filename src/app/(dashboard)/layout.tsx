import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import Sidebar from '@/components/Sidebar'
import MobileNav from '@/components/MobileNav'
import ThemeToggle from '@/components/ThemeToggle'
import { ThemeProvider } from '@/components/ThemeProvider'
import PresencePing from '@/components/PresencePing'
import MustChangePasswordModal from '@/components/MustChangePasswordModal'
import { getRoleLabel } from '@/utils/roles'
import { Layers, ShieldCheck } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const profileRecord = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { email: true, fullName: true, role: true, permissions: true }
  })

  if (!profileRecord) {
    await supabase.auth.signOut()
    redirect('/login')
  }

  const profile = {
    email: profileRecord.email,
    full_name: profileRecord.fullName,
    role: profileRecord.role,
    permissions: profileRecord.permissions,
  }

  const rawHashRes = await prisma.$queryRawUnsafe<{ password_hash: string | null }[]>(
    `SELECT password_hash FROM public.profiles WHERE id = $1::uuid`,
    user.id
  )
  const passwordHash = rawHashRes?.[0]?.password_hash
  const isDefaultPassword = passwordHash ? bcrypt.compareSync('123456', passwordHash) : false

  const mustChangePassword = isDefaultPassword || (
    typeof profileRecord.permissions === 'object' && 
    profileRecord.permissions !== null && 
    (profileRecord.permissions as Record<string, any>).mustChangePassword === true
  )

  return (
    <ThemeProvider>
      <div className="flex h-screen h-[100dvh] bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden font-sans">
        {/* Sidebar (Desktop) */}
        <Sidebar profile={profile} />

        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          {/* Header Bar */}
          <header className="flex h-13 pt-[env(safe-area-inset-top)] items-center justify-between border-b border-[var(--border-primary)] bg-[var(--bg-header)] backdrop-blur-md px-4 md:px-6 select-none z-10 shrink-0">
            <div className="flex items-center gap-2 text-xs min-w-0">
              <span className="font-normal text-[var(--text-tertiary)] flex items-center gap-1.5 shrink-0">
                <Layers className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                Сулак CRM
              </span>
              <span className="text-[var(--border-strong)] font-light">/</span>
              <span className="font-medium text-[var(--text-secondary)] truncate">
                Рабочая область
              </span>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {/* Live Status indicator */}
              <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--success-soft)] border border-[var(--success)]/20 text-[10px] font-medium text-[var(--success)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)] animate-pulse" />
                Онлайн
              </div>

              {/* Theme Toggle */}
              <ThemeToggle />

              <div className="h-4 w-px bg-[var(--border-primary)]" />

              {/* User badge */}
              <div className="flex items-center gap-2">
                <div className="flex flex-col text-right hidden sm:flex">
                  <span className="text-xs font-medium text-[var(--text-primary)] leading-tight truncate max-w-[140px]">
                    {profile.full_name}
                  </span>
                  <span className="text-[9px] font-normal text-[var(--text-tertiary)] uppercase tracking-wider">
                    {getRoleLabel(profile.role)}
                  </span>
                </div>
                <div className="h-6.5 w-6.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)] font-semibold text-[11px] flex items-center justify-center border border-[var(--accent-primary)]/20">
                  {profile.full_name.slice(0, 1).toUpperCase()}
                </div>
              </div>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 max-w-full bg-[var(--bg-app)] p-3 sm:p-4 md:p-6 lg:p-8 pb-20 md:pb-6">
            {children}
          </main>

          {/* Bottom Mobile Navigation */}
          <MobileNav profile={profile} />
        </div>
      </div>
      
      {/* Модалка принудительной смены временного пароля */}
      {mustChangePassword && (
        <MustChangePasswordModal profileName={profile.full_name} />
      )}

      {/* Трекинг онлайн-присутствия (невидимый) */}
      <PresencePing />
    </ThemeProvider>
  )
}
