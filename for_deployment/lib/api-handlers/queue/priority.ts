
import { NextRequest, NextResponse } from "next/server"
import { getServerAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"

// POST /api/queue/priority - Manage queue priority
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
      where: { id: appointmentId },
      include: {
        patient: { include: { user: true } }
      }
    })

    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }

    let updateData: any = {
      updatedAt: new Date()
    }

    switch (action) {
      case 'move_to_top':
        // Set high priority by updating scheduled time to now
        updateData.scheduledDatetime = new Date()
        updateData.metadata = {
          ...((appointment as any).metadata as any || {}),
          priorityOverride: true,
          priorityReason: reason || 'Staff override',
          priorityTimestamp: new Date().toISOString()
        }
        break

      case 'set_emergency':
        updateData.isEmergency = true
        updateData.metadata = {
          ...((appointment as any).metadata as any || {}),
          emergencyReason: reason || 'Emergency priority',
          emergencyTimestamp: new Date().toISOString()
        }
        break

      case 'set_urgent':
        updateData.metadata = {
          ...((appointment as any).metadata as any || {}),
          urgentPriority: true,
          urgentReason: reason || 'Urgent priority',
          urgentTimestamp: new Date().toISOString()
        }
        break

      case 'reset_priority':
        // Remove priority overrides
        const newMetadata = { ...((appointment as any).metadata as any || {}) }
        delete newMetadata['priorityOverride']
        delete newMetadata['emergencyReason']
        delete newMetadata['urgentPriority']
        updateData.metadata = newMetadata
        updateData.isEmergency = false
        break

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: updateData,
      include: {
        patient: { include: { user: true } },
        dentist: { include: { user: true } }
      }
    })

    // Log the priority change
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: 'appointment',
        entityId: appointmentId,
        action: 'update',
        oldValues: {
          priority: 'normal',
          scheduledDatetime: appointment.scheduledDatetime
        },
        newValues: {
          priority: action,
          scheduledDatetime: updateData.scheduledDatetime,
          reason: reason
        },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
      }
    })

    return NextResponse.json({
      success: true,
      message: `Queue priority updated: ${action}`,
      data: {
        appointment: updatedAppointment,
        action,
        reason
      }
    })

  } catch (error) {
    console.error("Error updating queue priority:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
