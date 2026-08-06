import prisma from '@/lib/prisma'
import { redirect } from 'next/navigation'
import SettingsClient from './SettingsClient'
import { Settings } from 'lucide-react'
import { getTelegramSettings } from '@/utils/telegram'
import { getAmoCrmSettingsAction } from '@/app/(dashboard)/analytics/daily-report/actions'
import { getCurrentProfile } from '@/lib/auth/dal'

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
        if (field === 'client_secret') accounts[idx].clientSecret = ''
      }
    }
  } catch (err) {
    console.error('Ошибка загрузки настроек Авито из БД:', err)
  }

  return accounts
}

export default async function SettingsPage() {
  const profile = await getCurrentProfile()

  if (!profile || !profile.isActive || !['admin', 'owner'].includes(profile.role)) {
    redirect('/unauthorized')
  }

  const [
    { chatId, ownerTag, warehouseTag, siteUrl, thresholds, topics, notifyFlags },
    amoSettings,
    avitoAccounts,
  ] = await Promise.all([
    getTelegramSettings(),
    getAmoCrmSettingsAction(),
    getAvitoFormAccounts(),
  ])

  const allUserRecords = await prisma.profile.findMany({
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
      permissions: true,
      telegramUsername: true,
    },
    orderBy: { fullName: 'asc' },
  })
  const allUsers = allUserRecords.map((record) => ({
    ...record,
    permissions:
      record.permissions && typeof record.permissions === 'object' && !Array.isArray(record.permissions)
        ? (record.permissions as Record<string, boolean>)
        : {},
  }))

  const yandexSettingsRows = await prisma.systemSetting.findMany({
    where: { key: { in: ['yandex_disk_public_url', 'yandex_disk_token'] } }
  })
  let yandexPublicUrl = process.env.YANDEX_DISK_PUBLIC_URL || ''
  for (const r of yandexSettingsRows) {
    if (r.key === 'yandex_disk_public_url' && r.value) yandexPublicUrl = r.value
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-4 select-none">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-primary)]">
          <Settings className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
            Настройки системы
          </h1>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Интеграции, уведомления, доступы и команда в одном месте
          </p>
        </div>
      </div>

      <SettingsClient 
        initialChatId={chatId} 
        initialBotToken=""
        initialOwnerTag={ownerTag}
        initialWarehouseTag={warehouseTag}
        initialThresholds={thresholds}
        initialTopics={topics}
        initialNotifyFlags={notifyFlags}
        initialSiteUrl={siteUrl}
        initialAmoSettings={amoSettings}
        initialAvitoAccounts={avitoAccounts}
        initialYandexDiskPublicUrl={yandexPublicUrl}
        initialYandexDiskToken=""
        initialUsers={allUsers}
        currentUserId={profile.id}
      />
    </div>
  )
}
