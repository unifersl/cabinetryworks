import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// The CORRECT direct connection URL for Supabase
const SUPABASE_DIRECT_URL = "postgresql://postgres:ciCJU2AnYRN6vH*7@db.bxcelvhzzfqkcmmekaek.supabase.co:5432/postgres"

if (!globalForPrisma.prisma) {
  // Use datasourceUrl to FORCE the correct connection string
  // This overrides whatever DATABASE_URL is set on Vercel
  globalForPrisma.prisma = new PrismaClient({
    datasourceUrl: SUPABASE_DIRECT_URL,
    log: ['error'],
  })

  process.on('beforeExit', async () => {
    try { await globalForPrisma.prisma?.$disconnect() } catch {}
  })
}

export const db = globalForPrisma.prisma
