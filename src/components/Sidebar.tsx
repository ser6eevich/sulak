'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { logoutAction } from '@/app/login/actions'
import { 
  Users, 
  Hammer, 
  Package, 
  Truck, 
  LogOut, 
  BookOpen, 
  Contact, 
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Settings,
  PanelLeftClose,
  PanelLeft,
  FileText
} from 'lucide-react'

interface SidebarProps {
  profile: {
    email: string
    full_name: string
    role: string
    permissions?: Record<string, boolean> | null
  }
}

interface MenuItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles: string[]
  category: 'main' | 'operations' | 'admin'
}

const menuItems: MenuItem[] = [
  {
    title: 'Обзор платформы',
    href: '/dashboard',
    icon: TrendingUp,
    roles: ['admin', 'owner'],
    category: 'main',
  },
  {
    title: 'Каталог моделей',
    href: '/catalog',
    icon: BookOpen,
    roles: ['admin', 'owner', 'manager', 'production', 'warehouse', 'logistician', 'driver'],
    category: 'main',
  },
  {
    title: 'База клиентов',
    href: '/clients',
    icon: Contact,
    roles: ['admin', 'owner', 'manager'],
    category: 'main',
  },
  {
    title: 'Реестр заказов',
    href: '/orders',
    icon: ShoppingCart,
    roles: ['admin', 'owner', 'manager', 'production', 'warehouse', 'logistician', 'driver'],
    category: 'operations',
  },
  {
    title: 'Цех производства',
    href: '/production/dashboard',
    icon: Hammer,
    roles: ['admin', 'owner', 'production'],
    category: 'operations',
  },
  {
    title: 'Складской учет',
    href: '/warehouse/dashboard',
    icon: Package,
    roles: ['warehouse', 'admin', 'owner'],
    category: 'operations',
  },
  {
    title: 'Логистика',
    href: '/logistician/dashboard',
    icon: Truck,
    roles: ['logistician', 'admin', 'owner'],
    category: 'operations',
  },
  {
    title: 'Экипажи водителей',
    href: '/drivers',
    icon: Contact,
    roles: ['logistician', 'admin', 'owner', 'manager'],
    category: 'operations',
  },
  {
    title: 'Расчет зарплаты',
    href: '/payroll',
    icon: DollarSign,
    roles: ['admin', 'owner'],
    category: 'admin',
  },
  {
    title: 'Дневной отчёт',
    href: '/analytics/daily-report',
    icon: FileText,
    roles: ['admin', 'owner', 'manager'],
    category: 'admin',
  },
  {
    title: 'Команда менеджеров',
    href: '/managers',
    icon: Users,
    roles: ['admin', 'owner'],
    category: 'admin',
  },
  {
    title: 'Настройки системы',
    href: '/settings',
    icon: Settings,
    roles: ['admin', 'owner'],
    category: 'admin',
  },
]

const GROUP_LABELS: Record<string, string> = {
  main: 'Основное',
  operations: 'Операции',
  admin: 'Управление',
}

