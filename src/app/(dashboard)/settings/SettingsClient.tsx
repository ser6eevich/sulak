'use client'

import React, { useState, useTransition } from 'react'
import { saveTelegramSettingsAction, testTelegramNotificationAction } from './actions'
import { saveAmoCrmCredentialsAction } from '@/app/(dashboard)/analytics/daily-report/actions'
import { saveAvitoSettingsAction, sendLatestReviewPerAccountAction, AvitoAccountInput } from './actions'
import { 
  createUserAction, 
  updateUserRoleAction, 
  updateUserPermissionsAction, 
  toggleUserStatusAction,
  updateUserTelegramAction,
  resetUserPasswordAction
} from '@/app/(dashboard)/dashboard/actions'
import { 
  Check, 
  AlertCircle, 
  RefreshCw, 
  MessageSquare, 
  Key, 
  Bot, 
  Save, 
  Sparkles,
  Send,
  X,
  Clock,
  BookOpen,
  Users,
  CheckCircle2,
  AlertTriangle,
  ShoppingCart,
  UserPlus,
  Shield,
  Lock,
  Unlock,
  Settings as SettingsIcon,
  Eye,
  EyeOff,
  BarChart3,
  Star
} from 'lucide-react'

interface Profile {
  id: string
  email: string
  fullName: string
  role: string
  isActive: boolean
  permissions: any
  telegramUsername?: string | null
}

interface ManagerProfile {
  id: string
  fullName: string
  email: string
  phone: string | null
  telegramUsername?: string | null
  sellerOrders: any[]
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
  initialManagers?: ManagerProfile[]
  initialUsers?: Profile[]
  currentUserId?: string
  userRole?: string
}

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
  { id: 'dashboard', label: 'Обзор платформы (Дашборд)' },
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

const STATUS_THRESHOLD_CONFIG: { key: string; label: string; defaultHours: number; desc: string }[] = [
  { key: 'pending', label: 'Ожидает подтверждения', defaultHours: 24, desc: 'Заказ создан, но ещё не обработан' },
  { key: 'confirmed', label: 'Подтвержден', defaultHours: 48, desc: 'Подтверждён, ждёт отправки на склад или в цех' },
  { key: 'production', label: 'В производстве', defaultHours: 96, desc: 'Находится в цеху на изготовлении' },
  { key: 'warehouse', label: 'На складе', defaultHours: 48, desc: 'Готов к отгрузке, лежит на складе' },
  { key: 'delivery', label: 'Ожидает доставку', defaultHours: 48, desc: 'Назначен водитель или готовится в путь' },
]

