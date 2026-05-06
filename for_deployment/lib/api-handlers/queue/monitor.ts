

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getClinicTodayRange } from "@/lib/clinic-hours"

// GET /api/queue/monitor - Get queue data for monitor display
export async function GET(request: NextRequest) {
  try {
    const { startOfDay, endOfDay } = getClinicTodayRange()
    const currentTime = new Date()

    // Get all appointments for today
    const todayAppointments = await prisma.appointment.findMany({
      where: {
        scheduledDatetime: {
          gte: startOfDay,
          lte: endOfDay
        },
        status: {
          notIn: ['cancelled']
        },
        patient: { isActive: true }
      },
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

    // =========================================================================
    // AUTO-NO-SHOW GUARDS (see /api/appointments/route.ts for canonical rules)
    // - NEVER touch walk-ins
    // - NEVER touch active patients (checked_in, in_progress, waiting)
    // - Only mark NO_SHOW (not cancelled) when >2h past scheduled and not checked in
    // =========================================================================
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000
    const terminalStatuses = ['completed', 'cancelled', 'no_show', 'rejected']
    const activeStatuses = ['checked_in', 'in_progress', 'waiting']

    const pastAppointmentsToMarkNoShow = todayAppointments.filter(apt => {
      if (apt.appointmentType === 'walk_in') return false
      if (terminalStatuses.includes(apt.status)) return false
      if (activeStatuses.includes(apt.status)) return false
      const scheduledTime = new Date(apt.scheduledDatetime).getTime()
      return (currentTime.getTime() - scheduledTime) > TWO_HOURS_MS
    })

    if (pastAppointmentsToMarkNoShow.length > 0) {
      const noShowIds = pastAppointmentsToMarkNoShow.map(apt => apt.id)

      await prisma.appointment.updateMany({
        where: { id: { in: noShowIds } },
        data: {
          status: 'no_show',
          noShowAt: currentTime,
          notes: 'Auto-marked no-show: scheduled time passed by >2h without check-in'
        }
      })

      todayAppointments.forEach(apt => {
        if (noShowIds.includes(apt.id)) {
          apt.status = 'no_show'
          apt.noShowAt = currentTime
          apt.notes = 'Auto-marked no-show: scheduled time passed by >2h without check-in'
        }
      })

      console.log(`Queue Monitor: Auto-marked ${pastAppointmentsToMarkNoShow.length} appointments as no_show`)
    }

    // Helper: build patient display name — Last Name, F.
    const getPatientName = (apt: any): string => {
      const firstName = apt.patient?.user?.firstName?.trim()
      const lastName = apt.patient?.user?.lastName?.trim()
      if (lastName && firstName) return `${lastName}, ${firstName.charAt(0)}.`
      if (lastName) return lastName
      if (firstName) return firstName
      // Fallback to patient.fullName
      const fullName = apt.patient?.fullName?.trim()
      if (fullName) {
        const parts = fullName.split(/\s+/)
        if (parts.length >= 2) {
          const last = parts[parts.length - 1]
          const firstInitial = parts[0].charAt(0)
          return `${last}, ${firstInitial}.`
        }
        return fullName
      }
      // Last resort: appointment number
      return `Patient ${apt.appointmentNumber || ''}`
    }

    const getDentistName = (apt: any): string | null => {
      if (!apt.dentist) return null
      const firstName = apt.dentist?.user?.firstName?.trim()
      const lastName = apt.dentist?.user?.lastName?.trim()
      if (firstName && lastName) return `Dr. ${lastName}, ${firstName}`
      if (firstName) return `Dr. ${firstName}`
      return 'Dentist'
    }

    // Process appointments into queue categories
    const currentlyServing = todayAppointments
      .filter(apt => apt.status === 'in_progress')
      .map(apt => ({
        id: apt.id,
        appointmentNumber: apt.appointmentNumber,
        patientName: getPatientName(apt),
        appointmentType: apt.appointmentType.replace('_', ' ').toUpperCase(),
        scheduledTime: apt.scheduledDatetime.toISOString(),
        status: apt.status,
        dentistName: getDentistName(apt) || 'TBD',
        checkedInAt: apt.startedAt?.toISOString() || apt.checkedInAt?.toISOString()
      }))

    const waitingQueue = todayAppointments
      .filter(apt => ['checked_in', 'waiting'].includes(apt.status) || 
                     (apt.status === 'confirmed' && apt.scheduledDatetime <= currentTime))
      .map((apt, index) => {
        // Calculate estimated wait time based on queue position and average treatment time
        const baseWaitTime = apt.appointmentType === 'walk_in' ? 30 : 20 // Walk-ins generally take longer
        const estimatedWaitTime = (index + 1) * baseWaitTime

        return {
          id: apt.id,
          appointmentNumber: apt.appointmentNumber,
          patientName: getPatientName(apt),
          appointmentType: apt.appointmentType.replace('_', ' ').toUpperCase(),
          scheduledTime: apt.scheduledDatetime.toISOString(),
          status: apt.status,
          dentistName: getDentistName(apt) || 'To be assigned',
          estimatedWaitTime: estimatedWaitTime,
          isWalkIn: apt.appointmentType === 'walk_in',
          qrCodeData: `${process.env.NEXTAUTH_URL}/patient/check-in?apt=${apt.id}`
        }
      })

    const upcomingAppointments = todayAppointments
      .filter(apt => 
        (apt.status === 'confirmed' || apt.status === 'scheduled' || apt.status === 'pending_assignment') &&
        apt.scheduledDatetime > currentTime
      )
      .slice(0, 8) // Show next 8 upcoming appointments
      .map(apt => ({
        id: apt.id,
        appointmentNumber: apt.appointmentNumber,
        patientName: getPatientName(apt),
        appointmentType: apt.appointmentType.replace('_', ' ').toUpperCase(),
        scheduledTime: apt.scheduledDatetime.toISOString(),
        status: apt.status,
        dentistName: getDentistName(apt)
      }))

    // Calculate wait times and efficiency
    const completed = todayAppointments.filter(apt => apt.status === 'completed')
    const onTimeCompleted = completed.filter(apt => {
      if (!apt.completedAt) return true
      const scheduled = new Date(apt.scheduledDatetime).getTime()
      const completedTs = new Date(apt.completedAt).getTime()
      // within 30 minutes of scheduled = "on time"
      return Math.abs(completedTs - scheduled) <= 30 * 60 * 1000
    })
    const currentEfficiency = completed.length > 0
      ? Math.round((onTimeCompleted.length / completed.length) * 100)
      : 100

    // Average wait time (minutes) = avg of (startedAt - checkedInAt)
    const inTreatmentOrDone = todayAppointments.filter(apt =>
      apt.startedAt && apt.checkedInAt && apt.startedAt >= apt.checkedInAt
    )
    const averageWaitTime = inTreatmentOrDone.length > 0
      ? Math.round(
          inTreatmentOrDone.reduce((sum, apt) => {
            const diffMs = new Date(apt.startedAt!).getTime() - new Date(apt.checkedInAt!).getTime()
            return sum + diffMs / 60000
          }, 0) / inTreatmentOrDone.length
        )
      : 0

    // Calculate stats
    const stats = {
      totalToday: todayAppointments.length,
      completed: completed.length,
      inProgress: currentlyServing.length,
      waiting: waitingQueue.length,
      averageWaitTime,
      currentEfficiency
    }

    return NextResponse.json({
      success: true,
      currentlyServing,
      waitingQueue,
      upcomingAppointments,
      stats,
      lastUpdated: new Date().toISOString()
    })

  } catch (error) {
    console.error("Error fetching queue monitor data:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

