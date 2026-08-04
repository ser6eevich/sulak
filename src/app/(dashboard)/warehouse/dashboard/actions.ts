'use server'

import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

async function checkWarehouseOrAbove() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  })

  if (!profile || !profile.isActive || !['admin', 'owner', 'manager', 'warehouse'].includes(profile.role)) {
    redirect('/unauthorized')
  }

  return user.id
}

export async function updateStockAction(variantId: string, quantity: number) {
  try {
    const currentUserId = await checkWarehouseOrAbove()

    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: true }
    })

    if (!variant) {
      return { error: 'Вариант товара не найден' }
    }

    const oldStock = variant.stock
    const newStock = Math.max(0, quantity)

    await prisma.$transaction(async (tx) => {
      await tx.productVariant.update({
        where: { id: variantId },
        data: { stock: newStock },
      })

      // Логируем изменение остатка
      await tx.auditLog.create({
        data: {
          userId: currentUserId,
          entityType: 'product_variant',
          entityId: variantId,
          action: 'update_stock',
          oldData: { stock: oldStock },
          newData: { stock: newStock },
          comment: `Обновлен остаток товара ${variant.sku} (${variant.product.name}): с ${oldStock} до ${newStock} шт.`,
        },
      })
    })

    revalidatePath('/warehouse/dashboard')
    return { success: true }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Ошибка сервера' }
  }
}
