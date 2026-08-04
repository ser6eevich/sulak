import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Отключаем значок режима разработки (N)
  devIndicators: false,
  // Разрешаем разработку с сетевого IP и туннелей
  allowedDevOrigins: [
    '192.168.2.41',
    '192.168.2.41:3000',
    '192.168.2.73',
    '192.168.2.73:3000',
    'localhost:3000',
    '127.0.0.1:3000',
    '*.loca.lt',
    '*.ngrok-free.app',
  ],
  experimental: {
    serverActions: {
      // Лимит загрузки изображений в Server Actions
      bodySizeLimit: '15mb',
      // Разрешаем Server Actions с внешних туннелей и любых локальных IP сети
      allowedOrigins: [
        'localhost:3000',
        '127.0.0.1:3000',
        '192.168.2.41:3000',
        '192.168.2.41',
        '192.168.2.73:3000',
        '*.loca.lt',
        '*.ngrok-free.app',
        '*.ngrok.io',
      ],
    },
  },
};

export default nextConfig;
