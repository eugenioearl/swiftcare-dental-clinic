import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth, isAdminRole } from '@/lib/auth'
import {
  getWeeklyDoubleBookingConfig,
  saveWeeklyDoubleBookingConfig,
  WeeklyDoubleBookingConfig,
  DoubleBookingDayConfig,
} from '@/lib/booking-settings'

// GET /api/double-booking/weekly
// Returns the per-day-of-week double-booking configuration.
// Public (booking pages may consult this for capacity hints).
export async function GET() {
  try {
    const week = await getWeeklyDoubleBookingConfig()
    return NextResponse.json({ success: true, data: week })
  } catch (error) {
    console.error('Error fetching weekly double-booking config:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/double-booking/weekly
// Saves the per-day-of-week double-booking configuration. Admin only.
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user || !isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const incoming = body?.week ?? body

    if (!incoming || typeof incoming !== 'object') {
      return NextResponse.json(
        { error: 'Request body must include a `week` object with day-of-week keys (0-6).' },
        { status: 400 }
      )
    }

    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const normalized: WeeklyDoubleBookingConfig = {} as any

    for (let i = 0; i < 7; i++) {
      const entry = (incoming as any)[i] ?? (incoming as any)[String(i)]
      if (!entry || typeof entry !== 'object') {
        return NextResponse.json(
          { error: `Missing configuration for ${DAY_NAMES[i]} (index ${i})` },
          { status: 400 }
        )
      }
      const enabled = !!entry.enabled
      const max = parseInt(String(entry.maxPerSlot), 10)
      if (isNaN(max) || max < 1) {
        return NextResponse.json(
          { error: `${DAY_NAMES[i]}: maxPerSlot must be a positive integer (>=1).` },
          { status: 400 }
        )
      }
      if (max > 50) {
        return NextResponse.json(
          { error: `${DAY_NAMES[i]}: maxPerSlot cannot exceed 50.` },
          { status: 400 }
        )
      }
      normalized[i] = { enabled, maxPerSlot: max } satisfies DoubleBookingDayConfig
    }

    await saveWeeklyDoubleBookingConfig(normalized)
    return NextResponse.json({ success: true, data: normalized })
  } catch (error) {
    console.error('Error saving weekly double-booking config:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
