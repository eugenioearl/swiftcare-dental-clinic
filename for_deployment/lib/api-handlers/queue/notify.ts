
import { formatDisplayName } from '@/lib/utils'
import { NextRequest, NextResponse } from "next/server"
import { getServerAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getClinicTodayRange } from "@/lib/clinic-hours"

// POST /api/queue/notify - Send notifications to patients
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user || !['admin', 'manager', 'staff', 'dentist'].includes(session.user?.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { appointmentId, message, channel = 'sms', bulk = false } = await request.json()

    if (!bulk && !appointmentId) {
      return NextResponse.json({ error: "Appointment ID required for individual notifications" }, { status: 400 })
    }

    if (!message) {
      return NextResponse.json({ error: "Message required" }, { status: 400 })
    }

    let appointments = []

    if (bulk) {
      // Send to all waiting patients
      const { startOfDay, endOfDay } = getClinicTodayRange()

      appointments = await prisma.appointment.findMany({
        where: {
          scheduledDatetime: {
            gte: startOfDay,
            lte: endOfDay
          },
          status: {
            in: ['checked_in', 'waiting']
          }
        },
        include: {
          patient: { include: { user: true } }
        }
      })
    } else {
      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          patient: { include: { user: true } }
        }
      })

      if (!appointment) {
        return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
      }

      appointments = [appointment]
    }

    const notifications = []
    
    for (const appointment of appointments) {
      try {
        // Create notification record
        const notification = await prisma.notification.create({
          data: {
            userId: appointment.patient.userId,
            title: 'Appointment Update',
            message: message,
            type: 'system_alert',
            status: 'pending',
            priority: appointment.isEmergency ? 'high' : 'normal',
            metadata: {
              appointmentId: appointment.id,
              appointmentNumber: appointment.appointmentNumber,
              channel: channel,
              sentBy: session.user?.id,
              sentAt: new Date().toISOString()
            }
          }
        })

        // Simulate sending notification (in real app, integrate with SMS/email service)
        const notificationResult = await sendNotification({
          channel,
          recipient: appointment.patient.user?.phone || appointment.patient.user?.email,
          message,
          patientName: formatDisplayName(appointment.patient.user?.firstName, appointment.patient.user?.lastName),
          appointmentNumber: appointment.appointmentNumber
        })

        // Update appointment metadata to track notification
        await (prisma.appointment as any).update({
          where: { id: appointment.id },
          data: {
            metadata: {
              ...((appointment as any).metadata as any || {}),
              lastNotification: {
                id: notification.id,
                message: message,
                channel: channel,
                sentAt: new Date().toISOString(),
                sentBy: session.user?.id,
                status: notificationResult.success ? 'sent' : 'failed'
              }
            }
          }
        })

        // Update notification status
        await (prisma.notification as any).update({
          where: { id: notification.id },
          data: {
            status: notificationResult.success ? 'sent' : 'failed',
            sentAt: notificationResult.success ? new Date() : undefined,
            metadata: {
              ...((notification.metadata as any) || {}),
              deliveryStatus: notificationResult.status,
              errorMessage: notificationResult.error
            }
          }
        })

        notifications.push({
          appointmentId: appointment.id,
          patientName: formatDisplayName(appointment.patient.user?.firstName, appointment.patient.user?.lastName),
          channel,
          status: notificationResult.success ? 'sent' : 'failed',
          error: notificationResult.error
        })

      } catch (notificationError) {
        console.error(`Error sending notification for appointment ${appointment.id}:`, notificationError)
        notifications.push({
          appointmentId: appointment.id,
          patientName: formatDisplayName(appointment.patient.user?.firstName, appointment.patient.user?.lastName),
          channel,
          status: 'failed',
          error: 'Failed to process notification'
        })
      }
    }

    const successCount = notifications.filter(n => n.status === 'sent').length
    const failureCount = notifications.filter(n => n.status === 'failed').length

    return NextResponse.json({
      success: true,
      message: `Notifications processed: ${successCount} sent, ${failureCount} failed`,
      data: {
        total: notifications.length,
        sent: successCount,
        failed: failureCount,
        notifications: notifications.slice(0, 10) // Return first 10 for feedback
      }
    })

  } catch (error) {
    console.error("Error sending notifications:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Mock notification service (replace with real SMS/email service)
async function sendNotification({
  channel,
  recipient,
  message,
  patientName,
  appointmentNumber
}: {
  channel: string
  recipient?: string
  message: string
  patientName: string
  appointmentNumber: string
}) {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 100))

  if (!recipient) {
    return {
      success: false,
      status: 'failed',
      error: `No ${channel} address available`
    }
  }

  // Simulate 95% success rate
  const success = Math.random() > 0.05

  if (success) {
    // In real implementation, call SMS/Email service API here
    console.log(`[${channel.toUpperCase()}] Sent to ${recipient}:`, message)
    
    return {
      success: true,
      status: 'sent',
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  } else {
    return {
      success: false,
      status: 'failed',
      error: 'Service temporarily unavailable'
    }
  }
}

// GET /api/queue/notify - Get notification history
export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user || !['admin', 'manager', 'staff'].includes(session.user?.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const appointmentId = searchParams.get('appointmentId')

    let whereClause: any = {
      type: 'system_alert'
    }

    // Skip filtering by appointmentId for now to avoid Prisma issues
    // if (appointmentId) {
    //   whereClause.metadata = {
    //     path: ['appointmentId'],
    //     equals: appointmentId
    //   } as any
    // }

    const notifications = await prisma.notification.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    })

    return NextResponse.json({
      success: true,
      data: {
        notifications: notifications.map(n => ({
          id: n.id,
          recipient: formatDisplayName(n.user?.firstName, n.user?.lastName),
          message: n.message,
          channel: (n.metadata as any)?.channel || 'unknown',
          status: n.status,
          sentAt: n.sentAt?.toISOString(),
          createdAt: n.createdAt.toISOString(),
          appointmentNumber: (n.metadata as any)?.appointmentNumber
        }))
      }
    })

  } catch (error) {
    console.error("Error fetching notification history:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
