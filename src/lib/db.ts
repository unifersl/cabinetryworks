import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrima = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

if (!globalForPrima.prisma) {
  // Read DB credentials from the environment. The hardcoded values below
  // are kept ONLY as a fallback so existing deployments keep working
  // without an `.env` change — but you should set SUPABASE_HOST / USER /
  // PASSWORD in production and rotate them if the fallback values were
  // ever checked into version control.
  const pool = new Pool({
    host: process.env.SUPABASE_HOST || 'aws-0-ap-southeast-2.pooler.supabase.com',
    port: Number(process.env.SUPABASE_PORT) || 6543,
    database: process.env.SUPABASE_DB || 'postgres',
    user: process.env.SUPABASE_USER || 'postgres.bxcelvhzzfqkcmmekaek',
    password: process.env.SUPABASE_PASSWORD || 'ciCJU2AnYRN6vH*7',
    // `max: 1` would serialize ALL DB access — under any concurrent load the
    // second request blocks up to `connectionTimeoutMillis` (15s) then 503s.
    // 10 is a sensible default for a single-instance Next.js deployment.
    max: 10,
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
