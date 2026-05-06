import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth, isAdminRole } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getClinicHoursForDate } from '@/lib/clinic-hours'

// GET /api/clinic-hours?date=2026-04-20 or ?from=2026-04-01&to=2026-04-30
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    // Single date query - public (needed for booking page)
    if (date) {
      const targetDate = new Date(date)
      const hours = await getClinicHoursForDate(targetDate)
      return NextResponse.json({ success: true, data: hours })
    }

    // Range query - admin only (for the management UI)
    if (from && to) {
      const session = await getServerAuth()
      if (!session?.user || !isAdminRole(session.user.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const fromDate = new Date(from)
      fromDate.setHours(0, 0, 0, 0)
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)

      const overrides = await prisma.clinicHours.findMany({
        where: {
          date: {
            gte: fromDate,
            lte: toDate
          }
        },
        orderBy: { date: 'asc' }
      })

      return NextResponse.json({ success: true, data: overrides })
    }

    return NextResponse.json({ error: 'Provide date or from/to range' }, { status: 400 })
  } catch (error) {
    console.error('Error fetching clinic hours:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/clinic-hours - Create or update clinic hours for a specific date
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user || !isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { date, openTime, closeTime, isClosed, reason } = body

    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 })
    }

    // Validate times
    if (!isClosed) {
      if (!openTime || !closeTime) {
        return NextResponse.json({ error: 'Open and close times are required when not closed' }, { status: 400 })
      }
      if (openTime >= closeTime) {
        return NextResponse.json({ error: 'Open time must be before close time' }, { status: 400 })
      }
    }

    const dateOnly = new Date(date)
    dateOnly.setHours(0, 0, 0, 0)

    const result = await prisma.clinicHours.upsert({
      where: { date: dateOnly },
      update: {
        openTime: isClosed ? '00:00' : openTime,
        closeTime: isClosed ? '00:00' : closeTime,
        isClosed: isClosed || false,
        reason: reason || null
      },
      create: {
        date: dateOnly,
        openTime: isClosed ? '00:00' : openTime,
        closeTime: isClosed ? '00:00' : closeTime,
        isClosed: isClosed || false,
        reason: reason || null
      }
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('Error saving clinic hours:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/clinic-hours?date=2026-04-20 - Reset to default hours
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user || !isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const date = request.nextUrl.searchParams.get('date')
    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 })
    }

    const dateOnly = new Date(date)
    dateOnly.setHours(0, 0, 0, 0)

    await prisma.clinicHours.deleteMany({
      where: { date: dateOnly }
    })

    return NextResponse.json({ success: true, message: 'Reset to default hours' })
  } catch (error) {
    console.error('Error deleting clinic hours:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
