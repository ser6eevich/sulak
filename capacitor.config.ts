import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'ru.sulak.crm',
  appName: 'Сулак CRM',
  webDir: 'public',
  server: {
    // Подключение к локальному серверу Next.js в сети Wi-Fi на Mac
    url: process.env.CAPACITOR_SERVER_URL || 'http://192.168.2.41:3000',
    cleartext: true,
  },
  ios: {
    contentInset: 'always',
    allowsLinkPreview: false,
    scrollEnabled: true,
  },
}

export default config
