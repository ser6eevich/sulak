'use client'

import React, { useEffect, useMemo, useState, useTransition, type ComponentType, type FormEvent, type ReactNode } from 'react'
import {
  AlertCircle,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  ExternalLink,
  Eye,
  EyeOff,
  Folder,
  KeyRound,
  Link2,
  Lock,
  Mail,
  MessageSquare,
  Plus,
  RefreshCw,
  Save,
  Send,
  Shield,
  Star,
  Unlock,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import {
  saveAvitoSettingsAction,
  saveTelegramSettingsAction,
  saveYandexDiskSettingsAction,
  sendLatestReviewPerAccountAction,
  testTelegramNotificationAction,
  type AvitoAccountInput,
} from './actions'
import { saveAmoCrmCredentialsAction } from '@/app/(dashboard)/analytics/daily-report/actions'
import {
  createUserAction,
  resetUserPasswordAction,
  toggleUserStatusAction,
  updateUserPermissionsAction,
  updateUserRoleAction,
} from '@/app/(dashboard)/dashboard/actions'

interface Profile {
  id: string
  email: string
  fullName: string
  role: string
  isActive: boolean
  permissions: Record<string, boolean> | null
  telegramUsername?: string | null
}

interface SettingsClientProps {
  initialChatId: string
  initialBotToken: string
  initialOwnerTag?: string
  initialWarehouseTag?: string
  initialThresholds?: Record<string, number>
  initialTopics?: Record<string, string>
  initialSiteUrl?: string
  initialAmoSettings?: {
    subdomain: string
    clientId: string
    clientSecret: string
    accessToken: string
    refreshToken: string
    isConnected: boolean
  }
  initialAvitoAccounts?: AvitoAccountInput[]
  initialYandexDiskPublicUrl?: string
  initialYandexDiskToken?: string
  initialNotifyFlags?: { new_order?: boolean; delivered?: boolean; cancelled?: boolean; reviews?: boolean }
  initialUsers?: Profile[]
  currentUserId?: string
}

type TabId = 'telegram' | 'memo' | 'amocrm' | 'avito' | 'yandex' | 'team'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Администратор',
  owner: 'Владелец',
  manager: 'Менеджер',
  production: 'Производство',
  warehouse: 'Склад',
  logistician: 'Логист',
  driver: 'Водитель',
}

const SECTIONS = [
  { id: 'dashboard', label: 'Обзор платформы' },
  { id: 'catalog', label: 'Каталог' },
  { id: 'clients', label: 'База клиентов' },
  { id: 'orders', label: 'Заказы' },
  { id: 'production', label: 'Цех производства' },
  { id: 'warehouse', label: 'Склад' },
  { id: 'logistician', label: 'Логистика' },
  { id: 'drivers', label: 'Экипажи водителей' },
  { id: 'payroll', label: 'Расчёт зарплаты' },
  { id: 'managers', label: 'Команда менеджеров' },
]

const STATUS_THRESHOLD_CONFIG = [
  { key: 'pending', label: 'Ожидает подтверждения', defaultHours: 24, desc: 'Заказ ещё не обработан' },
  { key: 'confirmed', label: 'Подтверждён', defaultHours: 48, desc: 'Ждёт передачи дальше' },
  { key: 'production', label: 'В производстве', defaultHours: 96, desc: 'Находится в цехе' },
  { key: 'warehouse', label: 'На складе', defaultHours: 48, desc: 'Готов к отгрузке' },
  { key: 'delivery', label: 'Ожидает доставку', defaultHours: 48, desc: 'Готовится в путь' },
]

const inputClass = 'erp-input w-full text-xs'
const labelClass = 'mb-1.5 block text-[11px] font-semibold text-[var(--text-primary)]'

function StatusBadge({ ready, readyLabel = 'Настроено', emptyLabel = 'Требует настройки' }: { ready: boolean; readyLabel?: string; emptyLabel?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold ${ready ? 'border-[var(--success)]/20 bg-[var(--success-soft)] text-[var(--success)]' : 'border-[var(--warning)]/20 bg-[var(--warning-soft)] text-[var(--warning)]'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${ready ? 'bg-[var(--success)]' : 'bg-[var(--warning)]'}`} />
      {ready ? readyLabel : emptyLabel}
    </span>
  )
}

function PanelHeader({ icon: Icon, title, description, trailing }: { icon: ComponentType<{ className?: string; strokeWidth?: number }>; title: string; description: string; trailing?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-[var(--border-primary)] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-primary)]">
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
          <p className="mt-0.5 text-[11px] leading-5 text-[var(--text-secondary)]">{description}</p>
        </div>
      </div>
      {trailing}
    </div>
  )
}

function Feedback({ tone, children }: { tone: 'success' | 'danger'; children: ReactNode }) {
  const Icon = tone === 'success' ? CheckCircle2 : AlertCircle
  return (
    <div className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${tone === 'success' ? 'border-[var(--success)]/20 bg-[var(--success-soft)] text-[var(--success)]' : 'border-[var(--danger)]/20 bg-[var(--danger-soft)] text-[var(--danger)]'}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center overflow-hidden rounded-full border shadow-inner outline-none transition-[background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-surface)] ${checked ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]' : 'border-[var(--border-strong)] bg-[var(--bg-surface-active)]'}`}
    >
      <span
        className="pointer-events-none absolute left-px top-1/2 h-4 w-4 rounded-full border border-black/5 bg-white shadow-sm transition-transform duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)]"
        style={{ transform: `translate(${checked ? '16px' : '0'}, -50%)` }}
      />
    </button>
  )
}

