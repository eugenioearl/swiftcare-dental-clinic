
import { formatPatientName } from '@/lib/utils'
import { NextRequest, NextResponse } from "next/server"
import { getServerAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getClinicTodayRange } from "@/lib/clinic-hours"

// GET /api/queue/enhanced - Get enhanced queue data with analytics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user || !['admin', 'manager', 'staff', 'dentist'].includes(session.user?.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const dentistId = searchParams.get('dentistId')
    
    const { startOfDay, endOfDay } = getClinicTodayRange()

    // Base query conditions
    let whereClause: any = {
      scheduledDatetime: {
        gte: startOfDay,
        lte: endOfDay
      },
      patient: { isActive: true }
    }

    // Add dentist filter if specified
    if (dentistId) {
      whereClause.dentistId = dentistId
    }

    // Get all appointments for today
    const appointments = await prisma.appointment.findMany({
      where: whereClause,
      include: {
        patient: {
          include: { user: true }
        },
        dentist: {
          include: { user: true }
        }
      },
      orderBy: {
        scheduledDatetime: 'asc'
      }
    })

    // Process appointments into queue items with enhanced data
    const activeAppointments = appointments.filter(apt => !['cancelled', 'no_show', 'completed'].includes(apt.status))
    const queueItems = activeAppointments
      .map((apt, index) => {
        const checkedInAt = apt.checkedInAt?.toISOString()
        const startedAt = apt.startedAt?.toISOString()
        const completedAt = apt.completedAt?.toISOString()

        // Calculate actual wait time if available
        let actualWaitTime = 0
        if (checkedInAt && startedAt) {
          actualWaitTime = Math.round((new Date(startedAt).getTime() - new Date(checkedInAt).getTime()) / (1000 * 60))
        }

        // Calculate estimated wait time based on queue position
        const position = index + 1
        const baseWaitTime = getBaseWaitTime(apt.appointmentType)
        let estimatedWaitTime = 0

        if (apt.status === 'in_progress') {
          estimatedWaitTime = 0
        } else {
          const queueAhead = activeAppointments.filter(a => 
            a.id !== apt.id && 
            ['checked_in', 'waiting', 'in_progress'].includes(a.status) &&
            a.scheduledDatetime <= apt.scheduledDatetime
          ).length

          if (getPriority(apt) === 'emergency') {
            estimatedWaitTime = Math.min(10, queueAhead * 15)
          } else if (getPriority(apt) === 'urgent') {
            estimatedWaitTime = Math.min(20, queueAhead * 20)
          } else {
            estimatedWaitTime = queueAhead * 25 + (baseWaitTime * 0.3)
          }
        }

        return {
          id: apt.id,
          appointmentNumber: apt.appointmentNumber,
          scheduledDatetime: apt.scheduledDatetime.toISOString(),
          appointmentType: apt.appointmentType,
          status: apt.status,
          reasonForVisit: apt.reasonForVisit || 'General consultation',
          checkedInAt,
          startedAt,
          completedAt,
          actualWaitTime,
          estimatedWaitTime: Math.round(estimatedWaitTime),
          priority: getPriority(apt),
          queuePosition: position,
          patient: {
            id: apt.patient.id,
            fullName: formatPatientName(apt.patient.fullName, apt.patient.user?.firstName, apt.patient.user?.lastName, '') || null,
            user: apt.patient.user ? {
              firstName: apt.patient.user.firstName,
              lastName: apt.patient.user.lastName,
              phone: apt.patient.user.phone
            } : null,
            mobileNumber: apt.patient.mobileNumber,
            patientNumber: apt.patient.patientNumber
          },
          dentist: apt.dentist ? {
            id: apt.dentist.id,
            user: {
              firstName: apt.dentist.user?.firstName,
              lastName: apt.dentist.user?.lastName
            }
          } : undefined,
          isPaused: ((apt as any).metadata as any)?.isPaused === true,
          pauseReason: ((apt as any).metadata as any)?.pauseReason || undefined,
          specialInstructions: ((apt as any).metadata as any)?.specialInstructions || undefined,
          notificationSent: ((apt as any).metadata as any)?.notificationSent === true
        }
      })

    // Calculate analytics
    const completedToday = appointments.filter(apt => apt.status === 'completed')
    const waitTimes = completedToday
      .map(apt => {
        if (apt.checkedInAt && apt.startedAt) {
          return Math.round((apt.startedAt.getTime() - apt.checkedInAt.getTime()) / (1000 * 60))
        }
        return 0
      })
      .filter(time => time > 0)

    const treatmentTimes = completedToday
      .map(apt => {
        if (apt.startedAt && apt.completedAt) {
          return Math.round((apt.completedAt.getTime() - apt.startedAt.getTime()) / (1000 * 60))
        }
        return 0
      })
      .filter(time => time > 0)

    const analytics = {
      averageWaitTime: waitTimes.length > 0 ? Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length) : 0,
      averageTreatmentTime: treatmentTimes.length > 0 ? Math.round(treatmentTimes.reduce((a, b) => a + b, 0) / treatmentTimes.length) : 0,
      currentEfficiency: calculateEfficiency(appointments),
      peakHours: getPeakHours(appointments),
      bottlenecks: identifyBottlenecks(appointments),
      patientsServedToday: completedToday.length,
      totalWaitTimeToday: waitTimes.reduce((a, b) => a + b, 0)
    }

    return NextResponse.json({
      success: true,
      queue: queueItems,
      analytics,
      lastUpdated: new Date().toISOString()
    })

  } catch (error) {
    console.error("Error fetching enhanced queue data:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

function getBaseWaitTime(appointmentType: string): number {
  const baseTimes = {
    'cleaning': 45,
    'consultation': 30,
    'filling': 60,
    'extraction': 90,
    'surgery': 120,
    'emergency': 45,
    'walk_in': 30,
    'follow_up': 20
  }
  return baseTimes[appointmentType as keyof typeof baseTimes] || 30
}

function getPriority(appointment: any): 'normal' | 'urgent' | 'emergency' {
  if (appointment.isEmergency || appointment.appointmentType === 'emergency') {
    return 'emergency'
  }
  
  // Check if appointment is overdue by more than 30 minutes
  const now = new Date()
  const scheduled = new Date(appointment.scheduledDatetime)
  const overdue = (now.getTime() - scheduled.getTime()) / (1000 * 60) > 30
  
  if (overdue && ['checked_in', 'waiting'].includes(appointment.status)) {
    return 'urgent'
  }
  
  return 'normal'
}

function calculateEfficiency(appointments: any[]): number {
  const totalAppointments = appointments.length
  if (totalAppointments === 0) return 100

  const onTimeAppointments = appointments.filter(apt => {
    if (apt.startedAt && apt.scheduledDatetime) {
      const scheduled = new Date(apt.scheduledDatetime)
      const started = new Date(apt.startedAt)
      const delay = (started.getTime() - scheduled.getTime()) / (1000 * 60)
      return delay <= 15 // Consider on-time if within 15 minutes
    }
    return true
  }).length

  return Math.round((onTimeAppointments / totalAppointments) * 100)
}

function getPeakHours(appointments: any[]): string[] {
  const hourCounts: { [key: string]: number } = {}
  
  appointments.forEach(apt => {
    const hour = new Date(apt.scheduledDatetime).getHours()
    const hourKey = `${hour.toString().padStart(2, '0')}:00`
    hourCounts[hourKey] = (hourCounts[hourKey] || 0) + 1
  })

  return Object.entries(hourCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([hour]) => hour)
}

function identifyBottlenecks(appointments: any[]): string[] {
  const bottlenecks: string[] = []
  
  // Check for long wait times
  const longWaits = appointments.filter(apt => {
    if (apt.checkedInAt && apt.startedAt) {
      const waitTime = (apt.startedAt.getTime() - apt.checkedInAt.getTime()) / (1000 * 60)
      return waitTime > 45
    }
    return false
  })

  if (longWaits.length > 0) {
    bottlenecks.push(`${longWaits.length} patients had wait times over 45 minutes`)
  }

  // Check for appointment delays
  const delayedAppointments = appointments.filter(apt => {
    if (apt.startedAt) {
      const scheduled = new Date(apt.scheduledDatetime)
      const started = new Date(apt.startedAt)
      const delay = (started.getTime() - scheduled.getTime()) / (1000 * 60)
      return delay > 20
    }
    return false
  })

  if (delayedAppointments.length > 0) {
    bottlenecks.push(`${delayedAppointments.length} appointments started more than 20 minutes late`)
  }

  // Check for incomplete appointments
  const incompleteAppointments = appointments.filter(apt => 
    ['checked_in', 'waiting', 'in_progress'].includes(apt.status) &&
    new Date(apt.scheduledDatetime) < new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
  )

  if (incompleteAppointments.length > 0) {
    bottlenecks.push(`${incompleteAppointments.length} appointments have been in progress for over 2 hours`)
  }

  return bottlenecks.length > 0 ? bottlenecks : ['No significant bottlenecks detected']
}
