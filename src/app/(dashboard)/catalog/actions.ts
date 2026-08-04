'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// Схема валидации варианта товара
const variantSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  sku: z.string().min(2, 'Артикул должен быть не менее 2 символов'),
  size: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  material: z.string().optional().nullable(),
  thickness: z.string().optional().nullable(),
  purchasePrice: z.number().min(0, 'Цена закупки не может быть отрицательной'),
  salePrice: z.number().min(0, 'Цена продажи не может быть отрицательной'),
  weight: z.number().optional().nullable(),
  volume: z.number().optional().nullable(),
  attributes: z.any().optional().nullable(),
})

// Схема валидации товара
const productSchema = z.object({
  name: z.string().min(2, 'Название товара должно быть не менее 2 символов'),
  categoryId: z.string().uuid('Некорректная категория'),
  folderId: z.string().uuid('Некорректная папка').optional().nullable(),
  description: z.string().optional().nullable(),
  baseSku: z.string().min(2, 'Базовый артикул должен быть не менее 2 символов'),
  unit: z.string().default('шт'),
  trackInventory: z.boolean().default(true),
})

async function checkAdminOrOwner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  })

  if (!profile || !profile.isActive || !['admin', 'owner'].includes(profile.role)) {
    throw new Error('Добавлять и редактировать каталог может только администратор')
  }

  return user.id
}

// Экшен создания папки
export async function createFolderAction(categoryId: string, name: string, parentId?: string | null) {
  try {
    await checkAdminOrOwner()

    if (!name || name.trim().length < 2) {
      return { error: 'Название папки должно быть не менее 2 символов' }
    }

    const folder = await prisma.productFolder.create({
      data: {
        categoryId,
        name: name.trim(),
        parentId: parentId || null,
      },
    })

    revalidatePath('/catalog')
    return { success: true, folder }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Ошибка сервера' }
  }
}

// Экшен удаления папки
export async function deleteFolderAction(folderId: string) {
  try {
    await checkAdminOrOwner()

    await prisma.productFolder.delete({
      where: { id: folderId },
    })

    revalidatePath('/catalog')
    return { success: true }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Ошибка сервера' }
  }
}

