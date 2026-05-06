import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getClinicHoursForDate, parseTime } from '@/lib/clinic-hours'
import { getBookingSettings, effectiveMaxPerSlot } from '@/lib/booking-settings'

export const dynamic = 'force-dynamic'

const CLINIC_TZ = 'Asia/Manila'

function getClinicParts(d: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CLINIC_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d)
  const obj: Record<string, string> = {}
  for (const p of parts) if (p.type !== 'literal') obj[p.type] = p.value
  return {
    date: `${obj.year}-${obj.month}-${obj.day}`,
    hour: parseInt(obj.hour, 10),
    minute: parseInt(obj.minute, 10),
    dayOfWeek: new Intl.DateTimeFormat('en-US', {
      timeZone: CLINIC_TZ,
      weekday: 'short',
    }).format(d),
  }
}

// GET /api/book/slots?date=YYYY-MM-DD - Public endpoint for available time slots
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dateStr = searchParams.get('date')

    if (!dateStr) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 })
    }

    // Load clinic hours for this date - honors date-specific overrides,
    // then falls back to day-of-week weekly schedule, then legacy global default.
    const clinicHours = await getClinicHoursForDate(new Date(dateStr + 'T00:00:00'))

    if (clinicHours.isClosed) {
      return NextResponse.json({
        success: true,
        data: [],
        message: clinicHours.reason || 'Clinic is closed on this date',
      })
    }

    const open = parseTime(clinicHours.openTime)
    const close = parseTime(clinicHours.closeTime)

    // Generate 30-minute slots from open to close (last slot must START before close)
    const slots: { time: string; display: string; available: boolean; booked?: number; capacity?: number; full?: boolean }[] = []
    for (let hour = open.hours; hour <= close.hours; hour++) {
      const startMin = hour === open.hours ? open.minutes : 0
      for (let min = startMin; min < 60; min += 30) {
        // Don't start a slot at or after close
        if (hour > close.hours || (hour === close.hours && min >= close.minutes)) break
        // Skip lunch break 12:00-12:30 (only if clinic covers that range)
        if (hour === 12 && min === 0) continue

        const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`
        const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
        const ampm = hour >= 12 ? 'PM' : 'AM'
        const display = `${displayHour}:${String(min).padStart(2, '0')} ${ampm}`

        slots.push({ time: timeStr, display, available: true })
      }
    }

    // Check existing approved appointments on this date (Philippine Time UTC+8)
    const startOfDay = new Date(dateStr + 'T00:00:00.000+08:00')
    const endOfDay = new Date(dateStr + 'T23:59:59.999+08:00')

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        scheduledDatetime: { gte: startOfDay, lte: endOfDay },
        status: { in: ['scheduled', 'confirmed', 'checked_in', 'in_progress', 'waiting', 'pending'] },
      },
      select: { scheduledDatetime: true, durationMinutes: true },
    })

    // Count appointments per time slot - cap is admin-configurable (double booking)
    // Pass the date so we honor weekday and date-specific overrides.
    const bookingSettings = await getBookingSettings(new Date(dateStr + 'T00:00:00'))
    const MAX_PER_SLOT = effectiveMaxPerSlot(bookingSettings)
    const slotCounts: Record<string, number> = {}

    for (const appt of existingAppointments) {
      const apptTime = new Date(appt.scheduledDatetime)
      // Convert UTC time to Philippine Time (UTC+8) for slot matching
      const phtHours = (apptTime.getUTCHours() + 8) % 24
      const phtMins = apptTime.getUTCMinutes()
      const key = `${String(phtHours).padStart(2, '0')}:${String(phtMins).padStart(2, '0')}`
      slotCounts[key] = (slotCounts[key] || 0) + 1
    }

    for (const slot of slots) {
      const booked = slotCounts[slot.time] || 0
      slot.booked = booked
      slot.capacity = MAX_PER_SLOT
      if (booked >= MAX_PER_SLOT) {
        slot.available = false
        slot.full = true
      }
    }

    // Filter out past times if date is today (timezone-aware using Asia/Manila)
    const nowInClinic = getClinicParts(new Date())
    const requestedDateStr = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : getClinicParts(new Date(dateStr)).date
    const isToday = requestedDateStr === nowInClinic.date

    if (isToday) {
      // 15-minute buffer so patients can't book slots that are about to start
      const bufferMinutes = 15
      const nowMinutes = nowInClinic.hour * 60 + nowInClinic.minute + bufferMinutes
      for (const slot of slots) {
        const [h, m] = slot.time.split(':').map(Number)
        const slotMinutes = h * 60 + m
        if (slotMinutes <= nowMinutes) {
          slot.available = false
        }
      }
    }

    return NextResponse.json({ success: true, data: slots })
  } catch (error) {
    console.error('Error fetching slots:', error)
    return NextResponse.json({ error: 'Failed to load time slots' }, { status: 500 })
  }
}
