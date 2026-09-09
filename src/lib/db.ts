import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Fix the DATABASE_URL environment variable.
 * The user's Vercel DATABASE_URL uses pooler username (postgres.xxx) with
 * the direct host (db.xxx.supabase.co) — this doesn't work.
 * This function corrects it to use the direct connection format.
 */
function fixDatabaseUrl() {
  const envUrl = process.env.DATABASE_URL
  
  // Hardcoded correct fallback
  const CORRECT_URL = "postgresql://postgres:ciCJU2AnYRN6vH*7@db.bxcelvhzzfqkcmmekaek.supabase.co:5432/postgres"
  
  if (!envUrl) {
    process.env.DATABASE_URL = CORRECT_URL
    return
  }
  
  // If using direct host with pooler username or port, fix it
  if (envUrl.includes('db.bxcelvhzzfqkcmmekaek.supabase.co')) {
    let fixed = envUrl
    // Fix username: postgres.xxx → postgres
    fixed = fixed.replace(/postgres\.[a-z0-9]+:/, 'postgres:')
    // Fix port: 6543 → 5432
    fixed = fixed.replace(':6543', ':5432')
    process.env.DATABASE_URL = fixed
    console.log('[db] Fixed DATABASE_URL for direct connection')
    return
  }
  
  // If using pooler host, make sure pgbouncer is enabled
  if (envUrl.includes('pooler.supabase.com') && !envUrl.includes('pgbouncer')) {
    process.env.DATABASE_URL = envUrl + (envUrl.includes('?') ? '&' : '?') + 'pgbouncer=true'
    console.log('[db] Added pgbouncer=true to pooler URL')
  }
}

// Run the fix BEFORE creating PrismaClient
fixDatabaseUrl()

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = new PrismaClient({
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
