import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrima = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

if (!globalForPrima.prisma) {
  // Use explicit params — pg Pool URL parsing is unreliable with special chars
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
  globalForPrima.prisma = new PrismaClient({ adapter, log: ['error'] })

  process.on('beforeExit', async () => {
    try { await globalForPrima.prisma?.$disconnect() } catch {}
  })
}

export const db = globalForPrima.prisma
