import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

if (!globalForPrisma.prisma) {
  // Use explicit connection params instead of URL string
  // This avoids URL parsing issues with special chars in password
  const pool = new Pool({
    host: 'aws-0-ap-southeast-2.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.bxcelvhzzfqkcmmekaek',
    password: '*nDwopXdNXu3Ykcw',  // raw password, no URL encoding needed
    max: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
  })
  const adapter = new PrismaPg(pool)
  globalForPrisma.prisma = new PrismaClient({ adapter, log: ['error'] })

  process.on('beforeExit', async () => {
    try { await globalForPrisma.prisma?.$disconnect() } catch {}
  })
}

export const db = globalForPrisma.prisma
