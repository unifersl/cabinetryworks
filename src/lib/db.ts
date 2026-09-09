import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Supabase Transaction Pooler URL with pgbouncer + connection_limit for serverless
const SUPABASE_URL = "postgresql://postgres.bxcelvhzzfqkcmmekaek:%2AnDwopXdNXu3Ykcw@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&pool_timeout=20"

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = new PrismaClient({
    datasourceUrl: SUPABASE_URL,
    log: ['error'],
  })

  process.on('beforeExit', async () => {
    try { await globalForPrisma.prisma?.$disconnect() } catch {}
  })
}

export const db = globalForPrisma.prisma
