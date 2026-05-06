
import { NextRequest, NextResponse } from "next/server"
import { getServerAuth, canAccessAppointments } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { addMinutes, parseISO, isWithinInterval } from 'date-fns'

const conflictCheckSchema = z.object({
  appointmentId: z.string().optional(),
  scheduledDatetime: z.string(),
  durationMinutes: z.number(),
  dentistId: z.string().optional(),
  roomId: z.string().optional()
})

// GET /api/calendar/conflicts - Get all scheduling conflicts
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
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    let whereClause: any = {
      status: { notIn: ['cancelled', 'no_show'] }
    }

    if (startDate && endDate) {
      whereClause.scheduledDatetime = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    }

    // Fetch appointments
    const appointments = await prisma.appointment.findMany({
      where: whereClause,
      include: {
        patient: {
          select: {
            user: {
              select: { firstName: true, lastName: true }
            }
          }
        },
        dentist: {
          select: {
            id: true,
            user: {
              select: { firstName: true, lastName: true }
            }
          }
        }
      },
      orderBy: { scheduledDatetime: 'asc' }
    })

    // Detect conflicts
    const conflicts: any[] = []

    appointments.forEach((apt, index) => {
      const aptStart = apt.scheduledDatetime
      const aptEnd = addMinutes(aptStart, apt.durationMinutes)
      const aptConflicts: any[] = []

      // Check for time overlaps with same dentist
      if (apt.dentistId) {
        const overlapping = appointments.filter((other, otherIndex) => 
          otherIndex !== index && 
          other.dentistId === apt.dentistId &&
          other.status !== 'cancelled'
        ).filter(other => {
          const otherStart = other.scheduledDatetime
          const otherEnd = addMinutes(otherStart, other.durationMinutes)
          
          return (
            (aptStart >= otherStart && aptStart < otherEnd) ||
            (aptEnd > otherStart && aptEnd <= otherEnd) ||
            (aptStart <= otherStart && aptEnd >= otherEnd)
          )
        })

        overlapping.forEach(conflict => {
          aptConflicts.push({
            type: 'time_overlap',
            details: `Overlaps with appointment ${conflict.appointmentNumber} (${conflict.patient.user?.lastName}, ${conflict.patient.user?.firstName})`,
            severity: 'error',
            conflictingAppointmentId: conflict.id
          })
        })
      }

      // Check for double bookings (same time, different patients, same dentist)
      const doubleBookings = appointments.filter((other, otherIndex) => 
        otherIndex !== index &&
        other.dentistId === apt.dentistId &&
        other.scheduledDatetime.getTime() === apt.scheduledDatetime.getTime() &&
        other.status !== 'cancelled'
      )

      doubleBookings.forEach(conflict => {
        aptConflicts.push({
          type: 'double_booking',
          details: `Double booked with ${conflict.patient.user?.lastName}, ${conflict.patient.user?.firstName}`,
          severity: 'error',
          conflictingAppointmentId: conflict.id
        })
      })

      if (aptConflicts.length > 0) {
        conflicts.push({
          appointmentId: apt.id,
          appointmentNumber: apt.appointmentNumber,
          patientName: `${apt.patient.user?.lastName}, ${apt.patient.user?.firstName}`,
          scheduledDatetime: apt.scheduledDatetime,
          dentistName: apt.dentist ? `Dr. ${apt.dentist.user?.lastName}, ${apt.dentist.user?.firstName}` : null,
          conflicts: aptConflicts
        })
      }
    })

    return NextResponse.json({
      success: true,
      data: { conflicts }
    })

  } catch (error) {
    console.error("Error detecting conflicts:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/calendar/conflicts - Check for conflicts before scheduling
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
    const { appointmentId, scheduledDatetime, durationMinutes, dentistId, roomId } = conflictCheckSchema.parse(body)

    const proposedStart = parseISO(scheduledDatetime)
    const proposedEnd = addMinutes(proposedStart, durationMinutes)

    const conflicts: any[] = []

    // Check dentist conflicts
    if (dentistId) {
      const dentistAppointments = await prisma.appointment.findMany({
        where: {
          dentistId,
          status: { notIn: ['cancelled', 'no_show'] },
          ...(appointmentId && { id: { not: appointmentId } })
        },
        include: {
          patient: {
            select: {
              user: { select: { firstName: true, lastName: true } }
            }
          }
        }
      })

      dentistAppointments.forEach(apt => {
        const aptStart = apt.scheduledDatetime
        const aptEnd = addMinutes(aptStart, apt.durationMinutes)

        if (
          isWithinInterval(proposedStart, { start: aptStart, end: aptEnd }) ||
          isWithinInterval(proposedEnd, { start: aptStart, end: aptEnd }) ||
          (proposedStart <= aptStart && proposedEnd >= aptEnd)
        ) {
          conflicts.push({
            type: 'dentist_conflict',
            severity: 'error',
            details: `Dr. ${dentistId} is already booked with ${apt.patient.user?.lastName}, ${apt.patient.user?.firstName}`,
            conflictingAppointmentId: apt.id,
            conflictTime: apt.scheduledDatetime
          })
        }
      })
    }

    // Check room conflicts (if room scheduling is implemented)
    if (roomId) {
      // Room conflict check would go here
      // For now, this is a placeholder
    }

    const hasConflicts = conflicts.length > 0

    return NextResponse.json({
      success: true,
      data: {
        hasConflicts,
        conflicts,
        canSchedule: !hasConflicts || conflicts.every(c => c.severity === 'warning')
      }
    })

  } catch (error) {
    console.error("Error checking conflicts:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: "Validation error",
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