// Создание товара с вариантами
export async function createProductWithVariantsAction(
  productData: z.infer<typeof productSchema>,
  variants: z.infer<typeof variantSchema>[]
) {
  try {
    await checkAdminOrOwner()

    const validatedProduct = productSchema.parse(productData)
    const validatedVariants = z.array(variantSchema).parse(variants)
    
    if (validatedVariants.length === 0) {
      return { error: 'Необходимо добавить хотя бы один вариант товара' }
    }

    // Проверяем уникальность SKU вариантов перед транзакцией
    const skus = validatedVariants.map(v => v.sku.trim())
    const uniqueSkus = new Set(skus)
    if (skus.length !== uniqueSkus.size) {
      return { error: 'Артикулы вариантов товара должны быть уникальными' }
    }

    // Выполняем создание в транзакции
    await prisma.$transaction(async (tx) => {
      // 1. Проверяем, не заняты ли артикулы в БД у АКТИВНЫХ вариантов
      for (const sku of skus) {
        const existing = await tx.productVariant.findFirst({
          where: { sku, isActive: true },
        })
        if (existing) {
          throw new Error(`Артикул "${sku}" уже занят другим товаром`)
        }
      }

      // 2. Создаем товар
      const product = await tx.product.create({
        data: {
          name: validatedProduct.name,
          categoryId: validatedProduct.categoryId,
          folderId: validatedProduct.folderId || null,
          description: validatedProduct.description,
          baseSku: validatedProduct.baseSku,
          unit: validatedProduct.unit,
          trackInventory: validatedProduct.trackInventory,
        },
      })

      // 3. Создаем варианты (переводя цены из рублей в копейки)
      for (const variant of validatedVariants) {
        await tx.productVariant.create({
          data: {
            productId: product.id,
            sku: variant.sku.trim(),
            size: variant.size,
            color: variant.color,
            material: variant.material,
            thickness: variant.thickness,
            purchasePrice: Math.round(variant.purchasePrice * 100), // рубли -> копейки
            salePrice: Math.round(variant.salePrice * 100),         // рубли -> копейки
            weight: variant.weight,
            volume: variant.volume,
            attributes: variant.attributes || null,
          },
        })
      }
    }, {
      maxWait: 15000,
      timeout: 30000
    })

    // Возвращаем созданный товар со всеми вариантами для мгновенного обновления UI
    const createdProduct = await prisma.product.findFirst({
      where: { baseSku: validatedProduct.baseSku.trim().toUpperCase(), isActive: true },
      include: {
        category: true,
        folder: true,
        variants: { where: { isActive: true }, orderBy: { sku: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    })

    revalidatePath('/catalog')
    return { success: true, product: createdProduct }
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return { error: error.issues[0].message }
    }
    return { error: error instanceof Error ? error.message : 'Ошибка сервера' }
  }
}

// Редактирование товара с вариантами
export async function updateProductWithVariantsAction(
  productId: string,
  productData: z.infer<typeof productSchema>,
  variants: z.infer<typeof variantSchema>[]
) {
  try {
    await checkAdminOrOwner()

    const validatedProduct = productSchema.parse(productData)
    const validatedVariants = z.array(variantSchema).parse(variants)

    if (validatedVariants.length === 0) {
      return { error: 'Необходимо оставить хотя бы один вариант товара' }
    }

    const skus = validatedVariants.map(v => v.sku.trim())
    const uniqueSkus = new Set(skus)
    if (skus.length !== uniqueSkus.size) {
      return { error: 'Артикулы вариантов товара должны быть уникальными' }
    }

    await prisma.$transaction(async (tx) => {
      // 1. Проверяем, не заняты ли артикулы другими товарами (за исключением редактируемых вариантов этого же товара)
      for (const variant of validatedVariants) {
        const existing = await tx.productVariant.findFirst({
          where: { 
            sku: variant.sku.trim(),
            isActive: true,
            NOT: {
              productId: productId // Исключаем этот товар
            }
          },
        })
        if (existing) {
          throw new Error(`Артикул "${variant.sku}" уже занят другим товаром`)
        }
      }

      // 2. Обновляем сам товар
      await tx.product.update({
        where: { id: productId },
        data: {
          name: validatedProduct.name,
          categoryId: validatedProduct.categoryId,
          folderId: validatedProduct.folderId || null,
          description: validatedProduct.description,
          baseSku: validatedProduct.baseSku,
          unit: validatedProduct.unit,
          trackInventory: validatedProduct.trackInventory,
          updatedAt: new Date()
        }
      })

      // 3. Получаем список текущих вариантов в базе данных
      const dbVariants = await tx.productVariant.findMany({
        where: { productId, isActive: true }
      })

      const incomingIds = validatedVariants.map(v => v.id).filter(Boolean) as string[]

      // Варианты на софт-делет (архивацию): те, что есть в БД, но отсутствуют в присланном списке
      const variantsToArchive = dbVariants.filter(dbv => !incomingIds.includes(dbv.id))
      for (const vToArchive of variantsToArchive) {
        await tx.productVariant.update({
          where: { id: vToArchive.id },
          data: {
            isActive: false,
            sku: `${vToArchive.sku}-archived-${Date.now()}` // Освобождаем артикул
          }
        })
      }

      // 4. Обрабатываем присланные варианты: обновление или создание
      for (const variant of validatedVariants) {
        if (variant.id) {
          // Обновляем существующий вариант
          await tx.productVariant.update({
            where: { id: variant.id },
            data: {
              sku: variant.sku.trim(),
              size: variant.size,
              color: variant.color,
              material: variant.material,
              thickness: variant.thickness,
              purchasePrice: Math.round(variant.purchasePrice * 100),
              salePrice: Math.round(variant.salePrice * 100),
              weight: variant.weight,
              volume: variant.volume,
              attributes: variant.attributes || null,
            }
          })
        } else {
          // Создаем новый вариант
          await tx.productVariant.create({
            data: {
              productId,
              sku: variant.sku.trim(),
              size: variant.size,
              color: variant.color,
              material: variant.material,
              thickness: variant.thickness,
              purchasePrice: Math.round(variant.purchasePrice * 100),
              salePrice: Math.round(variant.salePrice * 100),
              weight: variant.weight,
              volume: variant.volume,
              attributes: variant.attributes || null,
            }
          })
        }
      }
    }, {
      maxWait: 15000,
      timeout: 30000
    })

    // Возвращаем обновлённый товар со всеми вариантами для мгновенного обновления UI
    const updatedProduct = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        folder: true,
        variants: { where: { isActive: true }, orderBy: { sku: 'asc' } },
      },
    })

    revalidatePath('/catalog')
    return { success: true, product: updatedProduct }
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return { error: error.issues[0].message }
    }
    return { error: error instanceof Error ? error.message : 'Ошибка сервера' }
  }
}

// Архивируем товар и все его варианты
export async function archiveProductAction(productId: string) {
  try {
    await checkAdminOrOwner()

    const product = await prisma.product.findUnique({
      where: { id: productId },
    })

    if (!product) {
      return { error: 'Товар не найден' }
    }

    await prisma.$transaction(async (tx) => {
      // Архивируем товар
      await tx.product.update({
        where: { id: productId },
        data: {
          isActive: false,
          archivedAt: new Date(),
        },
      })

      // Получаем все его варианты для корректного освобождения SKU
      const variants = await tx.productVariant.findMany({
        where: { productId }
      })

      // Переименовываем SKU каждого варианта, чтобы артикулы стали свободными
      for (const variant of variants) {
        const archivedSku = variant.sku.includes('-archived-') 
          ? variant.sku 
          : `${variant.sku}-archived-${Date.now()}`

        await tx.productVariant.update({
          where: { id: variant.id },
          data: {
            isActive: false,
            sku: archivedSku
          },
        })
      }
    })

    revalidatePath('/catalog')
    return { success: true }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Ошибка сервера' }
  }
}
