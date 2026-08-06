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
import { ChevronDown } from 'lucide-react'

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
    select: { email: true, fullName: true, role: true, permissions: true, passwordHash: true }
  })

  if (!profileRecord) {
    await supabase.auth.signOut()
    redirect('/login')
  }

  const profile = {
    email: profileRecord.email,
    full_name: profileRecord.fullName,
    role: profileRecord.role,
    permissions:
      profileRecord.permissions && typeof profileRecord.permissions === 'object' && !Array.isArray(profileRecord.permissions)
        ? (profileRecord.permissions as Record<string, boolean>)
        : {},
  }

  const isDefaultPassword = profileRecord.passwordHash
    ? await bcrypt.compare('123456', profileRecord.passwordHash)
    : false

  const mustChangePassword = isDefaultPassword || (
    typeof profileRecord.permissions === 'object' && 
    profileRecord.permissions !== null && 
    (profileRecord.permissions as Record<string, unknown>).mustChangePassword === true
  )

  return (
    <ThemeProvider>
      <div className="flex h-screen h-[100dvh] overflow-hidden bg-[var(--bg-app)] font-sans text-[var(--text-primary)]">
        {/* Sidebar (Desktop) */}
        <Sidebar profile={profile} />

        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          {/* Header Bar */}
          <header className="z-10 flex h-16 shrink-0 select-none items-center justify-between bg-[var(--bg-header)] px-4 pt-[env(safe-area-inset-top)] sm:h-20 md:px-7 lg:px-8">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate text-[22px] font-semibold tracking-[-0.035em] text-[var(--text-primary)] sm:text-[26px]">
                Рабочая область
              </h1>
              <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
            </div>

            <div className="flex shrink-0 items-center gap-2.5 sm:gap-3.5">
              {/* Live Status indicator */}
              <div className="hidden items-center gap-2 rounded-full border border-[var(--success)]/20 bg-[var(--success-soft)] px-3 py-1.5 text-[11px] font-medium text-[var(--success)] sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
                Онлайн
              </div>

              {/* Theme Toggle */}
              <ThemeToggle />

              <div className="hidden h-7 w-px bg-[var(--border-primary)] sm:block" />

              {/* User badge */}
              <div className="flex items-center gap-2.5">
                <div className="flex flex-col text-right hidden sm:flex">
                  <span className="max-w-[160px] truncate text-xs font-medium leading-tight text-[var(--text-primary)]">
                    {profile.full_name}
                  </span>
                  <span className="mt-0.5 text-[9px] font-normal uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                    {getRoleLabel(profile.role)}
                  </span>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-primary)] text-xs font-semibold text-white">
                  {profile.full_name.slice(0, 1).toUpperCase()}
                </div>
                <ChevronDown className="hidden h-3.5 w-3.5 text-[var(--text-tertiary)] sm:block" />
              </div>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto bg-[var(--bg-app)] px-3 pb-20 pt-1 sm:px-4 md:px-7 md:pb-7 lg:px-8">
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
