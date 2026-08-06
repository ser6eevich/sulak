import prisma from '@/lib/prisma'
import ClientTable from './ClientTable'
import { MapPin, ShoppingBag, Users2 } from 'lucide-react'

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
        select: {
          id: true,
          number: true,
          status: true,
          totalPrice: true,
          discount: true,
          deliveryPrice: true,
          assemblyPrice: true,
          createdAt: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  const totalCount = clients.length
  const uniqueCities = new Set(clients.map(c => c.region || c.city).filter(Boolean)).size
  const totalOrders = clients.reduce((total, client) => total + client.orders.length, 0)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.035em] text-[var(--text-primary)]">
          База клиентов
        </h1>
        <p className="mt-1 text-xs font-normal text-[var(--text-secondary)]">
          Управление базой клиентов, контактными данными, источниками рекламы и историей заказов
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="erp-card flex min-h-[94px] items-center justify-between px-5 py-4">
          <div>
            <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Всего клиентов</p>
            <p className="mt-2 text-[22px] font-medium leading-none tracking-[-0.035em] text-[var(--text-primary)]">{totalCount}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
            <Users2 className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </div>
        </div>

        <div className="erp-card flex min-h-[94px] items-center justify-between px-5 py-4">
          <div>
            <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Регионы и города</p>
            <p className="mt-2 text-[22px] font-medium leading-none tracking-[-0.035em] text-[var(--text-primary)]">{uniqueCities}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
            <MapPin className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </div>
        </div>

        <div className="erp-card flex min-h-[94px] items-center justify-between px-5 py-4">
          <div>
            <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Заказов клиентов</p>
            <p className="mt-2 text-[22px] font-medium leading-none tracking-[-0.035em] text-[var(--text-primary)]">{totalOrders}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
            <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </div>
        </div>
      </div>

      <ClientTable initialClients={clients} />
    </div>
  )
}
