'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logoutAction } from '@/app/login/actions'
import ThemeToggle from '@/components/ThemeToggle'
import PushNotificationManager from '@/components/PushNotificationManager'
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
  Settings,
  Menu,
  X,
  LayoutDashboard,
  Shield,
  ChevronRight
} from 'lucide-react'

interface MobileNavProps {
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

// Единый список пунктов с категориями — синхронизирован с Sidebar
const menuItems: MenuItem[] = [
  { title: 'Дашборд', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'owner'], category: 'main' },
  { title: 'Заказы', href: '/orders', icon: ShoppingCart, roles: ['admin', 'owner', 'manager', 'production', 'warehouse', 'logistician', 'driver'], category: 'operations' },
  { title: 'Каталог', href: '/catalog', icon: BookOpen, roles: ['admin', 'owner', 'manager', 'production', 'warehouse', 'logistician', 'driver'], category: 'main' },
  { title: 'Клиенты', href: '/clients', icon: Contact, roles: ['admin', 'owner', 'manager'], category: 'main' },
  { title: 'Производство', href: '/production/dashboard', icon: Hammer, roles: ['admin', 'owner', 'production'], category: 'operations' },
  { title: 'Склад', href: '/warehouse/dashboard', icon: Package, roles: ['warehouse', 'admin', 'owner', 'manager'], category: 'operations' },
  { title: 'Логистика', href: '/logistician/dashboard', icon: Truck, roles: ['logistician', 'admin', 'owner', 'manager'], category: 'operations' },
  { title: 'Водители', href: '/drivers', icon: Contact, roles: ['logistician', 'admin', 'owner', 'manager'], category: 'operations' },
  { title: 'Зарплата', href: '/payroll', icon: DollarSign, roles: ['admin', 'owner'], category: 'admin' },
  { title: 'Менеджеры', href: '/managers', icon: Users, roles: ['admin', 'owner'], category: 'admin' },
  { title: 'Настройки', href: '/settings', icon: Settings, roles: ['admin', 'owner'], category: 'admin' },
]

const ROLE_NAMES: Record<string, string> = {
  admin: 'Администратор',
  owner: 'Владелец',
  manager: 'Менеджер',
  production: 'Производство',
  warehouse: 'Склад',
  logistician: 'Логист',
  driver: 'Водитель',
}

const GROUP_LABELS: Record<string, string> = {
  main: 'Основное',
  operations: 'Операции',
  admin: 'Управление',
}

export default function MobileNav({ profile }: MobileNavProps) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Фильтрация по ролям/разрешениям
  const filteredMenu = menuItems.filter(item => {
    const sectionKey = item.href.replace('/', '').split('/')[0] || 'dashboard'
    
    if (profile.permissions && typeof profile.permissions === 'object') {
      const userPerm = (profile.permissions as Record<string, boolean>)[sectionKey]
      if (userPerm === true) return true
      if (userPerm === false) return false
    }
    
    return item.roles.includes(profile.role)
  })

  // 4 вкладки на нижней панели + кнопка «Ещё»
  const mainTabs = filteredMenu.slice(0, 4)

  // Группировка для drawer
  const groups = (['main', 'operations', 'admin'] as const)
    .map(cat => ({
      key: cat,
      label: GROUP_LABELS[cat],
      items: filteredMenu.filter(i => i.category === cat),
    }))
    .filter(g => g.items.length > 0)

  return (
    <>
      {/* ── Нижняя фиксированная навигационная панель ── */}
      <nav className="md:hidden flex h-14 pb-[env(safe-area-inset-bottom)] box-content border-t border-[var(--border-primary)] bg-[var(--bg-header)] backdrop-blur-md px-1 select-none shrink-0 relative z-40">
        <div className="flex w-full items-center justify-around">
          {mainTabs.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center flex-1 h-full min-h-[44px] transition-colors ${
                  isActive 
                    ? 'text-[var(--accent-primary)] font-medium' 
                    : 'text-[var(--text-tertiary)] active:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="h-[18px] w-[18px]" />
                <span className="text-[10px] mt-0.5 truncate max-w-full px-1">
                  {item.title}
                </span>
              </Link>
            )
          })}

          {/* Кнопка «Ещё» — открывает полное мобильное меню */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            onTouchEnd={(e) => {
              e.preventDefault()
              setDrawerOpen(true)
            }}
            className={`flex flex-col items-center justify-center flex-1 h-full min-h-[44px] transition-colors cursor-pointer touch-manipulation ${
              drawerOpen ? 'text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)] active:text-[var(--text-primary)]'
            }`}
          >
            <Menu className="h-[18px] w-[18px]" />
            <span className="text-[10px] mt-0.5 font-medium">Ещё</span>
          </button>
        </div>
      </nav>

      {/* ── Мобильный Drawer (Bottom Sheet) ── */}
      {drawerOpen && (
        <div 
          className="md:hidden fixed inset-0 z-[100] flex flex-col"
          onClick={(e) => {
            // Закрываем при клике на оверлей (фон)
            if (e.target === e.currentTarget) setDrawerOpen(false)
          }}
        >
          {/* Затемнение фона */}
          <div 
            className="flex-1 bg-[var(--bg-overlay)] backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          
          {/* Сам drawer — поднимается снизу */}
          <div 
            className="bg-[var(--bg-surface)] border-t border-[var(--border-primary)] rounded-t-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            style={{ animation: 'erp-slide-up 0.2s ease-out' }}
          >
            {/* Шапка Drawer */}
            <div className="p-4 border-b border-[var(--border-primary)] flex items-center justify-between bg-[var(--bg-table-header)]">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-[var(--accent-soft)] text-[var(--accent-primary)] flex items-center justify-center font-bold text-xs uppercase border border-[var(--accent-primary)]/20">
                  {profile.full_name?.charAt(0) || 'U'}
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                    {profile.full_name}
                  </h3>
                  <p className="text-[10px] text-[var(--text-tertiary)] flex items-center gap-1 font-mono">
                    <Shield className="h-3 w-3 text-[var(--accent-primary)]" />
                    {ROLE_NAMES[profile.role] || profile.role}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <PushNotificationManager />
                <ThemeToggle />
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-2 rounded-full text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Группированный список разделов */}
            <div className="p-2 overflow-y-auto flex-1">
              {groups.map((group, gi) => (
                <div key={group.key} className={gi > 0 ? 'mt-2' : ''}>
                  <p className="px-3 py-1.5 text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                    {group.label}
                  </p>
                  {group.items.map(item => {
                    const Icon = item.icon
                    const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setDrawerOpen(false)}
                        className={`flex items-center justify-between px-3 py-3 rounded-lg text-xs transition-colors my-0.5 cursor-pointer ${
                          isActive
                            ? 'bg-[var(--accent-soft)] text-[var(--accent-text)] font-semibold'
                            : 'text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] font-normal'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={`h-4 w-4 ${isActive ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'}`} />
                          <span>{item.title}</span>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                      </Link>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Кнопка Выхода */}
            <div className="p-3 border-t border-[var(--border-primary)] bg-[var(--bg-table-header)]">
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[var(--danger-soft)] text-[var(--danger)] border border-[var(--danger)]/20 text-xs font-medium hover:bg-[var(--danger)] hover:text-white transition-colors cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Выйти из аккаунта</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