export default function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()

  // Состояние collapsed: по умолчанию развёрнут, читаем из localStorage
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => {
    const saved = localStorage.getItem('sulak-sidebar-collapsed')
    const timeoutId = window.setTimeout(() => setCollapsed(saved === 'true'), 0)
    return () => window.clearTimeout(timeoutId)
  }, [])

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem('sulak-sidebar-collapsed', String(next))
      return next
    })
  }

  // Фильтрация пунктов меню по роли/разрешениям
  const filteredMenu = menuItems.filter(item => {
    const sectionKey = item.href.replace('/', '').split('/')[0] || 'dashboard'
    
    if (profile.permissions && typeof profile.permissions === 'object') {
      const userPerm = (profile.permissions as Record<string, boolean>)[sectionKey]
      if (userPerm === true) return true
      if (userPerm === false) return false
    }
    
    return item.roles.includes(profile.role)
  })

  // Группируем по категориям
  const groups = (['main', 'operations', 'admin'] as const)
    .map(cat => ({
      key: cat,
      label: GROUP_LABELS[cat],
      items: filteredMenu.filter(i => i.category === cat),
    }))
    .filter(g => g.items.length > 0)

  return (
    <aside
      data-collapsed={collapsed}
      className={`hidden md:flex h-full shrink-0 select-none flex-col overflow-hidden border-r transition-[width,background-color,border-color] duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] ${
        collapsed
          ? 'border-[#11151c] bg-[#11151c] text-white'
          : 'border-[var(--border-primary)] bg-[var(--bg-sidebar)] text-[var(--text-primary)]'
      }`}
      style={{ width: collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)' }}
    >
      <div className={`flex h-20 shrink-0 items-center ${collapsed ? 'justify-center px-3' : 'justify-between px-5'}`}>
        {collapsed ? (
          <button
            onClick={toggleCollapsed}
            className="group relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white text-[#11151c] transition-[transform,background-color] duration-150 active:scale-[0.96]"
            title="Развернуть меню"
            aria-label="Развернуть меню"
          >
            <Image
              src="/logo.png"
              alt="Сулак CRM"
              width={40}
              height={40}
              className="h-full w-full object-cover transition-opacity duration-150 group-hover:opacity-15"
              onError={(event) => { event.currentTarget.style.display = 'none' }}
            />
            <PanelLeft className="absolute h-4.5 w-4.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
          </button>
        ) : (
          <>
            <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#11151c] text-xs font-bold text-white">
                <Image
                  src="/logo.png"
                  alt="Сулак CRM"
                  width={40}
                  height={40}
                  className="h-full w-full object-cover"
                  onError={(event) => { event.currentTarget.style.display = 'none' }}
                />
                <span className="absolute -z-10">S</span>
              </div>
              <span className="truncate text-[15px] font-semibold tracking-[-0.02em]">СУЛАК CRM</span>
            </Link>
            <button
              onClick={toggleCollapsed}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-tertiary)] transition-[transform,background-color,color] duration-150 hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] active:scale-[0.96]"
              title="Свернуть панель"
              aria-label="Свернуть панель"
            >
              <PanelLeftClose className="h-4.5 w-4.5" />
            </button>
          </>
        )}
      </div>

      <nav className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden ${collapsed ? 'space-y-3 px-2.5 pb-4' : 'space-y-5 px-3 pb-5'}`}>
        {groups.map((group, groupIndex) => (
          <div key={group.key} className="space-y-1">
            {!collapsed && (
              <div className="px-3 pb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                {group.label}
              </div>
            )}
            {collapsed && groupIndex > 0 && <div className="mx-2 mb-3 h-px bg-white/10" />}
            {group.items.map(item => {
              const Icon = item.icon
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.title : undefined}
                  aria-current={isActive ? 'page' : undefined}
                  className={`group flex items-center transition-[transform,background-color,color] duration-150 active:scale-[0.98] ${
                    collapsed
                      ? `mx-auto h-10 w-10 justify-center rounded-xl ${isActive ? 'bg-[var(--accent-primary)] text-white' : 'text-white/55 hover:bg-white/8 hover:text-white'}`
                      : `gap-3 rounded-xl px-3 py-2.5 text-[13px] ${isActive ? 'bg-[var(--accent-soft)] font-medium text-[var(--accent-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'}`
                  }`}
                >
                  <Icon className={`h-[17px] w-[17px] shrink-0 ${!collapsed && !isActive ? 'text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]' : ''}`} />
                  {!collapsed && <span className="truncate">{item.title}</span>}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div className={`shrink-0 ${collapsed ? 'border-t border-white/10 px-2.5 py-4' : 'border-t border-[var(--border-primary)] p-3'}`}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/8 text-xs font-semibold text-white">
              {profile.full_name.slice(0, 1).toUpperCase()}
            </div>
            <form action={logoutAction}>
              <button type="submit" className="flex h-8 w-8 items-center justify-center rounded-lg text-white/45 transition-[transform,background-color,color] duration-150 hover:bg-white/8 hover:text-white active:scale-[0.96]" title="Выйти из аккаунта">
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl px-2 py-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-primary)] text-xs font-semibold text-white">
              {profile.full_name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-[var(--text-primary)]">{profile.full_name}</p>
              <p className="mt-0.5 truncate text-[10px] text-[var(--text-tertiary)]">{profile.email}</p>
            </div>
            <form action={logoutAction}>
              <button type="submit" className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-[transform,background-color,color] duration-150 hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] active:scale-[0.96]" title="Выйти из аккаунта">
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}
      </div>
    </aside>
  )
}
