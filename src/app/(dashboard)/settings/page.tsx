import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import SettingsClient from './SettingsClient'
import { Settings } from 'lucide-react'
import { getTelegramSettings } from '@/utils/telegram'
import { getAmoCrmSettingsAction } from '@/app/(dashboard)/analytics/daily-report/actions'

export const dynamic = 'force-dynamic'

async function getAvitoFormAccounts() {
  const accounts = Array.from({ length: 7 }, () => ({
    name: '',
    clientId: '',
    clientSecret: '',
  }))

  try {
    const rows = await prisma.systemSetting.findMany({
      where: { key: { startsWith: 'avito_account_' } },
    })

    for (const r of rows) {
      const match = r.key.match(/^avito_account_(\d+)_(.+)$/)
      if (!match) continue
      const idx = parseInt(match[1], 10) - 1
      const field = match[2]
      if (idx >= 0 && idx < 7) {
        if (field === 'name') accounts[idx].name = r.value
        if (field === 'client_id') accounts[idx].clientId = r.value
        if (field === 'client_secret') accounts[idx].clientSecret = r.value
      }
    }
  } catch (err) {
    console.error('Ошибка загрузки настроек Авито из БД:', err)
  }

  return accounts
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  })

  if (!profile || !profile.isActive || !['admin', 'owner'].includes(profile.role)) {
    redirect('/unauthorized')
  }

  const [
    { chatId, token, ownerTag, warehouseTag, siteUrl, thresholds, topics, notifyFlags },
    amoSettings,
    avitoAccounts,
  ] = await Promise.all([
    getTelegramSettings(),
    getAmoCrmSettingsAction(),
    getAvitoFormAccounts(),
  ])

  const managers = await prisma.profile.findMany({
    where: {
      role: 'manager',
    },
    include: {
      sellerOrders: {
        include: {
          client: {
            select: {
              fullName: true,
              primaryPhone: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
    orderBy: {
      fullName: 'asc',
    },
  })

  const tgRows = await prisma.$queryRawUnsafe<{ id: string; telegram_username: string | null }[]>(
    `SELECT id, telegram_username FROM public.profiles WHERE role = 'manager'`
  )
  const tgMap = new Map(tgRows.map(r => [r.id, r.telegram_username]))

  const initialManagers = managers.map(m => ({
    ...m,
    telegramUsername: (m as any).telegramUsername || tgMap.get(m.id) || null,
  }))

  const allUsers = await prisma.profile.findMany({
    orderBy: { fullName: 'asc' },
  })

  const yandexSettingsRows = await prisma.systemSetting.findMany({
    where: { key: { in: ['yandex_disk_public_url', 'yandex_disk_token'] } }
  })
  let yandexPublicUrl = process.env.YANDEX_DISK_PUBLIC_URL || ''
  let yandexToken = process.env.YANDEX_DISK_TOKEN || ''
  for (const r of yandexSettingsRows) {
    if (r.key === 'yandex_disk_public_url' && r.value) yandexPublicUrl = r.value
    if (r.key === 'yandex_disk_token' && r.value) yandexToken = r.value
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 select-none">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
          <Settings className="h-5 w-5 text-[var(--accent-primary)]" />
          Настройки системы и команды
        </h1>
        <p className="text-xs font-normal text-[var(--text-secondary)] mt-1">
          Управление интеграциями Telegram, Яндекс.Диском, Авито, amoCRM и командой сотрудников
        </p>
      </div>

      <SettingsClient 
        initialChatId={chatId} 
        initialBotToken={token}
        initialOwnerTag={ownerTag}
        initialWarehouseTag={warehouseTag}
        initialThresholds={thresholds}
        initialTopics={topics}
        initialNotifyFlags={notifyFlags}
        initialSiteUrl={siteUrl}
        initialAmoSettings={amoSettings}
        initialAvitoAccounts={avitoAccounts}
        initialYandexDiskPublicUrl={yandexPublicUrl}
        initialYandexDiskToken={yandexToken}
        initialManagers={initialManagers}
        initialUsers={allUsers}
        currentUserId={user.id}
        userRole={profile.role}
      />
    </div>
  )
}
