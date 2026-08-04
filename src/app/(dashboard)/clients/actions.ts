'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { normalizePhoneNumber, validatePhoneNumber } from '@/utils/phone'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// Схема валидации клиента
const clientSchema = z.object({
  fullName: z.string().min(2, 'ФИО должно содержать минимум 2 символа'),
  primaryPhone: z.string().refine(val => validatePhoneNumber(val), {
    message: 'Некорректный номер телефона (ожидается мобильный РФ, например +79991234567)',
  }),
  additionalPhone: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  avitoAccount: z.string().optional().nullable(),
  comment: z.string().optional().nullable(),
})

async function checkManagerOrAbove() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  })

  if (!profile || !profile.isActive || !['admin', 'owner', 'manager'].includes(profile.role)) {
    redirect('/unauthorized')
  }

  return user.id
}

export async function createClientAction(data: z.infer<typeof clientSchema>) {
  try {
    const currentUserId = await checkManagerOrAbove()

    // Валидация входных данных
    const validatedData = clientSchema.parse(data)
    
    // Дополнительно нормализуем телефоны
    const primaryPhoneNormalized = normalizePhoneNumber(validatedData.primaryPhone)
    const additionalPhoneNormalized = validatedData.additionalPhone 
      ? normalizePhoneNumber(validatedData.additionalPhone) 
      : null

    // Проверяем на дубликат по основному телефону
    const existingClient = await prisma.client.findUnique({
      where: { primaryPhone: primaryPhoneNormalized },
    })

    if (existingClient) {
      return { error: 'Клиент с таким основным номером телефона уже существует' }
    }

    // Создаем запись клиента
    await prisma.client.create({
      data: {
        fullName: validatedData.fullName,
        primaryPhone: primaryPhoneNormalized,
        additionalPhone: additionalPhoneNormalized,
        region: validatedData.region,
        city: validatedData.city,
        address: validatedData.address,
        postalCode: validatedData.postalCode,
        source: validatedData.source,
        avitoAccount: validatedData.avitoAccount,
        comment: validatedData.comment,
        createdBy: currentUserId,
      },
    })

    revalidatePath('/clients')
    return { success: true }
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return { error: error.issues[0].message }
    }
    return { error: error instanceof Error ? error.message : 'Ошибка сервера' }
  }
}

export async function updateClientAction(clientId: string, data: z.infer<typeof clientSchema>) {
  try {
    await checkManagerOrAbove()

    const validatedData = clientSchema.parse(data)
    const primaryPhoneNormalized = normalizePhoneNumber(validatedData.primaryPhone)
    const additionalPhoneNormalized = validatedData.additionalPhone 
      ? normalizePhoneNumber(validatedData.additionalPhone) 
      : null

    // Проверяем, существует ли клиент
    const client = await prisma.client.findUnique({
      where: { id: clientId },
    })

    if (!client) {
      return { error: 'Клиент не найден' }
    }

    // Если телефон изменился, проверяем на дубликаты
    if (client.primaryPhone !== primaryPhoneNormalized) {
      const existingClient = await prisma.client.findUnique({
        where: { primaryPhone: primaryPhoneNormalized },
      })
      if (existingClient) {
        return { error: 'Другой клиент с таким основным телефоном уже существует' }
      }
    }

    await prisma.client.update({
      where: { id: clientId },
      data: {
        fullName: validatedData.fullName,
        primaryPhone: primaryPhoneNormalized,
        additionalPhone: additionalPhoneNormalized,
        region: validatedData.region,
        city: validatedData.city,
        address: validatedData.address,
        postalCode: validatedData.postalCode,
        source: validatedData.source,
        avitoAccount: validatedData.avitoAccount,
        comment: validatedData.comment,
      },
    })

    revalidatePath('/clients')
    return { success: true }
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return { error: error.issues[0].message }
    }
    return { error: error instanceof Error ? error.message : 'Ошибка сервера' }
  }
}

export async function archiveClientAction(clientId: string) {
  try {
    await checkManagerOrAbove()

    const client = await prisma.client.findUnique({
      where: { id: clientId },
    })

    if (!client) {
      return { error: 'Клиент не найден' }
    }

    await prisma.client.update({
      where: { id: clientId },
      data: {
        archivedAt: new Date(),
      },
    })

    revalidatePath('/clients')
    return { success: true }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Ошибка сервера' }
  }
}
