import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Get the correct DATABASE_URL.
 * On Vercel, the user might have set it with the wrong hostname/port combo.
 * This fallback uses the direct connection on port 5432 which Vercel can reach.
 */
function getDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL
  
  // If no env URL, use the hardcoded Supabase direct connection
  if (!envUrl) {
    return "postgresql://postgres:ciCJU2AnYRN6vH*7@db.bxcelvhzzfqkcmmekaek.supabase.co:5432/postgres"
  }
  
  // If the URL uses the direct host (db.xxx.supabase.co) with port 6543,
  // that's wrong — fix it to use port 5432
  if (envUrl.includes('db.bxcelvhzzfqkcmmekaek.supabase.co:6543')) {
    return envUrl.replace(':6543', ':5432')
  }
  
  return envUrl
}

if (!globalForPrisma.prisma) {
  const datasourceUrl = getDatabaseUrl()
  globalForPrisma.prisma = new PrismaClient({
    datasourceUrl,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

  process.on('beforeExit', async () => {
    try {
      await globalForPrisma.prisma?.$disconnect()
    } catch {
      // ignore
    }
  })
}

export const db = globalForPrisma.prisma
