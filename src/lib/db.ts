import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Parse Supabase pooler URL from environment variable
// Falls back to direct connection for local dev
function getPoolConfig() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is not set')
  }

  // If it's a pooler URL (pooler.supabase.com), use it directly
  if (url.includes('pooler.supabase.com')) {
    return { connectionString: url, max: 1, idleTimeoutMillis: 30000, connectionTimeoutMillis: 15000 }
  }

  // For direct connections (local dev or direct Supabase)
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
