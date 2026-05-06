
import { NextRequest, NextResponse } from "next/server"
import { getServerAuth, canAccessAppointments } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { format, parseISO, addMinutes, setHours, setMinutes } from 'date-fns'
import { getClinicHoursForDate, parseTime } from "@/lib/clinic-hours"

const availabilitySchema = z.object({
  date: z.string(),
  dentistId: z.string().optional(),
  durationMinutes: z.number().default(30),
  appointmentType: z.string().optional()
})

// GET /api/calendar/availability - Get detailed availability for scheduling
export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canAccessAppointments(session.user?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date')
    const dentistId = searchParams.get('dentistId')
    const durationMinutes = parseInt(searchParams.get('durationMinutes') || '30')
    const appointmentType = searchParams.get('appointmentType')

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 })
    }

    const targetDate = parseISO(date)
    
    // Get dynamic clinic hours for this date
    const clinicHours = await getClinicHoursForDate(targetDate)
    
    if (clinicHours.isClosed) {
      return NextResponse.json({
        success: true,
        data: {
          date,
          durationMinutes,
          appointmentType: appointmentType || 'consultation',
          slots: [],
          clinicClosed: true,
          closedReason: clinicHours.reason || 'Clinic is closed on this date',
          summary: { totalSlots: 0, availableSlots: 0, fullyBookedSlots: 0, averageUtilization: 0, peakHours: [], recommendedSlots: [] },
          dentists: []
        }
      })
    }

    const open = parseTime(clinicHours.openTime)
    const close = parseTime(clinicHours.closeTime)
    const startOfDay = setHours(setMinutes(targetDate, open.minutes), open.hours)
    const endOfDay = setHours(setMinutes(targetDate, close.minutes), close.hours)

    // Generate all possible time slots (every 15 minutes)
    const timeSlots = []
    let currentTime = startOfDay
    
    while (currentTime < endOfDay) {
      // Don't create slots that would run past business hours
      const appointmentEnd = addMinutes(currentTime, durationMinutes)
      if (appointmentEnd <= endOfDay) {
        timeSlots.push({
          time: format(currentTime, 'HH:mm'),
          datetime: currentTime.toISOString(),
          available: true,
          availableDentists: [],
          conflicts: []
        })
      }
      currentTime = addMinutes(currentTime, 15) // 15-minute intervals
    }

    // Get all dentists or specific dentist
    const dentistFilter = dentistId ? { id: dentistId } : {}
    const dentists = await prisma.dentist.findMany({
      where: {
        ...dentistFilter,
        isAvailable: true,
        user: { isActive: true }
      },
      include: {
        user: {
          select: { firstName: true, lastName: true }
        }
      }
    })

    // Get existing appointments for the date
    const existingAppointments = await prisma.appointment.findMany({
      where: {
        scheduledDatetime: {
          gte: startOfDay,
          lt: endOfDay
        },
        status: { notIn: ['cancelled', 'no_show'] },
        ...(dentistId && { dentistId })
      },
      include: {
        dentist: {
          select: {
            id: true,
            user: { select: { firstName: true, lastName: true } }
          }
        },
        patient: {
          select: {
            user: { select: { firstName: true, lastName: true } }
          }
        }
      }
    })

    // Check availability for each time slot
    const availableSlots = timeSlots.map(slot => {
      const slotStart = parseISO(slot.datetime)
      const slotEnd = addMinutes(slotStart, durationMinutes)
      
      const availableDentists: any[] = []
      const conflicts: any[] = []

      dentists.forEach(dentist => {
        // Check if dentist has conflicting appointments
        const dentistConflicts = existingAppointments.filter(apt => 
          apt.dentistId === dentist.id
        ).filter(apt => {
          const aptStart = apt.scheduledDatetime
          const aptEnd = addMinutes(aptStart, apt.durationMinutes)
          
          // Check for overlap
          return (slotStart < aptEnd && slotEnd > aptStart)
        })

        if (dentistConflicts.length === 0) {
          availableDentists.push({
            id: dentist.id,
            name: `Dr. ${dentist.user?.lastName}, ${dentist.user?.firstName}`,
            specialization: dentist.specialization
          })
        } else {
          dentistConflicts.forEach(conflict => {
            conflicts.push({
              dentistId: dentist.id,
              dentistName: `Dr. ${dentist.user?.lastName}, ${dentist.user?.firstName}`,
              conflictWith: `${conflict.patient.user?.lastName}, ${conflict.patient.user?.firstName}`,
              conflictTime: format(conflict.scheduledDatetime, 'HH:mm')
            })
          })
        }
      })

      return {
        ...slot,
        available: availableDentists.length > 0,
        availableDentists,
        totalDentists: dentists.length,
        conflicts,
        utilizationPercent: Math.round(((dentists.length - availableDentists.length) / dentists.length) * 100)
      }
    })

    // Calculate summary statistics
    const summary = {
      totalSlots: availableSlots.length,
      availableSlots: availableSlots.filter(s => s.available).length,
      fullyBookedSlots: availableSlots.filter(s => !s.available).length,
      averageUtilization: Math.round(
        availableSlots.reduce((sum, slot) => sum + slot.utilizationPercent, 0) / availableSlots.length
      ),
      peakHours: availableSlots
        .filter(s => s.utilizationPercent > 75)
        .map(s => s.time)
        .slice(0, 5), // Top 5 busiest times
      recommendedSlots: availableSlots
        .filter(s => s.available && s.availableDentists.length >= 2)
        .slice(0, 10) // Top 10 recommended slots with multiple dentists available
    }

    return NextResponse.json({
      success: true,
      data: {
        date,
        durationMinutes,
        appointmentType: appointmentType || 'consultation',
        slots: availableSlots,
        summary,
        dentists: dentists.map(d => ({
          id: d.id,
          name: `Dr. ${d.user?.lastName}, ${d.user?.firstName}`,
          specialization: d.specialization
        }))
      }
    })

  } catch (error) {
    console.error("Error fetching availability:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/calendar/availability - Check specific time availability
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canAccessAppointments(session.user?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { date, dentistId, durationMinutes, appointmentType } = availabilitySchema.parse(body)

    const targetDateTime = parseISO(date)
    const endDateTime = addMinutes(targetDateTime, durationMinutes)

    // Get dynamic clinic hours for this date
    const postClinicHours = await getClinicHoursForDate(targetDateTime)
    
    if (postClinicHours.isClosed) {
      return NextResponse.json({
        success: true,
        data: {
          available: false,
          reason: postClinicHours.reason || 'Clinic is closed on this date',
          suggestedTimes: []
        }
      })
    }

    const postOpen = parseTime(postClinicHours.openTime)
    const postClose = parseTime(postClinicHours.closeTime)
    const businessStart = setHours(setMinutes(targetDateTime, postOpen.minutes), postOpen.hours)
    const businessEnd = setHours(setMinutes(targetDateTime, postClose.minutes), postClose.hours)

    if (targetDateTime < businessStart || endDateTime > businessEnd) {
      return NextResponse.json({
        success: true,
        data: {
          available: false,
          reason: `Outside business hours (${postClinicHours.openTime} - ${postClinicHours.closeTime})`,
          suggestedTimes: []
        }
      })
    }

    // Check for conflicts
    const conflicts = await prisma.appointment.findMany({
      where: {
        scheduledDatetime: {
          gte: targetDateTime,
          lt: endDateTime
        },
        status: { notIn: ['cancelled', 'no_show'] },
        ...(dentistId && { dentistId })
      },
      include: {
        dentist: {
          select: {
            user: { select: { firstName: true, lastName: true } }
          }
        },
        patient: {
          select: {
            user: { select: { firstName: true, lastName: true } }
          }
        }
      }
    })

    const isAvailable = conflicts.length === 0

    // If not available, suggest alternative times
    let suggestedTimes: any[] = []
    if (!isAvailable) {
      // Find next 3 available slots
      const nextSlots = []
      let checkTime = addMinutes(targetDateTime, 30)
      let attempts = 0

      while (nextSlots.length < 3 && attempts < 20) {
        const checkEnd = addMinutes(checkTime, durationMinutes)
        
        if (checkEnd <= businessEnd) {
          const slotConflicts = await prisma.appointment.count({
            where: {
              scheduledDatetime: {
                gte: checkTime,
                lt: checkEnd
              },
              status: { notIn: ['cancelled', 'no_show'] },
              ...(dentistId && { dentistId })
            }
          })

          if (slotConflicts === 0) {
            nextSlots.push({
              datetime: checkTime.toISOString(),
              time: format(checkTime, 'HH:mm'),
              date: format(checkTime, 'yyyy-MM-dd')
            })
          }
        }

        checkTime = addMinutes(checkTime, 15)
        attempts++
      }

      suggestedTimes = nextSlots
    }

    return NextResponse.json({
      success: true,
      data: {
        available: isAvailable,
        conflicts: conflicts.map(c => ({
          appointmentId: c.id,
          patientName: `${c.patient.user?.lastName}, ${c.patient.user?.firstName}`,
          dentistName: c.dentist ? `Dr. ${c.dentist.user?.lastName}, ${c.dentist.user?.firstName}` : null,
          time: format(c.scheduledDatetime, 'HH:mm'),
          duration: c.durationMinutes
        })),
        suggestedTimes,
        requestedTime: {
          datetime: targetDateTime.toISOString(),
          time: format(targetDateTime, 'HH:mm'),
          duration: durationMinutes,
          appointmentType
        }
      }
    })

  } catch (error) {
    console.error("Error checking specific availability:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: "Validation error",
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
