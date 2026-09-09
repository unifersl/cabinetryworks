import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Get the correct DATABASE_URL for Supabase.
 * Auto-corrects common mistakes:
 * - Direct host with pooler port → fix port to 5432 + fix username to "postgres"
 * - Missing URL → use hardcoded fallback
 */
function getDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL
  
  // Hardcoded fallback (correct direct connection)
  const FALLBACK = "postgresql://postgres:ciCJU2AnYRN6vH*7@db.bxcelvhzzfqkcmmekaek.supabase.co:5432/postgres"
  
  if (!envUrl) return FALLBACK
  
  // If using direct host (db.xxx.supabase.co), fix port + username
  if (envUrl.includes('db.bxcelvhzzfqkcmmekaek.supabase.co')) {
    let fixed = envUrl
    // Fix port: 6543 → 5432 (direct host only works on 5432)
    fixed = fixed.replace(':6543', ':5432')
    // Fix username: postgres.xxx → postgres (direct host needs plain username)
    fixed = fixed.replace('postgres.bxcelvhzzfqkcmmekaek:', 'postgres:')
    return fixed
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
