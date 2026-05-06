import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

/**
 * Generic helper: find the next sequence number for any table/column with a PREFIX-NNNNN pattern.
 * Uses raw SQL MAX to avoid collisions from deleted rows.
 * @param table  - actual DB table name (snake_case)
 * @param column - actual DB column name (snake_case)
 * @param prefix - e.g. 'PAY-', 'PKG-', 'INV-2026-', 'A-2026-', 'P-2026-', 'EMP-', 'APT-', 'CON-'
 * @param padLen - how many digits to pad (default 5)
 */
export async function nextSequenceNumber(
  table: string,
  column: string,
  prefix: string,
  padLen = 5
): Promise<string> {
  const prefixLen = prefix.length + 1 // SQL SUBSTRING is 1-based
  const result: any[] = await prisma.$queryRawUnsafe(
    `SELECT MAX(CAST(SUBSTRING(${column} FROM ${prefixLen}) AS INTEGER)) AS max_num FROM ${table} WHERE ${column} LIKE '${prefix}%'`
  )
  const maxNum = result[0]?.max_num ?? 0
  return `${prefix}${String(maxNum + 1).padStart(padLen, '0')}`
}

/**
 * Generate a unique consent number like CON-00042.
 * Uses raw SQL MAX to find the highest existing number reliably,
 * avoiding collisions from deleted rows or string-sort issues.
 * Includes retry logic for concurrent-request race conditions.
 */
export async function nextConsentNumber(): Promise<string> {
  const result: any[] = await prisma.$queryRawUnsafe(
    `SELECT MAX(CAST(SUBSTRING(consent_number FROM 5) AS INTEGER)) AS max_num FROM consent_forms WHERE consent_number LIKE 'CON-%'`
  )
  const maxNum = result[0]?.max_num ?? 0
  return `CON-${String(maxNum + 1).padStart(5, '0')}`
}

/**
 * Create a ConsentForm with automatic retry on consent_number collision.
 * Retries up to 5 times, each time recalculating the next number.
 */
export async function createConsentFormSafe(data: any): Promise<any> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const consentNumber = await nextConsentNumber()
      return await prisma.consentForm.create({
        data: { ...data, consentNumber },
      })
    } catch (err: any) {
      // P2002 = Unique constraint violation
      if (err.code === 'P2002' && err.meta?.target?.includes('consent_number')) {
        console.warn(`Consent number collision (attempt ${attempt + 1}), retrying...`)
        continue
      }
      throw err
    }
  }
  throw new Error('Failed to generate unique consent number after 5 attempts')
}
