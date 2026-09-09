import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const SUPABASE_URL = "postgresql://postgres.bxcelvhzzfqkcmmekaek:%2AnDwopXdNXu3Ykcw@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres"

if (!globalForPrisma.prisma) {
  // Use the pg adapter which handles serverless connections better than Prisma's Rust engine
  const pool = new Pool({ connectionString: SUPABASE_URL, max: 1, idleTimeoutMillis: 30000 })
  const adapter = new PrismaPg(pool)
  globalForPrisma.prisma = new PrismaClient({ adapter, log: ['error'] })

  process.on('beforeExit', async () => {
    try { await globalForPrisma.prisma?.$disconnect() } catch {}
  })
}

export const db = globalForPrisma.prisma