const TOPIC_CONFIG: { key: string; label: string; placeholder: string; desc: string }[] = [
  { key: 'new_orders', label: '📋 1. Новые заказы', placeholder: 'Например: 2', desc: 'Уведомления о создании новых заказов' },
  { key: 'production', label: '🏭 2. Производство', placeholder: 'Например: 4', desc: 'Заказы, переданные в цех / производство' },
  { key: 'warehouse', label: '📦 3. Склад', placeholder: 'Например: 6', desc: 'Готовность товаров на складе' },
  { key: 'logistics', label: '🚚 4. Логистика / Рейсы', placeholder: 'Например: 8', desc: 'Отгрузка и формирование рейсов' },
  { key: 'delivered', label: '✅ 5. Доставлено', placeholder: 'Например: 10', desc: 'Завершённые заказы и отметки менеджера' },
  { key: 'cancelled', label: '❌ 6. Отмены', placeholder: 'Например: 12', desc: 'Отменённые заказы с причиной' },
  { key: 'general', label: '💬 7. Общий / Команда', placeholder: 'Например: 1', desc: 'Алерты простая и общие уведомления' },
]

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
  initialManagers = [],
  initialUsers = [],
  currentUserId = '',
  userRole = 'admin'
}: SettingsClientProps) {
  const [activeTab, setActiveTab] = useState<'telegram' | 'memo' | 'team' | 'amocrm' | 'avito'>('telegram')

  // amoCRM интеграция
  const [amoSubdomain, setAmoSubdomain] = useState(initialAmoSettings?.subdomain || '')
  const [amoClientId, setAmoClientId] = useState(initialAmoSettings?.clientId || '')
  const [amoClientSecret, setAmoClientSecret] = useState(initialAmoSettings?.clientSecret || '')
  const [amoAccessToken, setAmoAccessToken] = useState(initialAmoSettings?.accessToken || '')
  const [amoRefreshToken, setAmoRefreshToken] = useState(initialAmoSettings?.refreshToken || '')
  const [amoSaveMsg, setAmoSaveMsg] = useState('')
  const [amoSaveLoading, setAmoSaveLoading] = useState(false)

  // Авито: аккаунты и топик отзывов
  const [avitoReviewsTopicId, setAvitoReviewsTopicId] = useState(initialTopics?.reviews || '')
  const [avitoAccounts, setAvitoAccounts] = useState<AvitoAccountInput[]>(
    initialAvitoAccounts && initialAvitoAccounts.length === 7
      ? initialAvitoAccounts
      : Array.from({ length: 7 }, () => ({ name: '', clientId: '', clientSecret: '' }))
  )
  const [avitoSaveMsg, setAvitoSaveMsg] = useState('')
  const [avitoSaveLoading, setAvitoSaveLoading] = useState(false)
  const [avitoTestMsg, setAvitoTestMsg] = useState('')
  const [avitoTestLoading, setAvitoTestLoading] = useState(false)

  // Настройки Telegram
  const [chatId, setChatId] = useState(initialChatId)
  const [botToken, setBotToken] = useState(initialBotToken)
  const [ownerTag, setOwnerTag] = useState(initialOwnerTag)
  const [warehouseTag, setWarehouseTag] = useState(initialWarehouseTag)
  const [siteUrl, setSiteUrl] = useState(initialSiteUrl)
  
  // Пороги простоя в часах
  const [thresholds, setThresholds] = useState<Record<string, number>>({
    pending: initialThresholds.pending || 24,
    confirmed: initialThresholds.confirmed || 48,
    production: initialThresholds.production || 96,
    warehouse: initialThresholds.warehouse || 48,
    delivery: initialThresholds.delivery || 48,
  })

  // ID тем (топиков) Telegram
  const [topics, setTopics] = useState<Record<string, string>>({
    new_orders: initialTopics?.new_orders || '',
    production: initialTopics?.production || '',
    warehouse: initialTopics?.warehouse || '',
    logistics: initialTopics?.logistics || '',
    delivered: initialTopics?.delivered || '',
    cancelled: initialTopics?.cancelled || '',
    general: initialTopics?.general || '',
  })

  // Управление пользователями
  const [users, setUsers] = useState<Profile[]>(initialUsers)
  const [isPending, startTransition] = useTransition()
  const [expandedUserPerms, setExpandedUserPerms] = useState<Record<string, boolean>>({})
  
  // Модалка сброса пароля пользователя
  const [resetPasswordUser, setResetPasswordUser] = useState<Profile | null>(null)
  const [tempPassword, setTempPassword] = useState('')
  const [resetPasswordMsg, setResetPasswordMsg] = useState('')

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetPasswordUser || !tempPassword) return
    setResetPasswordMsg('')

    startTransition(async () => {
      const res = await resetUserPasswordAction(resetPasswordUser.id, tempPassword)
      if (res.error) {
        setResetPasswordMsg(`Ошибка: ${res.error}`)
      } else {
        setResetPasswordMsg('Пароль сброшен! Сотрудник обязан будет сменить его при следующем входе.')
        setTimeout(() => {
          setResetPasswordUser(null)
          setTempPassword('')
          setResetPasswordMsg('')
        }, 1800)
      }
    })
  }

  // Модалка создания нового пользователя
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newFullName, setNewFullName] = useState('')
  const [newRole, setNewRole] = useState('manager')
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [userModalError, setUserModalError] = useState('')
  const [userModalSuccess, setUserModalSuccess] = useState('')
  const [userModalLoading, setUserModalLoading] = useState(false)

  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const [saveSuccessMsg, setSaveSuccessMsg] = useState('')
  const [saveErrorMsg, setSaveErrorMsg] = useState('')

  const [testSuccessMsg, setTestSuccessMsg] = useState('')
  const [testErrorMsg, setTestErrorMsg] = useState('')

  const handleThresholdChange = (key: string, valueStr: string) => {
    const num = parseInt(valueStr, 10)
    setThresholds(prev => ({
      ...prev,
      [key]: isNaN(num) || num < 1 ? 1 : num,
    }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaveSuccessMsg('')
    setSaveErrorMsg('')
    setSaving(true)

    const result = await saveTelegramSettingsAction(chatId, botToken, ownerTag, warehouseTag, thresholds, topics, siteUrl)
    setSaving(false)

    if (result.error) {
      setSaveErrorMsg(result.error)
    } else {
      setSaveSuccessMsg('Настройки Telegram, пороги простоя и теги сотрудников успешно сохранены!')
      setTimeout(() => setSaveSuccessMsg(''), 4000)
    }
  }

  const handleTest = async () => {
    setTestSuccessMsg('')
    setTestErrorMsg('')
    setTesting(true)

    const result = await testTelegramNotificationAction(chatId, botToken)
    setTesting(false)

    if (result.error) {
      setTestErrorMsg(result.error)
    } else if (result.message) {
      setTestSuccessMsg(result.message)
      setTimeout(() => setTestSuccessMsg(''), 5000)
    }
  }

  // Функции управления пользователями из Обзора Платформы
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setUserModalError('')
    setUserModalSuccess('')

    if (!newEmail || !newFullName || !newPassword) {
      setUserModalError('Пожалуйста, заполните все обязательные поля')
      return
    }

    setUserModalLoading(true)
    const result = await createUserAction({
      email: newEmail,
      fullName: newFullName,
      role: newRole,
      passwordStr: newPassword
    })
    setUserModalLoading(false)

    if (result.error) {
      setUserModalError(result.error)
    } else if (result.profile) {
      setUserModalSuccess(`Сотрудник ${result.profile.fullName} успешно создан!`)
      setUsers(prev => [...prev, result.profile as Profile])
      setTimeout(() => {
        setIsCreateUserModalOpen(false)
        setNewEmail('')
        setNewFullName('')
        setNewPassword('')
        setUserModalSuccess('')
      }, 1500)
    }
  }

  const handleRoleChange = (userId: string, targetRole: string) => {
    startTransition(async () => {
      const res = await updateUserRoleAction(userId, targetRole)
      if (res.profile) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: res.profile.role } : u))
      }
    })
  }

  const handlePermissionToggle = (userId: string, sectionId: string, currentHasAccess: boolean) => {
    const targetUser = users.find(u => u.id === userId)
    if (!targetUser) return

    const currentPerms = typeof targetUser.permissions === 'object' && targetUser.permissions !== null
      ? { ...targetUser.permissions }
      : {}

    currentPerms[sectionId] = !currentHasAccess

    startTransition(async () => {
      const res = await updateUserPermissionsAction(userId, currentPerms)
      if (res.profile) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, permissions: res.profile.permissions } : u))
      }
    })
  }

  const handleToggleStatus = (userId: string, currentActive: boolean) => {
    startTransition(async () => {
      const res = await toggleUserStatusAction(userId, !currentActive)
      if (res.profile) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, isActive: res.profile.isActive } : u))
      }
    })
  }

  const toggleExpandPerms = (userId: string) => {
    setExpandedUserPerms(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }))
  }

  return (
    <div className="w-full space-y-6 min-w-0 max-w-full overflow-hidden">
      {/* Переключатель вкладок настроек */}
      <div className="flex flex-wrap border-b border-[var(--border-primary)] gap-2 pb-px">
        <button
          onClick={() => setActiveTab('telegram')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold uppercase tracking-wider rounded-t-md border-b-2 transition-all cursor-pointer ${
            activeTab === 'telegram'
              ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] bg-[var(--accent-soft)]/30 font-bold'
              : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
          }`}
        >
          <Bot className="h-4 w-4 text-[var(--accent-primary)]" />
          Telegram & Пороги простоя
        </button>

        <button
          onClick={() => setActiveTab('memo')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold uppercase tracking-wider rounded-t-md border-b-2 transition-all cursor-pointer ${
            activeTab === 'memo'
              ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] bg-[var(--accent-soft)]/30 font-bold'
              : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
          }`}
        >
          <BookOpen className="h-4 w-4 text-[var(--accent-primary)]" />
          Памятка по уведомлениям
        </button>

        <button
          onClick={() => setActiveTab('amocrm')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold uppercase tracking-wider rounded-t-md border-b-2 transition-all cursor-pointer ${
            activeTab === 'amocrm'
              ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] bg-[var(--accent-soft)]/30 font-bold'
              : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
          }`}
        >
          <BarChart3 className="h-4 w-4 text-[var(--accent-primary)]" />
          amoCRM
        </button>

        <button
          onClick={() => setActiveTab('avito')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold uppercase tracking-wider rounded-t-md border-b-2 transition-all cursor-pointer ${
            activeTab === 'avito'
              ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] bg-[var(--accent-soft)]/30 font-bold'
              : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
          }`}
        >
          <Star className="h-4 w-4 text-[var(--accent-primary)]" />
          Авито · Отзывы
        </button>

        <button
          onClick={() => setActiveTab('team')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold uppercase tracking-wider rounded-t-md border-b-2 transition-all cursor-pointer ${
            activeTab === 'team'
              ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] bg-[var(--accent-soft)]/30 font-bold'
              : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
          }`}
        >
          <Users className="h-4 w-4 text-[var(--accent-primary)]" />
        </button>
      </div>

      {/* Вкладка 1: Telegram & Пороги простоя */}
      {activeTab === 'telegram' && (
        <div className="space-y-6">

          <div className="erp-card p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[var(--border-primary)]">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-md bg-[var(--accent-soft)] text-[var(--accent-primary)] flex items-center justify-center font-medium">
                <Bot className="h-4.5 w-4.5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  Интеграция с Telegram Ботом и периоды контроля
                </h2>
                <p className="text-xs font-normal text-[var(--text-secondary)] mt-0.5">
                  Настройка Chat ID, токена, ответственных лиц и порогов простоя для каждого статуса
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            {saveSuccessMsg && (
              <div className="p-3 bg-[var(--success-soft)] border border-[var(--success)]/20 text-[var(--success)] rounded-md text-xs font-medium flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-[var(--success)]" />
                {saveSuccessMsg}
              </div>
            )}

            {saveErrorMsg && (
              <div className="p-3 bg-[var(--danger-soft)] border border-[var(--danger)]/20 text-[var(--danger)] rounded-md text-xs font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {saveErrorMsg}
              </div>
            )}

            {/* ID Чата Telegram */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                ID Чата Telegram (Chat ID) *
              </label>
              <input
                type="text"
                required
                placeholder="1803301964 или -100123456789"
                value={chatId}
                onChange={e => setChatId(e.target.value)}
                className="erp-input w-full font-mono"
              />
              <p className="text-[11px] text-[var(--text-secondary)] font-normal leading-relaxed pt-0.5">
                Укажите ваш личный Chat ID или ID группового чата. В этот чат бот будет отправлять алерты о простое и доставках.
              </p>
            </div>

            {/* Токен Бота */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-amber-500" />
                Токен Telegram Бота (Bot Token)
              </label>
              <input
                type="password"
                placeholder="8740932255:AAFr6dNDwAUgDobwgUNIzQDc8SAV3Ks21TM"
                value={botToken}
                onChange={e => setBotToken(e.target.value)}
                className="erp-input w-full font-mono"
              />
              <p className="text-[11px] text-[var(--text-secondary)] font-normal leading-relaxed pt-0.5">
                Токен бота, полученный у <span className="font-medium text-[var(--text-primary)]">@BotFather</span>.
              </p>
            </div>

            {/* URL сайта / CRM для ссылок в Telegram */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-blue-500" />
                URL вашего сайта / CRM (для кнопок в Telegram)
              </label>
              <input
                type="text"
                placeholder="https://sulak-crm.ru"
                value={siteUrl}
                onChange={e => setSiteUrl(e.target.value)}
                className="erp-input w-full font-mono"
              />
              <p className="text-[11px] text-[var(--text-secondary)] font-normal leading-relaxed pt-0.5">
                Укажите домен вашего сайта (например, <span className="font-mono text-[var(--text-primary)]">https://sulak-crm.ru</span>). Эта ссылка будет автоматически использоваться в кнопках «Перейти к заказу» в Telegram-уведомлениях.
              </p>
            </div>

            {/* Теги ответственных лиц для уведомлений */}
            <div className="p-4 bg-[var(--bg-surface-secondary)] border border-[var(--border-primary)] rounded-lg space-y-4">
              <h3 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[var(--accent-primary)]" />
                Теги ответственных ролей для Telegram-уведомлений
              </h3>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Укажите Telegram-аккаунты для авто-отметки в алертах простая.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="block text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                    👑 Руководитель (Билал)
                  </label>
                  <input
                    type="text"
                    placeholder="@bilal_username"
                    value={ownerTag}
                    onChange={e => setOwnerTag(e.target.value)}
                    className="erp-input w-full font-mono text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                    📦 Работник склада
                  </label>
                  <input
                    type="text"
                    placeholder="@warehouse_username"
                    value={warehouseTag}
                    onChange={e => setWarehouseTag(e.target.value)}
                    className="erp-input w-full font-mono text-xs"
                  />
                </div>
              </div>
            </div>



            {/* Ручная настройка порогов простоя по статусам */}
            <div className="p-4 bg-[var(--bg-surface-secondary)] border border-[var(--border-primary)] rounded-lg space-y-4">
              <h3 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                <Clock className="h-4 w-4 text-[var(--accent-primary)]" />
                Настройка порогов простоя заказов (период без движения в часах)
              </h3>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Если заказ находится в статусе дольше указанного количества часов (и у него нет плановой будущей даты доставки), бот мгновенно отправит уведомление в Telegram.
              </p>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {STATUS_THRESHOLD_CONFIG.map(cfg => {
                  const val = thresholds[cfg.key] ?? cfg.defaultHours
                  const days = Math.round((val / 24) * 10) / 10
                  return (
                    <div key={cfg.key} className="p-3 bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-md space-y-1.5">
                      <label className="block text-[11px] font-semibold text-[var(--text-primary)]">
                        {cfg.label}
                      </label>
                      <p className="text-[10px] text-[var(--text-tertiary)]">{cfg.desc}</p>
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="number"
                          min={1}
                          max={720}
                          value={val}
                          onChange={e => handleThresholdChange(cfg.key, e.target.value)}
                          className="erp-input w-24 font-mono text-xs text-center font-bold"
                        />
                        <span className="text-xs font-medium text-[var(--text-secondary)]">
                          ч. ({days} дн.)
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Результаты тестирования отправки */}
            {testSuccessMsg && (
              <div className="p-3 bg-[var(--info-soft)] border border-[var(--info)]/20 text-[var(--info)] rounded-md text-xs font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4 shrink-0 text-[var(--info)]" />
                {testSuccessMsg}
              </div>
            )}

            {testErrorMsg && (
              <div className="p-3 bg-[var(--danger-soft)] border border-[var(--danger)]/20 text-[var(--danger)] rounded-md text-xs font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {testErrorMsg}
              </div>
            )}

            {/* Кнопки действий */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[var(--border-primary)]">
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || !chatId || !botToken}
                className="erp-button-secondary inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {testing ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Отправка тестового сообщения...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                    Проверить отправку в Telegram
                  </>
                )}
              </button>

              <button
                type="submit"
                disabled={saving}
                className="erp-button-primary inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    Сохранить настройки
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
      )}

      {/* Вкладка 2: Памятка по уведомлениям */}
      {activeTab === 'memo' && (
        <div className="erp-card p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-[var(--border-primary)]">
            <div className="h-9 w-9 rounded-md bg-[var(--accent-soft)] text-[var(--accent-primary)] flex items-center justify-center font-medium">
              <BookOpen className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Памятка по всем Telegram-уведомлениям системы
              </h2>
              <p className="text-xs font-normal text-[var(--text-secondary)] mt-0.5">
                Описание каждого типа автоматических сообщений, триггеров их отправки и получателей
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {/* 1. Новый заказ */}
            <div className="p-4 bg-[var(--bg-surface-secondary)] border border-[var(--border-primary)] rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded bg-blue-500/10 text-blue-500 font-bold">
                  <ShoppingCart className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  1. Новый заказ
                </h3>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Отправляется в целевой Telegram-чат **моментально** при оформлении заказа менеджером.
              </p>
              <div className="text-[11px] space-y-1 bg-[var(--bg-surface)] p-2.5 rounded border border-[var(--border-primary)] text-[var(--text-tertiary)] font-mono">
                <div>• ФИО и телефоны клиента</div>
                <div>• Состав комплекта и цены</div>
                <div>• Фотографии подзаказов</div>
                <div>• Кто продал и кто оформил</div>
              </div>
            </div>

            {/* 2. Заказ доставлен */}
            <div className="p-4 bg-[var(--bg-surface-secondary)] border border-[var(--border-primary)] rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded bg-emerald-500/10 text-emerald-500 font-bold">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  2. Заказ доставлен
                </h3>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Отправляется в Telegram при переводе заказа в статус <span className="font-semibold text-emerald-500">«Доставлен»</span>.
              </p>
              <div className="text-[11px] space-y-1 bg-[var(--bg-surface)] p-2.5 rounded border border-[var(--border-primary)] text-[var(--text-tertiary)] font-mono">
                <div>• Подтверждение доставки</div>
                <div>• Упоминание продавца <code className="text-emerald-500">@username</code></div>
                <div>• Напоминание запросить отзыв</div>
              </div>
            </div>

            {/* 3. Простой заказа */}
            <div className="p-4 bg-[var(--bg-surface-secondary)] border border-[var(--border-primary)] rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded bg-amber-500/10 text-amber-500 font-bold">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  3. Алерт о простое
                </h3>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Отправляется автоматически, когда заказ висит без движения дольше установленного порога.
              </p>
              <div className="text-[11px] space-y-1 bg-[var(--bg-surface)] p-2.5 rounded border border-[var(--border-primary)] text-[var(--text-tertiary)] font-mono">
                <div>• Тег Руководителя <code className="text-amber-500">@ownerTag</code></div>
                <div>• Тег Склада <code className="text-amber-500">@warehouseTag</code></div>
                <div>• Тег Менеджера <code className="text-amber-500">@manager</code></div>
                <div>• 1 алерт на статус (без спама)</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Вкладка 3: Управление командой (Перенесенный блок с Обзора Платформы + Менеджеры) */}
      {/* Вкладка amoCRM */}
      {activeTab === 'amocrm' && (
        <div className="space-y-6">
          <div className="erp-card p-6 space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-[var(--border-primary)]">
              <div className="h-9 w-9 rounded-md bg-[var(--accent-soft)] text-[var(--accent-primary)] flex items-center justify-center">
                <BarChart3 className="h-4.5 w-4.5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Интеграция с amoCRM</h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Ключи OAuth2 для автоматического сбора аналитики и формирования дневных отчётов
                </p>
              </div>
            </div>

            {amoSaveMsg && (
              <div className={`p-3 rounded-xl text-xs font-medium ${amoSaveMsg.startsWith('Ошибка') ? 'bg-[var(--danger-soft)] text-[var(--danger)]' : 'bg-[var(--success-soft)] text-[var(--success)]'}`}>
                {amoSaveMsg}
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault()
                setAmoSaveLoading(true)
                setAmoSaveMsg('')
                const res = await saveAmoCrmCredentialsAction({
                  subdomain: amoSubdomain,
                  clientId: amoClientId,
                  clientSecret: amoClientSecret,
                  accessToken: amoAccessToken,
                  refreshToken: amoRefreshToken,
                })
                setAmoSaveLoading(false)
                if (res.error) {
                  setAmoSaveMsg(`Ошибка: ${res.error}`)
                } else if ((res as any).warning) {
                  setAmoSaveMsg(`⚠️ ${(res as any).warning}`)
                } else {
                  setAmoSaveMsg(`✅ ${(res as any).message || 'Настройки amoCRM сохранены и успешно проверены!'}`)
                }
              }}
              className="space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[var(--text-primary)]">Поддомен <span className="text-[var(--danger)]">*</span></label>
                  <p className="text-[10px] text-[var(--text-tertiary)]">Ваш поддомен amoCRM, например: <code className="font-mono">mycompany</code> (без .amocrm.ru)</p>
                  <input
                    type="text"
                    value={amoSubdomain}
                    onChange={e => setAmoSubdomain(e.target.value)}
                    placeholder="mycompany"
                    className="erp-input w-full font-mono text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[var(--text-primary)]">Client ID <span className="text-[var(--danger)]">*</span></label>
                  <p className="text-[10px] text-[var(--text-tertiary)]">ID интеграции из Настройки → Интеграции → ваша интеграция</p>
                  <input
                    type="text"
                    value={amoClientId}
                    onChange={e => setAmoClientId(e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className="erp-input w-full font-mono text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[var(--text-primary)]">Client Secret <span className="text-[var(--danger)]">*</span></label>
                  <p className="text-[10px] text-[var(--text-tertiary)]">Секрет интеграции из amoCRM</p>
                  <input
                    type="password"
                    value={amoClientSecret}
                    onChange={e => setAmoClientSecret(e.target.value)}
                    placeholder="••••••••••••••••"
                    className="erp-input w-full font-mono text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[var(--text-primary)]">Access Token <span className="text-[var(--danger)]">*</span></label>
                  <p className="text-[10px] text-[var(--text-tertiary)]">Токен доступа. Автоматически обновляется через Refresh Token</p>
                  <input
                    type="password"
                    value={amoAccessToken}
                    onChange={e => setAmoAccessToken(e.target.value)}
                    placeholder="eyJ0eXAiOiJKV1QiLCJhbGci..."
                    className="erp-input w-full font-mono text-xs"
                    required
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="block text-xs font-semibold text-[var(--text-primary)]">Refresh Token</label>
                  <p className="text-[10px] text-[var(--text-tertiary)]">Токен обновления. Рекомендуется заполнить для автоматического продления Access Token</p>
                  <input
                    type="password"
                    value={amoRefreshToken}
                    onChange={e => setAmoRefreshToken(e.target.value)}
                    placeholder="eyJ0eXAiOiJKV1QiLCJhbGci..."
                    className="erp-input w-full font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={amoSaveLoading}
                  className="erp-button-primary text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {amoSaveLoading ? (
                    <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Сохранение...</>
                  ) : (
                    <><Save className="h-3.5 w-3.5" /> Сохранить настройки amoCRM</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Вкладка Авито · Отзывы */}
      {activeTab === 'avito' && (
        <div className="space-y-6">
          <div className="erp-card p-6 space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-[var(--border-primary)]">
              <div className="h-9 w-9 rounded-md bg-[var(--accent-soft)] text-[var(--accent-primary)] flex items-center justify-center">
                <Star className="h-4.5 w-4.5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Мониторинг отзывов Авито</h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Новые отзывы на ваших аккаунтах будут автоматически приходить в Telegram-тему «Отзывы»
                </p>
              </div>
            </div>

            {avitoSaveMsg && (
              <div className={`p-3 rounded-xl text-xs font-medium ${avitoSaveMsg.startsWith('Ошибка') ? 'bg-[var(--danger-soft)] text-[var(--danger)]' : 'bg-[var(--success-soft)] text-[var(--success)]'}`}>
                {avitoSaveMsg}
              </div>
            )}

            {avitoTestMsg && (
              <div className={`p-3 rounded-xl text-xs font-medium ${avitoTestMsg.startsWith('Ошибка') ? 'bg-[var(--danger-soft)] text-[var(--danger)]' : 'bg-[var(--success-soft)] text-[var(--success)]'}`}>
                {avitoTestMsg}
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault()
                setAvitoSaveLoading(true)
                setAvitoSaveMsg('')
                const res = await saveAvitoSettingsAction(avitoAccounts)
                setAvitoSaveLoading(false)
                setAvitoSaveMsg(res.error ? `Ошибка: ${res.error}` : '✅ Настройки Авито сохранены!')
              }}
              className="space-y-6"
            >
              {/* Проверка интеграции отзывов Авито */}
              <div className="p-4 bg-[var(--bg-surface-secondary)] border border-[var(--border-primary)] rounded-lg space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-[var(--accent-primary)]" />
                      Проверка интеграции отзывов Авито
                    </h3>
                    <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                      Нажмите кнопку ниже, чтобы система запросила Авито API и отправила по 1 последнему отзыву с каждого настроенного аккаунта прямо в ваш Telegram-чат с тегом <code className="font-mono">#отзыв_авито</code>.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={avitoTestLoading}
                    onClick={async () => {
                      setAvitoTestLoading(true)
                      setAvitoTestMsg('')
                      const res = await sendLatestReviewPerAccountAction(avitoAccounts)
                      setAvitoTestLoading(false)
                      if (res.error) {
                        setAvitoTestMsg(`Ошибка: ${res.error}`)
                      } else {
                        setAvitoTestMsg(res.message || 'Отзывы успешно отправлены в Telegram!')
                      }
                    }}
                    className="erp-button-secondary text-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
                  >
                    {avitoTestLoading ? (
                      <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Получение отзывов...</>
                    ) : (
                      <><Send className="h-3.5 w-3.5 text-[var(--accent-primary)]" /> Отправить последний 1 отзыв с аккаунтов</>
                    )}
                  </button>
                </div>
              </div>


              {/* Аккаунты Авито */}
              <div className="p-4 bg-[var(--bg-surface-secondary)] border border-[var(--border-primary)] rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                    <Star className="h-4 w-4 text-[var(--accent-primary)]" />
                    Аккаунты Авито (до 7)
                  </h3>
                  <p className="text-[10px] text-[var(--text-tertiary)]">
                    Ключи: Настройки Авито → Профессиональный раздел → API
                  </p>
                </div>

                <div className="space-y-3">
                  {avitoAccounts.map((acc, idx) => (
                    <div key={idx} className="p-3 bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-md space-y-2">
                      <p className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                        Аккаунт {idx + 1}
                      </p>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <div>
                          <label className="block text-[10px] font-medium text-[var(--text-tertiary)] mb-1">Название</label>
                          <input
                            type="text"
                            value={acc.name}
                            onChange={e => {
                              const updated = [...avitoAccounts]
                              updated[idx] = { ...updated[idx], name: e.target.value }
                              setAvitoAccounts(updated)
                            }}
                            placeholder="Например: Зоя Авито"
                            className="erp-input w-full text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-[var(--text-tertiary)] mb-1">Client ID</label>
                          <input
                            type="text"
                            value={acc.clientId}
                            onChange={e => {
                              const updated = [...avitoAccounts]
                              updated[idx] = { ...updated[idx], clientId: e.target.value }
                              setAvitoAccounts(updated)
                            }}
                            placeholder="avito.ru/app/12345…"
                            className="erp-input w-full font-mono text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-[var(--text-tertiary)] mb-1">Client Secret</label>
                          <input
                            type="password"
                            value={acc.clientSecret}
                            onChange={e => {
                              const updated = [...avitoAccounts]
                              updated[idx] = { ...updated[idx], clientSecret: e.target.value }
                              setAvitoAccounts(updated)
                            }}
                            placeholder="••••••••••••"
                            className="erp-input w-full font-mono text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={avitoSaveLoading}
                  className="erp-button-primary text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {avitoSaveLoading ? (
                    <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Сохранение...</>
                  ) : (
                    <><Save className="h-3.5 w-3.5" /> Сохранить настройки Авито</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'team' && (
        <div className="space-y-6">
          {/* Блок 1: Управление сотрудниками, ролями и доступами к разделам (Из Обзора Платформы) */}
          <div className="erp-card flex flex-col overflow-hidden">
            <div className="p-4 border-b border-[var(--border-primary)] bg-[var(--bg-table-header)] flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                  <Shield className="h-4 w-4 text-[var(--accent-primary)]" />
                  Управление сотрудниками, ролями и доступами
                </h3>
                <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                  Создание аккаунтов, назначение системных ролей (Админ, Менеджер, Склад, Логист и др.) и настройка точечных разрешений
                </p>
              </div>
              <button
                onClick={() => setIsCreateUserModalOpen(true)}
                className="erp-button-primary inline-flex items-center gap-1.5 cursor-pointer text-xs shrink-0"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Добавить сотрудника
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-primary)] bg-[var(--bg-table-header)] text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                    <th className="p-3 pl-4">Сотрудник / Почта</th>
                    <th className="p-3">Системная роль</th>
                    <th className="p-3 text-center">Разрешения разделов</th>
                    <th className="p-3 text-center">Статус</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-primary)] text-[var(--text-primary)] font-normal">
                  {users.map(u => {
                    const isSelf = u.id === currentUserId
                    return (
                      <React.Fragment key={u.id}>
                        <tr className="hover:bg-[var(--bg-table-row-hover)] transition-colors">
                          <td className="p-3 pl-4">
                            <div className="font-medium text-[var(--text-primary)]">{u.fullName}</div>
                            <div className="text-[var(--text-tertiary)] font-mono text-[11px]">{u.email}</div>
                          </td>
                          <td className="p-3">
                            {isSelf ? (
                              <span className="font-medium text-[var(--accent-text)]">{ROLE_LABELS[u.role] || u.role}</span>
                            ) : (
                              <select
                                value={u.role}
                                onChange={e => handleRoleChange(u.id, e.target.value)}
                                disabled={isPending}
                                className="erp-input py-1 px-2 text-xs font-medium cursor-pointer disabled:opacity-50"
                              >
                                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                                  <option key={k} value={k}>{v}</option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => toggleExpandPerms(u.id)}
                                className="erp-button-secondary py-1 px-2.5 text-[11px] cursor-pointer inline-flex items-center gap-1"
                              >
                                <SettingsIcon className="h-3 w-3 text-[var(--accent-primary)]" />
                                Настроить доступ
                              </button>

                              {!isSelf && (
                                <button
                                  onClick={() => {
                                    setResetPasswordUser(u)
                                    setTempPassword('')
                                    setResetPasswordMsg('')
                                  }}
                                  title="Установить новый временный пароль сотруднику"
                                  className="erp-button-secondary py-1 px-2 text-[11px] cursor-pointer inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 border-amber-500/20"
                                >
                                  <Key className="h-3 w-3" />
                                  Пароль
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            {isSelf ? (
                              <span className="inline-flex items-center rounded bg-[var(--success-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--success)] border border-[var(--success)]/20">
                                Активен
                              </span>
                            ) : (
                              <button
                                onClick={() => handleToggleStatus(u.id, u.isActive)}
                                disabled={isPending}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border cursor-pointer ${
                                  u.isActive 
                                    ? 'bg-[var(--success-soft)] text-[var(--success)] border-[var(--success)]/20 hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] hover:border-[var(--danger)]/20' 
                                    : 'bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger)]/20 hover:bg-[var(--success-soft)] hover:text-[var(--success)] hover:border-[var(--success)]/20'
                                }`}
                              >
                                {u.isActive ? (
                                  <>
                                    <Unlock className="h-3 w-3" />
                                    Активен
                                  </>
                                ) : (
                                  <>
                                    <Lock className="h-3 w-3" />
                                    Заблокир.
                                  </>
                                )}
                              </button>
                            )}
                          </td>
                        </tr>

                        {expandedUserPerms[u.id] && (
                          <tr>
                            <td colSpan={4} className="bg-[var(--bg-surface-secondary)] p-3 pl-6 border-b border-[var(--border-primary)]">
                              <div className="bg-[var(--bg-surface)] p-3 rounded-md border border-[var(--border-primary)] space-y-2.5">
                                <h4 className="font-medium text-[10px] uppercase text-[var(--text-tertiary)] tracking-wider flex items-center gap-1.5">
                                  <Shield className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                                  Разрешения разделов платформы для: {u.fullName}
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                  {SECTIONS.map(s => {
                                    const userPerms = typeof u.permissions === 'object' && u.permissions !== null ? u.permissions : {}
                                    const hasAccess = userPerms[s.id] !== undefined
                                      ? userPerms[s.id]
                                      : ['admin', 'owner'].includes(u.role) || (u.role === 'manager' && ['catalog', 'clients', 'orders', 'drivers'].includes(s.id))
                                    
                                    return (
                                      <label key={s.id} className="flex items-center gap-2 text-xs font-normal text-[var(--text-primary)] cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={hasAccess}
                                          onChange={() => handlePermissionToggle(u.id, s.id, hasAccess)}
                                          className="h-3.5 w-3.5 rounded text-[var(--accent-primary)] cursor-pointer"
                                        />
                                        {s.label}
                                      </label>
                                    )
                                  })}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно добавления нового сотрудника */}
      {isCreateUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--bg-overlay)] backdrop-blur-xs">
          <div className="bg-[var(--bg-surface)] rounded-lg shadow-md w-full max-w-md overflow-hidden border border-[var(--border-primary)]">
            <div className="flex h-12 items-center justify-between border-b border-[var(--border-primary)] px-4 bg-[var(--bg-table-header)]">
              <h3 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">Создание нового сотрудника</h3>
              <button
                onClick={() => setIsCreateUserModalOpen(false)}
                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleCreateUser} className="p-4 space-y-3.5">
              {userModalError && (
                <div className="p-2.5 bg-[var(--danger-soft)] border border-[var(--danger)]/20 text-[var(--danger)] text-xs font-medium rounded-md">
                  {userModalError}
                </div>
              )}
              {userModalSuccess && (
                <div className="p-2.5 bg-[var(--success-soft)] border border-[var(--success)]/20 text-[var(--success)] text-xs font-medium rounded-md">
                  {userModalSuccess}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">ФИО Сотрудника *</label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={e => setNewFullName(e.target.value)}
                  placeholder="Иван Иванов"
                  className="erp-input w-full"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">Электронная почта / логин *</label>
                <input
                  type="text"
                  required
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="zoia@sulak.ru"
                  className="erp-input w-full"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">Пароль *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="erp-input w-full pr-10 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">Роль в системе *</label>
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value)}
                  className="erp-input w-full font-medium"
                >
                  {Object.entries(ROLE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border-primary)]">
                <button
                  type="button"
                  onClick={() => setIsCreateUserModalOpen(false)}
                  className="erp-button-secondary text-xs"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={userModalLoading}
                  className="erp-button-primary text-xs disabled:opacity-50"
                >
                  {userModalLoading ? 'Создание...' : 'Создать сотрудника'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно сброса пароля пользователя */}
      {resetPasswordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-2xl shadow-2xl p-6 space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-[var(--border-primary)] pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-2">
                <Key className="h-4 w-4 text-amber-500" />
                Сброс пароля: {resetPasswordUser.fullName}
              </h3>
              <button
                onClick={() => setResetPasswordUser(null)}
                className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Укажите новый временный пароль. При следующем входе в систему сотруднику <span className="font-semibold text-[var(--text-primary)]">{resetPasswordUser.fullName}</span> вылезет не закрываемое окно с требованием изменить этот пароль на собственный.
            </p>

            {resetPasswordMsg && (
              <div className={`p-3 rounded-lg text-xs font-medium ${resetPasswordMsg.startsWith('Ошибка') ? 'bg-[var(--danger-soft)] text-[var(--danger)]' : 'bg-[var(--success-soft)] text-[var(--success)]'}`}>
                {resetPasswordMsg}
              </div>
            )}

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[var(--text-primary)]">
                  Новый временный пароль <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={tempPassword}
                  onChange={e => setTempPassword(e.target.value)}
                  placeholder="Например: 123456"
                  className="erp-input text-xs w-full font-mono font-bold"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetPasswordUser(null)}
                  className="erp-button-secondary text-xs cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isPending || !tempPassword}
                  className="erp-button-primary text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Сохранение...
                    </>
                  ) : (
                    <>
                      <Key className="h-3.5 w-3.5" />
                      Установить пароль
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
