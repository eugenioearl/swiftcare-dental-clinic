

import { NextRequest, NextResponse } from "next/server"
import { getServerAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getClinicTodayRange } from "@/lib/clinic-hours"

// POST /api/queue/position - Get queue position for appointment
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { appointmentId } = await request.json()

    if (!appointmentId) {
      return NextResponse.json({ error: "Appointment ID required" }, { status: 400 })
    }

    // Get all checked-in appointments for today, ordered by check-in time
    const { startOfDay, endOfDay } = getClinicTodayRange()

    const checkedInAppointments = await prisma.appointment.findMany({
      where: {
        status: 'checked_in',
        scheduledDatetime: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      orderBy: {
        updatedAt: 'asc' // Assumes check-in updates the updatedAt field
      }
    })

    // Find position of the current appointment
    const position = checkedInAppointments.findIndex(apt => apt.id === appointmentId) + 1

    if (position === 0) {
      return NextResponse.json({ error: "Appointment not found in queue" }, { status: 404 })
    }

    const estimatedWaitTime = Math.max(0, (position - 1) * 15) // 15 minutes per patient

    return NextResponse.json({
      success: true,
      data: {
        position,
        totalInQueue: checkedInAppointments.length,
        estimatedWaitTime
      }
    })

  } catch (error) {
    console.error("Error getting queue position:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

