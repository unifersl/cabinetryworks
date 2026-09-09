import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function getPoolConfig() {
  let url = process.env.DATABASE_URL
  
  if (!url) {
    // Fallback to correct pooler URL if env var not set
    url = 'postgresql://postgres.bxcelvhzzfqkcmmekaek:ciCJU2AnYRN6vH*7@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres'
  }
  
  // Auto-correct: if using direct host (db.xxx.supabase.co), switch to pooler
  if (url.includes('db.bxcelvhzzfqkcmmekaek.supabase.co')) {
    url = 'postgresql://postgres.bxcelvhzzfqkcmmekaek:ciCJU2AnYRN6vH*7@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres'
  }
  
  return { connectionString: url, max: 1, idleTimeoutMillis: 30000, connectionTimeoutMillis: 15000 }
}

if (!globalForPrisma.prisma) {
  const pool = new Pool(getPoolConfig())
  const adapter = new PrismaPg(pool)
  globalForPrisma.prisma = new PrismaClient({ adapter, log: ['error'] })

  process.on('beforeExit', async () => {
    try { await globalForPrisma.prisma?.$disconnect() } catch {}
  })
}

export const db = globalForPrisma.prisma
