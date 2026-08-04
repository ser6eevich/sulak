import 'dotenv/config'
import prisma from '../lib/prisma'

async function main() {
  console.log('1. Добавляем колонку parent_id в product_folders...')
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE public.product_folders 
      ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.product_folders(id) ON DELETE CASCADE;
    `)
    console.log('- Колонка parent_id успешно проверена/добавлена.')
  } catch (error) {
    console.error('Ошибка при добавлении parent_id:', error)
  }

  console.log('2. Проверяем остальное...')
  try {
    // 1. Создаем таблицу product_folders
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.product_folders (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        category_id uuid NOT NULL,
        name text NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp with time zone NOT NULL DEFAULT now(),
        updated_at timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT product_folders_pkey PRIMARY KEY (id),
        CONSTRAINT product_folders_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.product_categories(id) ON DELETE CASCADE
      );
    `)
    console.log('- Таблица product_folders проверена/создана.')

    // 2. Добавляем колонку folder_id в products
    await prisma.$executeRawUnsafe(`
      ALTER TABLE public.products 
      ADD COLUMN IF NOT EXISTS folder_id uuid;
    `)
    console.log('- Колонка folder_id в таблице products проверена/добавлена.')

    // 3. Добавляем внешний ключ
    await prisma.$executeRawUnsafe(`
      ALTER TABLE public.products
      DROP CONSTRAINT IF EXISTS products_folder_id_fkey,
      ADD CONSTRAINT products_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.product_folders(id) ON DELETE SET NULL;
    `)
    console.log('- Внешний ключ products_folder_id_fkey проверен/добавлен.')

  } catch (error) {
    console.error('Ошибка при создании таблиц/колонок:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
