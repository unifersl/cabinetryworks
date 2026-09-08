import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Singleton PrismaClient with connection resilience.
 * No query logging to minimize memory and I/O overhead.
 *
 * If the PrismaClient instance is lost (e.g., after a hot reload in dev),
 * a new one is created automatically.
 */
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = new PrismaClient()

  // Graceful shutdown — disconnect on process exit to prevent
  // dangling connections that cause "database is locked" errors.
  process.on('beforeExit', async () => {
    try {
      await globalForPrisma.prisma?.$disconnect()
    } catch {
      // ignore disconnect errors during shutdown
    }
  })
}

export const db = globalForPrisma.prisma