export default function SettingsClient({
  initialChatId,
  initialBotToken,
  initialOwnerTag = '',
  initialWarehouseTag = '',
  initialThresholds = {},
  initialTopics = {},
  initialSiteUrl = '',
  initialAmoSettings,
  initialAvitoAccounts,
  initialYandexDiskPublicUrl = '',
  initialYandexDiskToken = '',
  initialNotifyFlags,
  initialUsers = [],
  currentUserId = '',
}: SettingsClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>('telegram')
  const [notifyFlags, setNotifyFlags] = useState({
    new_order: initialNotifyFlags?.new_order ?? true,
    delivered: initialNotifyFlags?.delivered ?? true,
    cancelled: initialNotifyFlags?.cancelled ?? true,
    reviews: initialNotifyFlags?.reviews ?? true,
  })
  const [chatId, setChatId] = useState(initialChatId)
  const [botToken, setBotToken] = useState(initialBotToken)
  const [ownerTag, setOwnerTag] = useState(initialOwnerTag)
  const [warehouseTag, setWarehouseTag] = useState(initialWarehouseTag)
  const [siteUrl, setSiteUrl] = useState(initialSiteUrl)
  const [thresholds, setThresholds] = useState<Record<string, number>>({
    pending: initialThresholds.pending || 24,
    confirmed: initialThresholds.confirmed || 48,
    production: initialThresholds.production || 96,
    warehouse: initialThresholds.warehouse || 48,
    delivery: initialThresholds.delivery || 48,
  })
  const topics: Record<string, string> = {
    new_orders: initialTopics?.new_orders || '',
    production: initialTopics?.production || '',
    warehouse: initialTopics?.warehouse || '',
    logistics: initialTopics?.logistics || '',
    delivered: initialTopics?.delivered || '',
    cancelled: initialTopics?.cancelled || '',
    general: initialTopics?.general || '',
  }
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('')
  const [saveErrorMsg, setSaveErrorMsg] = useState('')
  const [testSuccessMsg, setTestSuccessMsg] = useState('')
  const [testErrorMsg, setTestErrorMsg] = useState('')

  const [amoSubdomain, setAmoSubdomain] = useState(initialAmoSettings?.subdomain || '')
  const [amoClientId, setAmoClientId] = useState(initialAmoSettings?.clientId || '')
  const [amoClientSecret, setAmoClientSecret] = useState(initialAmoSettings?.clientSecret || '')
  const [amoAccessToken, setAmoAccessToken] = useState(initialAmoSettings?.accessToken || '')
  const [amoRefreshToken, setAmoRefreshToken] = useState(initialAmoSettings?.refreshToken || '')
  const [amoSaveMsg, setAmoSaveMsg] = useState('')
  const [amoSaveLoading, setAmoSaveLoading] = useState(false)

  const [avitoAccounts, setAvitoAccounts] = useState<AvitoAccountInput[]>(
    initialAvitoAccounts?.length === 7
      ? initialAvitoAccounts
      : Array.from({ length: 7 }, () => ({ name: '', clientId: '', clientSecret: '' }))
  )
  const [avitoSaveMsg, setAvitoSaveMsg] = useState('')
  const [avitoSaveLoading, setAvitoSaveLoading] = useState(false)
  const [avitoTestMsg, setAvitoTestMsg] = useState('')
  const [avitoTestLoading, setAvitoTestLoading] = useState(false)

  const [yandexDiskPublicUrl, setYandexDiskPublicUrl] = useState(initialYandexDiskPublicUrl)
  const [yandexDiskToken, setYandexDiskToken] = useState(initialYandexDiskToken)
  const [yandexSaveMsg, setYandexSaveMsg] = useState('')
  const [yandexSaveLoading, setYandexSaveLoading] = useState(false)

  const [users, setUsers] = useState<Profile[]>(initialUsers)
  const [isPending, startTransition] = useTransition()
  const [expandedUserPerms, setExpandedUserPerms] = useState<Record<string, boolean>>({})
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newFullName, setNewFullName] = useState('')
  const [newRole, setNewRole] = useState('manager')
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [userModalError, setUserModalError] = useState('')
  const [userModalSuccess, setUserModalSuccess] = useState('')
  const [userModalLoading, setUserModalLoading] = useState(false)
  const [resetPasswordUser, setResetPasswordUser] = useState<Profile | null>(null)
  const [tempPassword, setTempPassword] = useState('')
  const [resetPasswordMsg, setResetPasswordMsg] = useState('')

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setIsCreateUserModalOpen(false)
      setResetPasswordUser(null)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const configuredAvito = useMemo(() => avitoAccounts.filter(account => account.name || account.clientId).length, [avitoAccounts])
  const activeUsers = users.filter(user => user.isActive).length
  const navigation: { id: TabId; label: string; description: string; icon: ComponentType<{ className?: string; strokeWidth?: number }>; status?: string }[] = [
    { id: 'telegram', label: 'Telegram', description: 'Бот и контроль заказов', icon: Bot, status: chatId ? 'Настроен' : 'Не настроен' },
    { id: 'memo', label: 'Уведомления', description: 'Памятка по событиям', icon: BookOpen },
    { id: 'amocrm', label: 'amoCRM', description: 'Аналитика продаж', icon: BarChart3, status: initialAmoSettings?.isConnected ? 'Подключено' : 'Не настроено' },
    { id: 'avito', label: 'Авито', description: 'Мониторинг отзывов', icon: Star, status: configuredAvito ? `${configuredAvito} из 7` : 'Не настроено' },
    { id: 'yandex', label: 'Яндекс.Диск', description: 'Галерея склада', icon: Folder, status: yandexDiskPublicUrl ? 'Подключено' : 'Не настроено' },
    { id: 'team', label: 'Команда', description: 'Роли и доступы', icon: Users, status: `${activeUsers} активных` },
  ]

  const handleThresholdChange = (key: string, value: string) => {
    const parsed = Number.parseInt(value, 10)
    setThresholds(previous => ({ ...previous, [key]: Number.isNaN(parsed) || parsed < 1 ? 1 : parsed }))
  }

  const handleTelegramSave = async (event: FormEvent) => {
    event.preventDefault()
    setSaveSuccessMsg('')
    setSaveErrorMsg('')
    setSaving(true)
    const result = await saveTelegramSettingsAction(chatId, botToken, ownerTag, warehouseTag, thresholds, topics, siteUrl, notifyFlags)
    setSaving(false)
    if (result.error) setSaveErrorMsg(result.error)
    else {
      setSaveSuccessMsg('Настройки Telegram и контроля заказов сохранены')
      setTimeout(() => setSaveSuccessMsg(''), 4000)
    }
  }

  const handleTelegramTest = async () => {
    setTestSuccessMsg('')
    setTestErrorMsg('')
    setTesting(true)
    const result = await testTelegramNotificationAction(chatId, botToken)
    setTesting(false)
    if (result.error) setTestErrorMsg(result.error)
    else if (result.message) {
      setTestSuccessMsg(result.message)
      setTimeout(() => setTestSuccessMsg(''), 5000)
    }
  }

  const handleCreateUser = async (event: FormEvent) => {
    event.preventDefault()
    setUserModalError('')
    setUserModalSuccess('')
    if (!newEmail || !newFullName || !newPassword) {
      setUserModalError('Заполните все обязательные поля')
      return
    }
    setUserModalLoading(true)
    const result = await createUserAction({ email: newEmail, fullName: newFullName, role: newRole, passwordStr: newPassword })
    setUserModalLoading(false)
    if (result.error) setUserModalError(result.error)
    else if (result.profile) {
      setUserModalSuccess(`Сотрудник ${result.profile.fullName} создан`)
      setUsers(previous => [...previous, result.profile as Profile])
      setTimeout(() => {
        setIsCreateUserModalOpen(false)
        setNewEmail('')
        setNewFullName('')
        setNewPassword('')
        setUserModalSuccess('')
      }, 1500)
    }
  }

  const handleRoleChange = (userId: string, role: string) => {
    startTransition(async () => {
      const result = await updateUserRoleAction(userId, role)
      if (result.profile) setUsers(previous => previous.map(user => user.id === userId ? { ...user, role: result.profile.role } : user))
    })
  }

  const handlePermissionToggle = (userId: string, sectionId: string, hasAccess: boolean) => {
    const target = users.find(user => user.id === userId)
    if (!target) return
    const permissions = target.permissions && typeof target.permissions === 'object' ? { ...target.permissions } : {}
    permissions[sectionId] = !hasAccess
    startTransition(async () => {
      const result = await updateUserPermissionsAction(userId, permissions)
      if (result.profile) setUsers(previous => previous.map(user => user.id === userId ? { ...user, permissions: result.profile.permissions } : user))
    })
  }

  const handleToggleStatus = (userId: string, isActive: boolean) => {
    startTransition(async () => {
      const result = await toggleUserStatusAction(userId, !isActive)
      if (result.profile) setUsers(previous => previous.map(user => user.id === userId ? { ...user, isActive: result.profile.isActive } : user))
    })
  }

  const handleResetPassword = async (event: FormEvent) => {
    event.preventDefault()
    if (!resetPasswordUser || !tempPassword) return
    setResetPasswordMsg('')
    startTransition(async () => {
      const result = await resetUserPasswordAction(resetPasswordUser.id, tempPassword)
      if (result.error) setResetPasswordMsg(`Ошибка: ${result.error}`)
      else {
        setResetPasswordMsg('Временный пароль установлен')
        setTimeout(() => {
          setResetPasswordUser(null)
          setTempPassword('')
          setResetPasswordMsg('')
        }, 1800)
      }
    })
  }

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start">
        <nav aria-label="Разделы настроек" className="flex gap-2 overflow-x-auto rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] p-2 shadow-xs [scrollbar-width:none] lg:flex-col lg:gap-1 [&::-webkit-scrollbar]:hidden">
          {navigation.map(item => {
            const Icon = item.icon
            const selected = activeTab === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex min-w-[172px] items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors lg:min-w-0 ${selected ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'}`}
              >
                <Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={1.8} />
                <span className="min-w-0 flex-1">
                  <span className="block whitespace-nowrap text-xs font-semibold">{item.label}</span>
                  <span className="mt-0.5 block whitespace-nowrap text-[10px] text-[var(--text-tertiary)]">{item.description}</span>
                </span>
                {item.status && <span className="hidden whitespace-nowrap text-[9px] font-medium text-[var(--text-tertiary)] xl:block">{item.status}</span>}
              </button>
            )
          })}
        </nav>
      </aside>

      <main className="min-w-0">
        {activeTab === 'telegram' && (
          <section className="overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] shadow-xs">
            <PanelHeader icon={Bot} title="Telegram и контроль заказов" description="Подключение бота, правила уведомлений и пороги простоя" trailing={<StatusBadge ready={Boolean(chatId)} />} />
            <form onSubmit={handleTelegramSave} className="space-y-5 p-4">
              {(saveSuccessMsg || testSuccessMsg) && <Feedback tone="success">{saveSuccessMsg || testSuccessMsg}</Feedback>}
              {(saveErrorMsg || testErrorMsg) && <Feedback tone="danger">{saveErrorMsg || testErrorMsg}</Feedback>}

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-[var(--accent-primary)]" />
                  <h3 className="text-xs font-semibold text-[var(--text-primary)]">Подключение</h3>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label>
                    <span className={labelClass}>ID чата Telegram *</span>
                    <input required value={chatId} onChange={event => setChatId(event.target.value)} placeholder="1803301964 или -100123456789" className={`${inputClass} font-mono`} />
                  </label>
                  <label>
                    <span className={labelClass}>Новый токен бота</span>
                    <input type="password" value={botToken} onChange={event => setBotToken(event.target.value)} placeholder="Введите токен от BotFather" className={`${inputClass} font-mono`} />
                  </label>
                  <label className="md:col-span-2">
                    <span className={labelClass}>URL сайта / CRM</span>
                    <input value={siteUrl} onChange={event => setSiteUrl(event.target.value)} placeholder="https://sulak-crm.ru" className={`${inputClass} font-mono`} />
                    <span className="mt-1.5 block text-[10px] text-[var(--text-tertiary)]">Используется в кнопке перехода к заказу из Telegram.</span>
                  </label>
                </div>
              </div>

              <div className="grid gap-5 border-t border-[var(--border-primary)] pt-5 xl:grid-cols-2">
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4 text-[var(--accent-primary)]" />
                    <h3 className="text-xs font-semibold text-[var(--text-primary)]">Ответственные</h3>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label>
                      <span className={labelClass}>Руководитель</span>
                      <input value={ownerTag} onChange={event => setOwnerTag(event.target.value)} placeholder="@username" className={`${inputClass} font-mono`} />
                    </label>
                    <label>
                      <span className={labelClass}>Сотрудник склада</span>
                      <input value={warehouseTag} onChange={event => setWarehouseTag(event.target.value)} placeholder="@username" className={`${inputClass} font-mono`} />
                    </label>
                  </div>
                </div>
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <Bell className="h-4 w-4 text-[var(--accent-primary)]" />
                    <h3 className="text-xs font-semibold text-[var(--text-primary)]">События</h3>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      { key: 'new_order', label: 'Новые заказы', note: '#новый_заказ' },
                      { key: 'delivered', label: 'Доставленные', note: '#доставлен' },
                      { key: 'cancelled', label: 'Отменённые', note: '#отмена' },
                      { key: 'reviews', label: 'Отзывы Авито', note: 'Новые отзывы' },
                    ].map(item => (
                      <div key={item.key} className="flex min-h-14 items-center justify-between gap-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface-secondary)] px-3 py-2">
                        <div className="min-w-0">
                          <p className="whitespace-nowrap text-[11px] font-semibold text-[var(--text-primary)]">{item.label}</p>
                          <p className="mt-0.5 whitespace-nowrap text-[9px] text-[var(--text-tertiary)]">{item.note}</p>
                        </div>
                        <Toggle checked={notifyFlags[item.key as keyof typeof notifyFlags]} onChange={checked => setNotifyFlags(previous => ({ ...previous, [item.key]: checked }))} label={item.label} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-[var(--border-primary)] pt-5">
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Clock3 className="h-4 w-4 text-[var(--accent-primary)]" />
                      <h3 className="text-xs font-semibold text-[var(--text-primary)]">Пороги простоя</h3>
                    </div>
                    <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Бот сообщит, если заказ не двигается дольше заданного времени.</p>
                  </div>
                  <span className="whitespace-nowrap text-[10px] text-[var(--text-tertiary)]">Значения в часах</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                  {STATUS_THRESHOLD_CONFIG.map(item => {
                    const value = thresholds[item.key] ?? item.defaultHours
                    return (
                      <label key={item.key} className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface-secondary)] p-3">
                        <span className="block min-h-8 text-[10px] font-semibold leading-4 text-[var(--text-primary)]">{item.label}</span>
                        <span className="mb-2 block whitespace-nowrap text-[9px] text-[var(--text-tertiary)]">{item.desc}</span>
                        <span className="flex items-center gap-2">
                          <input type="number" min={1} max={720} value={value} onChange={event => handleThresholdChange(item.key, event.target.value)} className="erp-input w-full min-w-0 text-center font-mono text-xs font-semibold" />
                          <span className="text-[10px] text-[var(--text-secondary)]">ч.</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-[var(--border-primary)] pt-4 sm:flex-row sm:items-center sm:justify-between">
                <button type="button" onClick={handleTelegramTest} disabled={testing || !chatId || !botToken} className="erp-button-secondary inline-flex items-center justify-center gap-2 whitespace-nowrap text-xs disabled:opacity-50">
                  {testing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  {testing ? 'Проверяем отправку' : 'Проверить Telegram'}
                </button>
                <button type="submit" disabled={saving} className="erp-button-primary inline-flex items-center justify-center gap-2 whitespace-nowrap text-xs disabled:opacity-50">
                  {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  {saving ? 'Сохраняем' : 'Сохранить изменения'}
                </button>
              </div>
            </form>
          </section>
        )}

        {activeTab === 'memo' && (
          <section className="overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] shadow-xs">
            <PanelHeader icon={BookOpen} title="Памятка по уведомлениям" description="Когда система отправляет сообщения и что в них входит" />
            <div className="grid gap-3 p-4 lg:grid-cols-3">
              {[
                { icon: MessageSquare, title: 'Новый заказ', trigger: 'Сразу после оформления менеджером', items: ['Клиент и телефоны', 'Состав заказа и цены', 'Фотографии и ответственные'] },
                { icon: CheckCircle2, title: 'Заказ доставлен', trigger: 'При переводе в статус «Доставлен»', items: ['Подтверждение доставки', 'Упоминание продавца', 'Напоминание запросить отзыв'] },
                { icon: Clock3, title: 'Простой заказа', trigger: 'После превышения порога статуса', items: ['Ответственные сотрудники', 'Текущий статус заказа', 'Один алерт на статус'] },
              ].map((item, index) => (
                <article key={item.title} className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface-secondary)] p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-primary)]"><item.icon className="h-[18px] w-[18px]" /></span>
                    <span className="text-[10px] font-semibold text-[var(--text-tertiary)]">0{index + 1}</span>
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-[var(--text-primary)]">{item.title}</h3>
                  <p className="mt-1 min-h-10 text-[11px] leading-5 text-[var(--text-secondary)]">{item.trigger}</p>
                  <ul className="mt-4 space-y-2 border-t border-[var(--border-primary)] pt-3">
                    {item.items.map(text => <li key={text} className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)]"><Check className="h-3 w-3 text-[var(--success)]" />{text}</li>)}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'amocrm' && (
          <section className="overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] shadow-xs">
            <PanelHeader icon={BarChart3} title="Интеграция с amoCRM" description="OAuth2-доступ для аналитики и дневных отчётов" trailing={<StatusBadge ready={Boolean(initialAmoSettings?.isConnected)} readyLabel="Подключено" />} />
            <form onSubmit={async event => {
              event.preventDefault()
              setAmoSaveLoading(true)
              setAmoSaveMsg('')
              const result = await saveAmoCrmCredentialsAction({ subdomain: amoSubdomain, clientId: amoClientId, clientSecret: amoClientSecret, accessToken: amoAccessToken, refreshToken: amoRefreshToken })
              setAmoSaveLoading(false)
              if (result.error) setAmoSaveMsg(`Ошибка: ${result.error}`)
              else if ('warning' in result && result.warning) setAmoSaveMsg(`Предупреждение: ${result.warning}`)
              else setAmoSaveMsg('Настройки amoCRM сохранены и проверены')
            }} className="space-y-5 p-4">
              {amoSaveMsg && <Feedback tone={amoSaveMsg.startsWith('Ошибка') ? 'danger' : 'success'}>{amoSaveMsg}</Feedback>}
              <div className="grid gap-4 md:grid-cols-2">
                <label><span className={labelClass}>Поддомен *</span><input required value={amoSubdomain} onChange={event => setAmoSubdomain(event.target.value)} placeholder="mycompany" className={`${inputClass} font-mono`} /><span className="mt-1 block text-[10px] text-[var(--text-tertiary)]">Без .amocrm.ru</span></label>
                <label><span className={labelClass}>Client ID *</span><input required value={amoClientId} onChange={event => setAmoClientId(event.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className={`${inputClass} font-mono`} /><span className="mt-1 block text-[10px] text-[var(--text-tertiary)]">ID созданной интеграции</span></label>
                <label><span className={labelClass}>Новый Client Secret *</span><input required type="password" value={amoClientSecret} onChange={event => setAmoClientSecret(event.target.value)} placeholder="Введите секрет интеграции" className={`${inputClass} font-mono`} /></label>
                <label><span className={labelClass}>Новый Access Token *</span><input required type="password" value={amoAccessToken} onChange={event => setAmoAccessToken(event.target.value)} placeholder="Введите токен доступа" className={`${inputClass} font-mono`} /></label>
                <label className="md:col-span-2"><span className={labelClass}>Новый Refresh Token</span><input type="password" value={amoRefreshToken} onChange={event => setAmoRefreshToken(event.target.value)} placeholder="Введите токен обновления" className={`${inputClass} font-mono`} /><span className="mt-1 block text-[10px] text-[var(--text-tertiary)]">Нужен для автоматического продления доступа.</span></label>
              </div>
              <div className="flex justify-end border-t border-[var(--border-primary)] pt-4">
                <button type="submit" disabled={amoSaveLoading} className="erp-button-primary inline-flex items-center gap-2 whitespace-nowrap text-xs disabled:opacity-50">{amoSaveLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}{amoSaveLoading ? 'Сохраняем' : 'Сохранить amoCRM'}</button>
              </div>
            </form>
          </section>
        )}

        {activeTab === 'avito' && (
          <section className="overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] shadow-xs">
            <PanelHeader icon={Star} title="Отзывы Авито" description="До семи аккаунтов для мониторинга новых отзывов" trailing={<StatusBadge ready={configuredAvito > 0} readyLabel={`${configuredAvito} из 7 настроено`} />} />
            <form onSubmit={async event => {
              event.preventDefault()
              setAvitoSaveLoading(true)
              setAvitoSaveMsg('')
              const result = await saveAvitoSettingsAction(avitoAccounts)
              setAvitoSaveLoading(false)
              setAvitoSaveMsg(result.error ? `Ошибка: ${result.error}` : 'Настройки Авито сохранены')
            }} className="space-y-4 p-4">
              {avitoSaveMsg && <Feedback tone={avitoSaveMsg.startsWith('Ошибка') ? 'danger' : 'success'}>{avitoSaveMsg}</Feedback>}
              {avitoTestMsg && <Feedback tone={avitoTestMsg.startsWith('Ошибка') ? 'danger' : 'success'}>{avitoTestMsg}</Feedback>}
              <div className="flex flex-col gap-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface-secondary)] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[var(--text-primary)]">Проверка подключения</p>
                  <p className="mt-1 text-[10px] leading-4 text-[var(--text-secondary)]">Получить по одному последнему отзыву и отправить их в Telegram.</p>
                </div>
                <button type="button" disabled={avitoTestLoading || configuredAvito === 0} onClick={async () => {
                  setAvitoTestLoading(true)
                  setAvitoTestMsg('')
                  const result = await sendLatestReviewPerAccountAction(avitoAccounts)
                  setAvitoTestLoading(false)
                  setAvitoTestMsg(result.error ? `Ошибка: ${result.error}` : result.message || 'Отзывы отправлены в Telegram')
                }} className="erp-button-secondary inline-flex items-center justify-center gap-2 whitespace-nowrap text-xs disabled:opacity-50">{avitoTestLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}{avitoTestLoading ? 'Получаем отзывы' : 'Проверить отзывы'}</button>
              </div>
              <div className="grid gap-3 xl:grid-cols-2">
                {avitoAccounts.map((account, index) => (
                  <div key={index} className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface-secondary)] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-semibold text-[var(--text-primary)]">Аккаунт {index + 1}</p>
                      <StatusBadge ready={Boolean(account.name || account.clientId)} readyLabel="Заполнен" emptyLabel="Свободен" />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="sm:col-span-2"><span className={labelClass}>Название</span><input value={account.name} onChange={event => setAvitoAccounts(previous => previous.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} placeholder="Например: Основной аккаунт" className={inputClass} /></label>
                      <label><span className={labelClass}>Client ID</span><input value={account.clientId} onChange={event => setAvitoAccounts(previous => previous.map((item, itemIndex) => itemIndex === index ? { ...item, clientId: event.target.value } : item))} placeholder="Client ID" className={`${inputClass} font-mono`} /></label>
                      <label><span className={labelClass}>Новый Client Secret</span><input type="password" value={account.clientSecret} onChange={event => setAvitoAccounts(previous => previous.map((item, itemIndex) => itemIndex === index ? { ...item, clientSecret: event.target.value } : item))} placeholder="Введите секрет" className={`${inputClass} font-mono`} /></label>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end border-t border-[var(--border-primary)] pt-4"><button type="submit" disabled={avitoSaveLoading} className="erp-button-primary inline-flex items-center gap-2 whitespace-nowrap text-xs disabled:opacity-50">{avitoSaveLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}{avitoSaveLoading ? 'Сохраняем' : 'Сохранить Авито'}</button></div>
            </form>
          </section>
        )}

        {activeTab === 'yandex' && (
          <section className="overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] shadow-xs">
            <PanelHeader icon={Folder} title="Яндекс.Диск" description="Общая галерея фотографий склада для оформления заказов" trailing={<StatusBadge ready={Boolean(yandexDiskPublicUrl)} readyLabel="Подключено" />} />
            <form onSubmit={async event => {
              event.preventDefault()
              setYandexSaveLoading(true)
              setYandexSaveMsg('')
              const result = await saveYandexDiskSettingsAction(yandexDiskPublicUrl, yandexDiskToken)
              setYandexSaveLoading(false)
              setYandexSaveMsg(result.error ? `Ошибка: ${result.error}` : 'Настройки Яндекс.Диска сохранены')
            }} className="space-y-5 p-4">
              {yandexSaveMsg && <Feedback tone={yandexSaveMsg.startsWith('Ошибка') ? 'danger' : 'success'}>{yandexSaveMsg}</Feedback>}
              <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface-secondary)] p-4">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-primary)]"><ExternalLink className="h-[18px] w-[18px]" /></div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Галерея склада</h3>
                <p className="mt-1 max-w-2xl text-[11px] leading-5 text-[var(--text-secondary)]">Менеджеры смогут открывать общую папку с фотографиями столов и стульев прямо из формы заказа.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label><span className={labelClass}>Публичная ссылка на папку</span><input type="url" value={yandexDiskPublicUrl} onChange={event => setYandexDiskPublicUrl(event.target.value)} placeholder="https://disk.yandex.ru/d/..." className={`${inputClass} font-mono`} /><span className="mt-1 block text-[10px] text-[var(--text-tertiary)]">Рекомендуемый способ подключения</span></label>
                <label><span className={labelClass}>Новый OAuth-токен</span><input type="password" value={yandexDiskToken} onChange={event => setYandexDiskToken(event.target.value)} placeholder="Только для закрытой папки" className={`${inputClass} font-mono`} /><span className="mt-1 block text-[10px] text-[var(--text-tertiary)]">Необязательно для публичной папки</span></label>
              </div>
              <div className="flex justify-end border-t border-[var(--border-primary)] pt-4"><button type="submit" disabled={yandexSaveLoading} className="erp-button-primary inline-flex items-center gap-2 whitespace-nowrap text-xs disabled:opacity-50">{yandexSaveLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}{yandexSaveLoading ? 'Сохраняем' : 'Сохранить Яндекс.Диск'}</button></div>
            </form>
          </section>
        )}

        {activeTab === 'team' && (
          <section className="overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] shadow-xs">
            <PanelHeader icon={Users} title="Команда и доступы" description="Сотрудники, системные роли и разрешения разделов" trailing={<button type="button" onClick={() => setIsCreateUserModalOpen(true)} className="erp-button-primary inline-flex items-center justify-center gap-2 whitespace-nowrap text-xs"><UserPlus className="h-3.5 w-3.5" />Добавить сотрудника</button>} />
            <div className="grid gap-3 border-b border-[var(--border-primary)] p-4 sm:grid-cols-3">
              {[
                { label: 'Всего сотрудников', value: users.length, icon: Users },
                { label: 'Активные аккаунты', value: activeUsers, icon: Unlock },
                { label: 'Заблокированные', value: users.length - activeUsers, icon: Lock },
              ].map(item => <div key={item.label} className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface-secondary)] p-3"><div className="flex items-center justify-between"><div><p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">{item.label}</p><p className="mt-1 text-xl font-semibold text-[var(--text-primary)]">{item.value}</p></div><item.icon className="h-4 w-4 text-[var(--accent-primary)]" /></div></div>)}
            </div>
            <div className="divide-y divide-[var(--border-primary)]">
              {users.map(user => {
                const isSelf = user.id === currentUserId
                const expanded = expandedUserPerms[user.id]
                return (
                  <article key={user.id} className="p-4">
                    <div className="grid gap-3 xl:grid-cols-[minmax(180px,1.3fr)_180px_auto_auto] xl:items-center">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2"><p className="truncate text-xs font-semibold text-[var(--text-primary)]">{user.fullName}</p>{isSelf && <span className="rounded bg-[var(--accent-soft)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--accent-primary)]">Вы</span>}</div>
                        <p className="mt-1 truncate font-mono text-[10px] text-[var(--text-tertiary)]">{user.email}</p>
                      </div>
                      {isSelf ? <span className="whitespace-nowrap text-xs font-medium text-[var(--accent-primary)]">{ROLE_LABELS[user.role] || user.role}</span> : <select aria-label={`Роль ${user.fullName}`} value={user.role} onChange={event => handleRoleChange(user.id, event.target.value)} disabled={isPending} className="erp-input w-full whitespace-nowrap text-xs font-medium">{Object.entries(ROLE_LABELS).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select>}
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setExpandedUserPerms(previous => ({ ...previous, [user.id]: !previous[user.id] }))} className="erp-button-secondary inline-flex items-center gap-1.5 whitespace-nowrap text-[10px]"><Shield className="h-3 w-3" />Доступы{expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}</button>
                        {!isSelf && <button type="button" onClick={() => { setResetPasswordUser(user); setTempPassword(''); setResetPasswordMsg('') }} className="erp-button-secondary inline-flex items-center gap-1.5 whitespace-nowrap text-[10px]"><KeyRound className="h-3 w-3" />Пароль</button>}
                      </div>
                      {isSelf ? <StatusBadge ready readyLabel="Активен" /> : <button type="button" onClick={() => handleToggleStatus(user.id, user.isActive)} disabled={isPending} className={`inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold ${user.isActive ? 'border-[var(--success)]/20 bg-[var(--success-soft)] text-[var(--success)]' : 'border-[var(--danger)]/20 bg-[var(--danger-soft)] text-[var(--danger)]'}`}>{user.isActive ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}{user.isActive ? 'Активен' : 'Заблокирован'}</button>}
                    </div>
                    {expanded && (
                      <div className="mt-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface-secondary)] p-4">
                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Разрешения разделов</p>
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {SECTIONS.map(section => {
                            const permissions = user.permissions && typeof user.permissions === 'object' ? user.permissions : {}
                            const hasAccess = permissions[section.id] !== undefined ? permissions[section.id] : ['admin', 'owner'].includes(user.role) || (user.role === 'manager' && ['catalog', 'clients', 'orders', 'drivers'].includes(section.id))
                            return <label key={section.id} className="flex min-h-9 items-center gap-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface)] px-3 text-[10px] text-[var(--text-primary)]"><input type="checkbox" checked={hasAccess} onChange={() => handlePermissionToggle(user.id, section.id, hasAccess)} className="h-3.5 w-3.5 rounded" />{section.label}</label>
                          })}
                        </div>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          </section>
        )}
      </main>

      {isCreateUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)] p-4 backdrop-blur-xs" onMouseDown={event => { if (event.target === event.currentTarget) setIsCreateUserModalOpen(false) }}>
          <div role="dialog" aria-modal="true" aria-labelledby="create-user-title" className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-surface)] shadow-2xl">
            <div className="flex items-start justify-between border-b border-[var(--border-primary)] p-4"><div><h3 id="create-user-title" className="text-sm font-semibold text-[var(--text-primary)]">Новый сотрудник</h3><p className="mt-1 text-[10px] text-[var(--text-secondary)]">Создайте аккаунт и назначьте системную роль.</p></div><button type="button" aria-label="Закрыть" onClick={() => setIsCreateUserModalOpen(false)} className="rounded-lg p-2 text-[var(--text-tertiary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"><X className="h-4 w-4" /></button></div>
            <form onSubmit={handleCreateUser} className="space-y-4 p-4">
              {userModalError && <Feedback tone="danger">{userModalError}</Feedback>}
              {userModalSuccess && <Feedback tone="success">{userModalSuccess}</Feedback>}
              <label><span className={labelClass}>ФИО *</span><input required value={newFullName} onChange={event => setNewFullName(event.target.value)} placeholder="Иван Иванов" className={inputClass} /></label>
              <label><span className={labelClass}>Электронная почта / логин *</span><span className="relative block"><Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]" /><input required value={newEmail} onChange={event => setNewEmail(event.target.value)} placeholder="name@sulak.ru" className={`${inputClass} pl-9`} /></span></label>
              <label><span className={labelClass}>Временный пароль *</span><span className="relative block"><input required type={showPassword ? 'text' : 'password'} value={newPassword} onChange={event => setNewPassword(event.target.value)} placeholder="Введите временный пароль" className={`${inputClass} pr-10 font-mono`} /><button type="button" aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'} onClick={() => setShowPassword(previous => !previous)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--text-tertiary)]">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span></label>
              <label><span className={labelClass}>Роль *</span><select value={newRole} onChange={event => setNewRole(event.target.value)} className={`${inputClass} font-medium`}>{Object.entries(ROLE_LABELS).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
              <div className="flex flex-col-reverse gap-2 border-t border-[var(--border-primary)] pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => setIsCreateUserModalOpen(false)} className="erp-button-secondary whitespace-nowrap text-xs">Отмена</button><button type="submit" disabled={userModalLoading} className="erp-button-primary inline-flex items-center justify-center gap-2 whitespace-nowrap text-xs disabled:opacity-50">{userModalLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}{userModalLoading ? 'Создаём аккаунт' : 'Создать сотрудника'}</button></div>
            </form>
          </div>
        </div>
      )}

      {resetPasswordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)] p-4 backdrop-blur-xs" onMouseDown={event => { if (event.target === event.currentTarget) setResetPasswordUser(null) }}>
          <div role="dialog" aria-modal="true" aria-labelledby="reset-password-title" className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-surface)] shadow-2xl">
            <div className="flex items-start justify-between border-b border-[var(--border-primary)] p-4"><div><h3 id="reset-password-title" className="text-sm font-semibold text-[var(--text-primary)]">Временный пароль</h3><p className="mt-1 text-[10px] text-[var(--text-secondary)]">Сотрудник: {resetPasswordUser.fullName}</p></div><button type="button" aria-label="Закрыть" onClick={() => setResetPasswordUser(null)} className="rounded-lg p-2 text-[var(--text-tertiary)] hover:bg-[var(--bg-surface-hover)]"><X className="h-4 w-4" /></button></div>
            <form onSubmit={handleResetPassword} className="space-y-4 p-4">
              <p className="text-[11px] leading-5 text-[var(--text-secondary)]">После следующего входа сотруднику потребуется заменить временный пароль на собственный.</p>
              {resetPasswordMsg && <Feedback tone={resetPasswordMsg.startsWith('Ошибка') ? 'danger' : 'success'}>{resetPasswordMsg}</Feedback>}
              <label><span className={labelClass}>Новый временный пароль *</span><input required minLength={3} value={tempPassword} onChange={event => setTempPassword(event.target.value)} placeholder="Введите временный пароль" className={`${inputClass} font-mono`} autoFocus /></label>
              <div className="flex flex-col-reverse gap-2 border-t border-[var(--border-primary)] pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => setResetPasswordUser(null)} className="erp-button-secondary whitespace-nowrap text-xs">Отмена</button><button type="submit" disabled={isPending || !tempPassword} className="erp-button-primary inline-flex items-center justify-center gap-2 whitespace-nowrap text-xs disabled:opacity-50">{isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}{isPending ? 'Сохраняем' : 'Установить пароль'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
