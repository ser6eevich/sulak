'use server'

import { dashboardService } from '@/lib/analytics/DashboardService'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function getDailyReportAction(
  dateString: string,
  manualInputs?: { missedCalls?: number; totalLeads?: number }
) {
  try {
    const reportData = await dashboardService.getDashboardStats(dateString, manualInputs)
    return { success: true, report: reportData }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Ошибка при формировании отчёта' }
  }
}

export async function saveAmoCrmCredentialsAction(data: {
  subdomain: string
  clientId: string
  clientSecret: string
  accessToken: string
  refreshToken?: string
}) {
  try {
    const expiresAt = (Date.now() + 86400 * 1000).toString()

    const upserts = [
      prisma.systemSetting.upsert({
        where: { key: 'amocrm_subdomain' },
        update: { value: data.subdomain.trim() },
        create: { key: 'amocrm_subdomain', value: data.subdomain.trim() },
      }),
      prisma.systemSetting.upsert({
        where: { key: 'amocrm_client_id' },
        update: { value: data.clientId.trim() },
        create: { key: 'amocrm_client_id', value: data.clientId.trim() },
      }),
      prisma.systemSetting.upsert({
        where: { key: 'amocrm_client_secret' },
        update: { value: data.clientSecret.trim() },
        create: { key: 'amocrm_client_secret', value: data.clientSecret.trim() },
      }),
      prisma.systemSetting.upsert({
        where: { key: 'amocrm_access_token' },
        update: { value: data.accessToken.trim() },
        create: { key: 'amocrm_access_token', value: data.accessToken.trim() },
      }),
      prisma.systemSetting.upsert({
        where: { key: 'amocrm_expires_at' },
        update: { value: expiresAt },
        create: { key: 'amocrm_expires_at', value: expiresAt },
      }),
    ]

    if (data.refreshToken) {
      upserts.push(
        prisma.systemSetting.upsert({
          where: { key: 'amocrm_refresh_token' },
          update: { value: data.refreshToken.trim() },
          create: { key: 'amocrm_refresh_token', value: data.refreshToken.trim() },
        })
      )
    }

    await prisma.$transaction(upserts)
    revalidatePath('/settings')
    return { success: true }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Ошибка при сохранении ключей amoCRM' }
  }
}

export async function getAmoCrmSettingsAction() {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            'amocrm_subdomain',
            'amocrm_client_id',
            'amocrm_client_secret',
            'amocrm_access_token',
            'amocrm_refresh_token',
            'amocrm_expires_at',
          ],
        },
      },
    })

    const map: Record<string, string> = {}
    for (const s of settings) map[s.key] = s.value

    return {
      subdomain: map['amocrm_subdomain'] || '',
      clientId: map['amocrm_client_id'] || '',
      clientSecret: map['amocrm_client_secret'] || '',
      accessToken: map['amocrm_access_token'] || '',
      refreshToken: map['amocrm_refresh_token'] || '',
      isConnected: !!(map['amocrm_subdomain'] && map['amocrm_access_token']),
    }
  } catch {
    return {
      subdomain: '',
      clientId: '',
      clientSecret: '',
      accessToken: '',
      refreshToken: '',
      isConnected: false,
    }
  }
}
