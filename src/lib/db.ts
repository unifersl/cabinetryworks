import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

if (!globalForPrisma.prisma) {
  const pool = new Pool({
    host: 'aws-0-ap-southeast-2.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.bxcelvhzzfqkcmmekaek',
    password: 'ciCJU2AnYRN6vH*7',
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
