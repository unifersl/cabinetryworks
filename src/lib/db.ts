import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Singleton PrismaClient.
 * On Vercel serverless, the DATABASE_URL env var is used automatically.
 * Connection pooling is handled by Prisma + Supabase pgBouncer.
 */
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
