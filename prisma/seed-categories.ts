// @ts-nocheck
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const categories = [
  { name: 'Столы', slug: 'tables', sortOrder: 1 },
  { name: 'Стулья', slug: 'chairs', sortOrder: 2 },
  { name: 'Комплекты', slug: 'sets', sortOrder: 3 },
  { name: 'Диваны', slug: 'sofas', sortOrder: 4 },
]

async function seed() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('DATABASE_URL is not set')
    return
  }
  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  try {
    console.log('Seeding categories...')
    for (const cat of categories) {
      await prisma.productCategory.upsert({
        where: { slug: cat.slug },
        update: { name: cat.name, sortOrder: cat.sortOrder },
        create: { name: cat.name, slug: cat.slug, sortOrder: cat.sortOrder },
      })
      console.log(`- Category "${cat.name}" seeded successfully.`)
    }
    console.log('Seeding completed!')
  } catch (error) {
    console.error('Seeding error:', error)
  } finally {
    await pool.end()
  }
}

seed()
