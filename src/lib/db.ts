import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Supabase Transaction Pooler URL (IPv4 compatible, works on Vercel)
const SUPABASE_POOLER_URL = "postgresql://postgres.bxcelvhzzfqkcmmekaek:%2AnDwopXdNXu3Ykcw@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres"

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = new PrismaClient({
    datasourceUrl: SUPABASE_POOLER_URL,
    log: ['error'],
  })

  process.on('beforeExit', async () => {
    try { await globalForPrisma.prisma?.$disconnect() } catch {}
  })
}

export const db = globalForPrisma.prisma
