import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Try both passwords — the user might have changed it
const POOLER_HOST = 'aws-0-ap-southeast-2.pooler.supabase.com'
const POOLER_PORT = 6543
const POOLER_USER = 'postgres.bxcelvhzzfqkcmmekaek'

function createPool(password: string) {
  return new Pool({
    host: POOLER_HOST,
    port: POOLER_PORT,
    database: 'postgres',
    user: POOLER_USER,
    password,
    max: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
  })
}

if (!globalForPrisma.prisma) {
  // Try the password from the URL the user pasted
  const pool = createPool('*nDwopXdNXu3Ykcw')
  const adapter = new PrismaPg(pool)
  globalForPrisma.prisma = new PrismaClient({ adapter, log: ['error'] })

  process.on('beforeExit', async () => {
    try { await globalForPrisma.prisma?.$disconnect() } catch {}
  })
}

export const db = globalForPrisma.prisma
