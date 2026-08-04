import prisma from '@/lib/prisma'
import ClientTable from './ClientTable'
import { Users2, MapPin } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    where: {
      archivedAt: null,
    },
    include: {
      creator: {
        select: {
          fullName: true,
          email: true,
        },
      },
      orders: {
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          items: {
            include: {
              variant: {
                include: {
                  product: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  const totalCount = clients.length
  const uniqueCities = new Set(clients.map(c => c.region || c.city).filter(Boolean)).size

  return (
    <div className="space-y-6">
      {/* Шапка */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
          <Users2 className="h-5 w-5 text-[var(--accent-primary)]" />
          База клиентов
        </h1>
        <p className="text-xs font-normal text-[var(--text-secondary)] mt-1">
          Управление базой клиентов, контактными данными, источниками рекламы и историей заказов
        </p>
      </div>

      {/* Статистика */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="erp-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Всего клиентов</p>
            <h3 className="text-xl font-semibold text-[var(--text-primary)] mt-0.5">{totalCount}</h3>
          </div>
          <div className="h-9 w-9 rounded-md bg-[var(--accent-soft)] text-[var(--accent-primary)] flex items-center justify-center font-medium">
            <Users2 className="h-4.5 w-4.5" />
          </div>
        </div>

        <div className="erp-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">География (регионы / города)</p>
            <h3 className="text-xl font-semibold text-[var(--text-primary)] mt-0.5">{uniqueCities}</h3>
          </div>
          <div className="h-9 w-9 rounded-md bg-[var(--accent-soft)] text-[var(--accent-primary)] flex items-center justify-center font-medium">
            <MapPin className="h-4.5 w-4.5" />
          </div>
        </div>
      </div>

      {/* Таблица и управление */}
      <ClientTable initialClients={clients} />
    </div>
  )
}
