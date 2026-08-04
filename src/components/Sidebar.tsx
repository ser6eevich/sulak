'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
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
  ChevronRight,
  PanelLeftClose,
  PanelLeft
} from 'lucide-react'

interface SidebarProps {
  profile: {
    email: string
    full_name: string
    role: string
    permissions?: any
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
    if (saved === 'true') setCollapsed(true)
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
      className="hidden md:flex flex-col border-r border-[var(--border-primary)] bg-[var(--bg-sidebar)] select-none shrink-0 transition-[width] duration-200 ease-out overflow-x-hidden overflow-y-hidden"
      style={{ width: collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)' }}
    >
      {/* Логотип + кнопка свернуть/развернуть */}
      <div className={`flex h-13 items-center border-b border-[var(--border-primary)] ${collapsed ? 'justify-center px-1.5' : 'justify-between px-3 gap-2'}`}>
        {!collapsed ? (
          <>
            <Link 
              href="/" 
              className="flex items-center gap-2.5 font-medium text-[var(--text-primary)] tracking-tight min-w-0"
            >
              <div className="relative flex h-7 w-7 items-center justify-center rounded-md bg-[var(--accent-primary)] text-white text-[11px] font-bold shrink-0 overflow-hidden shadow-xs">
                <img 
                  src="/logo.png" 
                  alt="Сулак CRM" 
                  className="h-full w-full object-cover relative z-10"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
                <span className="absolute z-0">S</span>
              </div>
              <span className="text-xs font-bold tracking-wide text-[var(--text-primary)] truncate">
                СУЛАК CRM
              </span>
            </Link>
            <button
              onClick={toggleCollapsed}
              className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer shrink-0"
              title="Свернуть панель"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </>
        ) : (
          <button
            onClick={toggleCollapsed}
            className="group relative flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-primary)] text-white text-[11px] font-bold shrink-0 overflow-hidden hover:opacity-90 transition-all cursor-pointer shadow-xs"
            title="Развернуть меню"
          >
            <img 
              src="/logo.png" 
              alt="Сулак CRM" 
              className="h-full w-full object-cover relative z-10 group-hover:opacity-20 transition-opacity"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
            <span className="absolute z-0 group-hover:opacity-0 transition-opacity">S</span>
            <PanelLeft className="absolute z-20 h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        )}
      </div>

      {/* Навигация */}
      <nav className="flex-1 space-y-3 px-2 py-3 overflow-x-hidden overflow-y-auto">
        {groups.map(group => (
          <div key={group.key} className="space-y-0.5">
            {!collapsed && (
              <div className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
                {group.label}
              </div>
            )}
            {collapsed && (
              <div className="h-px bg-[var(--border-primary)] mx-1 my-1" />
            )}
            {group.items.map(item => {
              const Icon = item.icon
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.title : undefined}
                  className={`flex items-center gap-2 rounded-md transition-colors relative group ${
                    collapsed ? 'justify-center px-0 py-2' : 'px-2.5 py-1.5'
                  } ${
                    isActive
                      ? 'bg-[var(--accent-soft)] text-[var(--accent-text)] font-medium'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {/* Вертикальная полоска для активного пункта */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r bg-[var(--accent-primary)]" />
                  )}
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]'}`} />
                  {!collapsed && (
                    <>
                      <span className="truncate text-xs">{item.title}</span>
                      {isActive && <ChevronRight className="h-3 w-3 text-[var(--accent-primary)] shrink-0 opacity-60 ml-auto" />}
                    </>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Профиль внизу */}
      <div className="p-2 border-t border-[var(--border-primary)]">
        {collapsed ? (
          /* Свёрнутое состояние: только аватар + логаут */
          <div className="flex flex-col items-center gap-1.5">
            <div className="h-7 w-7 rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)] font-semibold text-[11px] flex items-center justify-center border border-[var(--accent-primary)]/20">
              {profile.full_name.slice(0, 1).toUpperCase()}
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--danger)] hover:bg-[var(--danger-soft)] transition-colors cursor-pointer"
                title="Выйти из аккаунта"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        ) : (
          /* Развёрнутое состояние: имя + email + логаут */
          <div className="flex items-center justify-between gap-2 p-2 rounded-md bg-[var(--bg-surface-secondary)] border border-[var(--border-primary)]">
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium text-[var(--text-primary)] truncate leading-tight">
                {profile.full_name}
              </span>
              <span className="text-[10px] text-[var(--text-tertiary)] truncate font-mono mt-0.5">
                {profile.email}
              </span>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--danger)] hover:bg-[var(--danger-soft)] transition-colors cursor-pointer"
                title="Выйти из аккаунта"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        )}
      </div>
    </aside>
  )
}
