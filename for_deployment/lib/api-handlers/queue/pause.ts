
import { NextRequest, NextResponse } from "next/server"
import { getServerAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"

// POST /api/queue/pause - Pause or resume patient in queue
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user || !['admin', 'manager', 'staff', 'dentist'].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { appointmentId, action, reason } = await request.json()

    if (!appointmentId || !action) {
      return NextResponse.json({ error: "Appointment ID and action required" }, { status: 400 })
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId }
    })

    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }

    let updateData: any = {
      updatedAt: new Date()
    }

    switch (action) {
      case 'pause':
        updateData.metadata = {
          ...((appointment as any).metadata as any || {}),
          isPaused: true,
          pauseReason: reason || 'Temporary hold',
          pausedAt: new Date().toISOString(),
          pausedBy: session.user.id
        }
        break

      case 'resume':
        const newMetadata = { ...((appointment as any).metadata as any || {}) }
        delete newMetadata['isPaused']
        delete newMetadata['pauseReason']
        delete newMetadata['pausedAt']
        delete newMetadata['pausedBy']
        
        updateData.metadata = {
          ...newMetadata,
          resumedAt: new Date().toISOString(),
          resumedBy: session.user.id
        }
        
        break

      default:
        return NextResponse.json({ error: "Invalid action. Use 'pause' or 'resume'" }, { status: 400 })
    }

    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: updateData,
      include: {
        patient: { include: { user: true } },
        dentist: { include: { user: true } }
      }
    })

    // Log the pause/resume action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: 'appointment',
        entityId: appointmentId,
        action: 'update',
        oldValues: {
          isPaused: ((appointment as any).metadata as any)?.isPaused || false,
          status: appointment.status
        },
        newValues: {
          isPaused: action === 'pause',
          status: updateData.status || appointment.status,
          reason: reason
        },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
      }
    })

    return NextResponse.json({
      success: true,
      message: `Patient ${action}d in queue`,
      data: {
        appointment: updatedAppointment,
        action,
        reason
      }
    })

  } catch (error) {
    console.error(`Error during queue operation:`, error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
