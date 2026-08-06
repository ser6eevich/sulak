import 'server-only'

import prisma from '@/lib/prisma'
import { decryptSecret } from '@/lib/settings/secret-crypto'

export async function getYandexDiskSettings() {
  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: ['yandex_disk_public_url', 'yandex_disk_token'] } },
    select: { key: true, value: true },
  })

  const values = Object.fromEntries(settings.map((setting) => [setting.key, setting.value.trim()]))
  return {
    publicUrl: values.yandex_disk_public_url || process.env.YANDEX_DISK_PUBLIC_URL?.trim() || '',
    oauthToken: values.yandex_disk_token
      ? decryptSecret(values.yandex_disk_token)
      : process.env.YANDEX_DISK_TOKEN?.trim() || '',
  }
}
