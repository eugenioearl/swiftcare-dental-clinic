import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth, isAdminRole } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * Parse a YYYY-MM-DD string into a Date representing UTC midnight on that calendar date.
 * Avoids the local-timezone drift caused by `new Date("YYYY-MM-DD")` + `setHours(0,0,0,0)`.
 */
function parseDateStringUTC(s: string): Date | null {
  if (typeof s !== 'string') return null
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return new Date(Date.UTC(y, mo - 1, d))
}

/** Format a Date as YYYY-MM-DD using its UTC components. */
function formatDateUTC(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Serialize an override row, exposing `dateString` (YYYY-MM-DD) for unambiguous client comparisons. */
function serializeOverride(row: any) {
  if (!row) return null
  return {
    ...row,
    dateString: row.date instanceof Date ? formatDateUTC(row.date) : null,
  }
}

// GET /api/double-booking/overrides
// Query params: ?date=YYYY-MM-DD or ?from=YYYY-MM-DD&to=YYYY-MM-DD
// - Single date: returns the override for that date (or null) - public
// - Range: admin only - returns all overrides in the range
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    if (date) {
      const dateOnly = parseDateStringUTC(date)
      if (!dateOnly) {
        return NextResponse.json({ error: 'Invalid date format. Expected YYYY-MM-DD.' }, { status: 400 })
      }
      const override = await prisma.doubleBookingOverride.findFirst({
        where: { date: dateOnly },
      })
      return NextResponse.json({ success: true, data: serializeOverride(override) })
    }

    if (from && to) {
      const session = await getServerAuth()
      if (!session?.user || !isAdminRole(session.user.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const fromDate = parseDateStringUTC(from)
      const toDate = parseDateStringUTC(to)
      if (!fromDate || !toDate) {
        return NextResponse.json({ error: 'Invalid date format. Expected YYYY-MM-DD.' }, { status: 400 })
      }

      // Inclusive range: 'to' is end-of-day in UTC.
      const toEnd = new Date(toDate)
      toEnd.setUTCHours(23, 59, 59, 999)

      const overrides = await prisma.doubleBookingOverride.findMany({
        where: { date: { gte: fromDate, lte: toEnd } },
        orderBy: { date: 'asc' },
      })
      return NextResponse.json({ success: true, data: overrides.map(serializeOverride) })
    }

    return NextResponse.json({ error: 'Provide date or from/to range' }, { status: 400 })
  } catch (error) {
    console.error('Error fetching double-booking overrides:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/double-booking/overrides - Create or update overrides for one or more dates.
// Body: { date: "YYYY-MM-DD", ...overrideFields } OR { dates: ["YYYY-MM-DD", ...], ...overrideFields }
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user || !isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { date, dates, enabled, maxPerSlot, reason } = body ?? {}

    // Build the list of dates: support either `date` (single) or `dates` (array).
    const inputDates: string[] = Array.isArray(dates)
      ? dates.filter((d: any) => typeof d === 'string')
      : date
      ? [date]
      : []

    if (inputDates.length === 0) {
      return NextResponse.json({ error: 'At least one date is required (use `date` or `dates`).' }, { status: 400 })
    }

    // Parse and de-duplicate via the YYYY-MM-DD canonical form.
    const parsed: { dateOnly: Date; key: string }[] = []
    const seen = new Set<string>()
    for (const ds of inputDates) {
      const d = parseDateStringUTC(ds)
      if (!d) {
        return NextResponse.json(
          { error: `Invalid date format: ${ds}. Expected YYYY-MM-DD.` },
          { status: 400 }
        )
      }
      const key = formatDateUTC(d)
      if (!seen.has(key)) {
        seen.add(key)
        parsed.push({ dateOnly: d, key })
      }
    }

    const isEnabled = enabled === undefined ? true : !!enabled
    const max = parseInt(String(maxPerSlot), 10)
    if (isEnabled) {
      if (isNaN(max) || max < 1) {
        return NextResponse.json(
          { error: 'maxPerSlot must be a positive integer (>=1) when override is enabled.' },
          { status: 400 }
        )
      }
      if (max > 50) {
        return NextResponse.json(
          { error: 'maxPerSlot cannot exceed 50.' },
          { status: 400 }
        )
      }
    }

    const safeMax = isEnabled ? max : 1

    const results: any[] = []
    for (const p of parsed) {
      const r = await prisma.doubleBookingOverride.upsert({
        where: { date: p.dateOnly },
        update: {
          enabled: isEnabled,
          maxPerSlot: safeMax,
          reason: reason || null,
        },
        create: {
          date: p.dateOnly,
          enabled: isEnabled,
          maxPerSlot: safeMax,
          reason: reason || null,
        },
      })
      results.push(serializeOverride(r))
    }

    // Backward-compatible: if only one date, also expose under `data` as a single object.
    return NextResponse.json({
      success: true,
      count: results.length,
      data: results.length === 1 ? results[0] : results,
      results,
    })
  } catch (error) {
    console.error('Error saving double-booking override:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/double-booking/overrides?date=YYYY-MM-DD - Reset that date to weekly/global default
// Also accepts ?dates=YYYY-MM-DD,YYYY-MM-DD,... for bulk reset.
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user || !isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date')
    const datesCsv = searchParams.get('dates')

    const inputDates: string[] = datesCsv
      ? datesCsv.split(',').map((s) => s.trim()).filter(Boolean)
      : date
      ? [date]
      : []

    if (inputDates.length === 0) {
      return NextResponse.json({ error: 'At least one date is required.' }, { status: 400 })
    }

    const parsed: Date[] = []
    for (const ds of inputDates) {
      const d = parseDateStringUTC(ds)
      if (!d) {
        return NextResponse.json(
          { error: `Invalid date format: ${ds}. Expected YYYY-MM-DD.` },
          { status: 400 }
        )
      }
      parsed.push(d)
    }

    const result = await prisma.doubleBookingOverride.deleteMany({
      where: { date: { in: parsed } },
    })

    return NextResponse.json({
      success: true,
      message: 'Override(s) reset to default',
      count: result.count,
    })
  } catch (error) {
    console.error('Error deleting double-booking override:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
