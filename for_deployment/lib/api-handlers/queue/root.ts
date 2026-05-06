
import { formatDisplayName, formatDentistName } from '@/lib/utils'
import { NextRequest, NextResponse } from "next/server"
import { getServerAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getClinicTodayRange } from "@/lib/clinic-hours"

// GET /api/queue - Get current queue status
export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get today's date range in clinic timezone (Manila)
    const { startOfDay, endOfDay } = getClinicTodayRange()

    // Fetch today's appointments that should be in the queue
    const appointments = await prisma.appointment.findMany({
      where: {
        scheduledDatetime: {
          gte: startOfDay,
          lte: endOfDay
        },
        status: {
          in: ['confirmed', 'checked_in', 'waiting', 'in_progress']
        },
        patient: { isActive: true }
      },
      include: {
        patient: {
          include: {
            user: true
          }
        },
        dentist: {
          include: {
            user: true
          }
        },
        appointmentTreatments: {
          include: {
            treatment: true
          }
        }
      },
      orderBy: [
        { isEmergency: 'desc' }, // Emergency appointments first
        { checkedInAt: 'asc' }, // Then by check-in time
        { scheduledDatetime: 'asc' } // Finally by scheduled time
      ]
    })

    // Transform appointments to queue items
    let queuePosition = 1
    const queueItems = appointments.map((appointment, index) => {
      const patientName = formatDisplayName(appointment.patient.user?.firstName, appointment.patient.user?.lastName)
      
      // Calculate estimated wait time based on position and current time
      let estimatedWaitTime = 0
      if (appointment.status === 'in_progress') {
        estimatedWaitTime = 0
      } else {
        // Base time of 30 minutes per appointment ahead
        const appointmentsAhead = appointments
          .slice(0, index)
          .filter(apt => apt.status === 'in_progress' || apt.status === 'waiting')
          .length
        estimatedWaitTime = appointmentsAhead * 30
      }

      const queueItem = {
        id: appointment.id,
        queueNumber: queuePosition++,
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        patientName: patientName,
        appointmentType: appointment.appointmentType,
        scheduledTime: appointment.scheduledDatetime.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }),
        estimatedWaitTime: estimatedWaitTime,
        status: mapAppointmentStatusToQueueStatus(appointment.status),
        priority: appointment.isEmergency ? 'emergency' : 'normal',
        dentistName: appointment.dentist 
          ? formatDentistName(appointment.dentist.user?.firstName, appointment.dentist.user?.lastName)
          : undefined,
        roomNumber: generateRoomNumber(appointment.dentistId),
        procedures: appointment.appointmentTreatments.map(apt => apt.treatment.name),
        checkedInAt: appointment.checkedInAt,
        startedAt: appointment.startedAt
      }

      return queueItem
    })

    // Find current user's position if they're a patient
    let myPosition = null
    if (session.user?.role === 'patient') {
      const patient = await prisma.patient.findFirst({
        where: { userId: session.user?.id }
      })
      
      if (patient) {
        myPosition = queueItems.find(item => item.patientId === patient.id)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        queue: queueItems,
        myPosition: myPosition,
        totalInQueue: queueItems.length,
        lastUpdated: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error("Error fetching queue:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Helper function to map appointment status to queue status
function mapAppointmentStatusToQueueStatus(appointmentStatus: string): string {
  switch (appointmentStatus) {
    case 'confirmed':
      return 'waiting'
    case 'checked_in':
      return 'waiting'
    case 'waiting':
      return 'waiting'
    case 'in_progress':
      return 'in_progress'
    case 'completed':
      return 'completed'
    default:
      return 'waiting'
  }
}

// Helper function to generate room number based on dentist
function generateRoomNumber(dentistId: string | null): string | undefined {
  if (!dentistId) return undefined
  
  // Simple room assignment based on dentist ID hash
  const hash = dentistId.split('-').pop() || '1'
  const roomNum = (parseInt(hash.substring(0, 2), 16) % 5) + 101 // Rooms 101-105
  return roomNum.toString()
}
