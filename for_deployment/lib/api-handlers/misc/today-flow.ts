/**
 * UNIFIED TODAY FLOW API
 * ============================
 * Single endpoint that returns ALL of today's patients grouped by their flow lane:
 *   - today_schedule: Scheduled / confirmed / pending_assignment (not yet checked in)
 *   - waiting:        Checked-in + waiting patients (scheduled and walk-ins)
 *   - standby:        Walk-ins not yet accepted into queue
 *   - in_treatment:   Currently in progress
 *   - completed:      Completed today
 *
 * Also includes smart counters, late patients, and alerts.
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  getFlowLane,
  isWalkIn,
  isLate,
  getQueuePriority,
  ACTIVE_STATES,
  TERMINAL_STATES,
  type AppointmentStatus,
  type FlowLane,
} from "@/lib/patient-flow"
import { getClinicTodayRange } from "@/lib/clinic-hours"

const ALLOWED_ROLES = ['admin', 'super_admin', 'manager', 'staff', 'receptionist', 'dentist']

export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const dentistId = searchParams.get('dentistId')

    const now = new Date()
    const { startOfDay, endOfDay } = getClinicTodayRange()

    // Core where clause: today's appointments + active patients
    const whereClause: any = {
      scheduledDatetime: {
        gte: startOfDay,
        lte: endOfDay
      },
      patient: { isActive: true },
    }
    if (dentistId) whereClause.dentistId = dentistId

    // Filter by role:
    if (session.user.role === 'dentist') {
      // Dentists only see their own appointments unless specified otherwise
      const dentistRecord = await prisma.dentist.findFirst({
        where: { userId: session.user.id }
      })
      if (dentistRecord) {
        whereClause.OR = [
          { dentistId: dentistRecord.id },
          { dentistId: null } // Include unassigned so dentists can pick up
        ]
      }
    }

    const appointments = await prisma.appointment.findMany({
      where: whereClause,
      include: {
        patient: {
          include: {
            user: {
              select: {
                id: true, firstName: true, lastName: true,
                email: true, phone: true
              }
            }
          }
        },
        dentist: {
          include: {
            user: {
              select: {
                id: true, firstName: true, lastName: true
              }
            }
          }
        },
      },
      orderBy: { scheduledDatetime: 'asc' },
    })

    // Classify into flow lanes
    const lanes: Record<FlowLane, any[]> = {
      today_schedule: [],
      waiting: [],
      queue: [],
      standby: [],
      in_treatment: [],
      completed: [],
    }
    const all_cancelled: any[] = []
    const all_no_show: any[] = []

    for (const apt of appointments) {
      const isWI = isWalkIn(apt.appointmentType as any)
      // Standby detection: walk-ins not yet checked-in/waiting/in-progress
      const isStandby = isWI && !['checked_in', 'waiting', 'in_progress', 'completed'].includes(apt.status)

      const lane = getFlowLane(apt.status as any, apt.appointmentType as any, isStandby)

      const enriched = {
        id: apt.id,
        appointmentNumber: apt.appointmentNumber,
        scheduledDatetime: apt.scheduledDatetime.toISOString(),
        durationMinutes: apt.durationMinutes,
        appointmentType: apt.appointmentType,
        status: apt.status,
        reasonForVisit: apt.reasonForVisit,
        notes: apt.notes,
        isEmergency: apt.isEmergency,
        isWalkIn: isWI,
        isStandby,
        isLate: isLate({
          scheduledDatetime: apt.scheduledDatetime,
          status: apt.status as any,
          appointmentType: apt.appointmentType as any
        }, now),
        minutesLate: isWI ? 0 : Math.max(0, Math.floor((now.getTime() - apt.scheduledDatetime.getTime()) / 60000)),
        checkedInAt: apt.checkedInAt?.toISOString() || null,
        startedAt: apt.startedAt?.toISOString() || null,
        completedAt: apt.completedAt?.toISOString() || null,
        priority: getQueuePriority({
          isEmergency: apt.isEmergency,
          appointmentType: apt.appointmentType as any,
          status: apt.status as any
        }),
        patient: {
          id: apt.patient.id,
          patientNumber: apt.patient.patientNumber,
          fullName: apt.patient.fullName
            || (apt.patient.user ? `${apt.patient.user.lastName}, ${apt.patient.user.firstName}` : null)
            || 'Unknown Patient',
          phone: apt.patient.mobileNumber || apt.patient.user?.phone || null,
          email: apt.patient.emailDirect || apt.patient.user?.email || null,
        },
        dentist: apt.dentist ? {
          id: apt.dentist.id,
          name: apt.dentist.user ? `Dr. ${apt.dentist.user.lastName}, ${apt.dentist.user.firstName}` : 'Dentist',
        } : null,
      }

      if (apt.status === 'cancelled') { all_cancelled.push(enriched); continue }
      if (apt.status === 'no_show') { all_no_show.push(enriched); continue }
      if (lane) lanes[lane].push(enriched)
    }

    // Priority-then-time sorter for active lanes
    const prioritySorter = (a: any, b: any) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      if (a.checkedInAt && b.checkedInAt) return new Date(a.checkedInAt).getTime() - new Date(b.checkedInAt).getTime()
      return new Date(a.scheduledDatetime).getTime() - new Date(b.scheduledDatetime).getTime()
    }
    lanes.waiting.sort(prioritySorter)
    lanes.queue.sort(prioritySorter)
    // Sort today_schedule by scheduled time
    lanes.today_schedule.sort((a, b) =>
      new Date(a.scheduledDatetime).getTime() - new Date(b.scheduledDatetime).getTime()
    )
    // Sort standby by arrival (scheduled = creation time for walk-ins)
    lanes.standby.sort((a, b) =>
      new Date(a.scheduledDatetime).getTime() - new Date(b.scheduledDatetime).getTime()
    )
    // Sort completed by completion time (most recent first)
    lanes.completed.sort((a, b) => {
      const aT = a.completedAt ? new Date(a.completedAt).getTime() : 0
      const bT = b.completedAt ? new Date(b.completedAt).getTime() : 0
      return bT - aT
    })

    // Alerts & system intelligence
    const alerts: Array<{ type: string; severity: 'info' | 'warning' | 'critical'; message: string; appointmentId?: string }> = []

    // Late patients
    const latePatients = lanes.today_schedule.filter(p => p.isLate)
    latePatients.forEach(p => {
      alerts.push({
        type: 'late_patient',
        severity: p.minutesLate > 30 ? 'critical' : 'warning',
        message: `${p.patient.fullName} is ${p.minutesLate} minutes late`,
        appointmentId: p.id,
      })
    })

    // Walk-ins waiting too long (>30 min in standby / waiting / queue)
    const longWaitWalkIns = [...lanes.standby, ...lanes.waiting, ...lanes.queue].filter(p => {
      if (!p.isWalkIn) return false
      const waitSince = p.checkedInAt ? new Date(p.checkedInAt).getTime() : new Date(p.scheduledDatetime).getTime()
      const waitMinutes = (now.getTime() - waitSince) / 60000
      return waitMinutes > 30
    })
    longWaitWalkIns.forEach(p => {
      alerts.push({
        type: 'walk_in_long_wait',
        severity: 'warning',
        message: `Walk-in ${p.patient.fullName} has been waiting too long`,
        appointmentId: p.id,
      })
    })

    // Slot available suggestion (late patient + walk-ins in standby)
    if (latePatients.length > 0 && lanes.standby.length > 0) {
      alerts.push({
        type: 'slot_available',
        severity: 'info',
        message: `${latePatients.length} scheduled patient(s) late and ${lanes.standby.length} walk-in(s) on standby — consider fitting walk-ins in`,
      })
    }

    // Counters
    const counts = {
      today_schedule: lanes.today_schedule.length,
      waiting: lanes.waiting.length,
      queue: lanes.queue.length,
      standby: lanes.standby.length,
      in_treatment: lanes.in_treatment.length,
      completed: lanes.completed.length,
      cancelled: all_cancelled.length,
      no_show: all_no_show.length,
      total: appointments.length,
      total_walk_ins: appointments.filter(a => a.appointmentType === 'walk_in').length,
      late_patients: latePatients.length,
      emergencies: appointments.filter(a => a.isEmergency && !TERMINAL_STATES.includes(a.status as AppointmentStatus)).length,
    }

    return NextResponse.json({
      success: true,
      data: {
        lanes,
        cancelled: all_cancelled,
        no_show: all_no_show,
        counts,
        alerts,
        timestamp: now.toISOString(),
      }
    })
  } catch (error) {
    console.error("Error fetching today flow:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
