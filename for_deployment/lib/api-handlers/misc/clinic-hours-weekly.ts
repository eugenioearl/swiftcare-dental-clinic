import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth, isAdminRole } from '@/lib/auth'
import {
  getWeeklyClinicHours,
  saveWeeklyClinicHours,
  WeeklyClinicHours,
  WeekdayClinicHours,
} from '@/lib/clinic-hours'

// GET /api/clinic-hours/weekly - Get per-day-of-week clinic hours (public - needed for booking UI)
export async function GET() {
  try {
    const week = await getWeeklyClinicHours()
    return NextResponse.json({ success: true, data: week })
  } catch (error) {
    console.error('Error fetching weekly clinic hours:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/clinic-hours/weekly - Save per-day-of-week clinic hours (admin only)
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

    // Validate each day entry
    const normalized: WeeklyClinicHours = {} as any
    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    for (let i = 0; i < 7; i++) {
      const entry = incoming[i] ?? incoming[String(i)]
      if (!entry || typeof entry !== 'object') {
        return NextResponse.json(
          { error: `Missing configuration for ${DAY_NAMES[i]} (index ${i})` },
          { status: 400 }
        )
      }
      const { openTime, closeTime, isClosed } = entry as WeekdayClinicHours
      if (!openTime || !closeTime) {
        return NextResponse.json(
          { error: `${DAY_NAMES[i]} requires both openTime and closeTime` },
          { status: 400 }
        )
      }
      // Validate HH:mm format
      const timeRe = /^([0-1]\d|2[0-3]):[0-5]\d$/
      if (!timeRe.test(openTime) || !timeRe.test(closeTime)) {
        return NextResponse.json(
          { error: `${DAY_NAMES[i]} has invalid time format. Use HH:mm (24-hour).` },
          { status: 400 }
        )
      }
      if (!isClosed && openTime >= closeTime) {
        return NextResponse.json(
          { error: `${DAY_NAMES[i]}: opening time must be before closing time` },
          { status: 400 }
        )
      }
      normalized[i] = {
        openTime,
        closeTime,
        isClosed: !!isClosed,
      }
    }

    await saveWeeklyClinicHours(normalized)
    return NextResponse.json({ success: true, data: normalized })
  } catch (error) {
    console.error('Error saving weekly clinic hours:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
