
import { NextRequest, NextResponse } from 'next/server'
import { checkinTokenStore } from '@/lib/checkin-token-store'
import { createNotification, notifyRoles, ADMIN_STAFF_ROLES, buildAppointmentDeepLink } from '@/lib/notifications'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    // Get token data from global store
    const tokenData = checkinTokenStore.get(token)
    
    if (!tokenData) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired check-in code' },
        { status: 400 }
      )
    }

    const appointmentId = tokenData.appointmentId

    // Get appointment
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
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
        }
      }
    })

    if (!appointment) {
      return NextResponse.json(
        { success: false, error: 'Appointment not found' },
        { status: 404 }
      )
    }

    // Check if already checked in
    if (appointment.status === 'checked_in' || appointment.checkedInAt) {
      return NextResponse.json(
        { success: false, error: 'Already checked in' },
        { status: 400 }
      )
    }

    // Update appointment status
    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: 'checked_in',
        checkedInAt: new Date()
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
        }
      }
    })

    // Calculate queue position
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const queuePosition = await prisma.appointment.count({
      where: {
        status: {
          in: ['checked_in', 'in_progress']
        },
        scheduledDatetime: {
          gte: today,
          lt: tomorrow
        },
        checkedInAt: {
          lte: updatedAppointment.checkedInAt || new Date()
        }
      }
    })

    const estimatedWaitTime = (queuePosition - 1) * 15

    // Remove token after successful check-in
    checkinTokenStore.delete(token)

    // ─── In-app notifications for patient check-in (fail-safe) ───
    try {
      const patientUser = updatedAppointment.patient?.user
      const patientName =
        (updatedAppointment.patient as any)?.fullName ||
        (patientUser ? `${patientUser.lastName || ''}, ${patientUser.firstName || ''}`.trim() : 'Patient')
      await notifyRoles(ADMIN_STAFF_ROLES, {
        title: 'Patient Checked In',
        message: `${patientName} checked in for appointment #${updatedAppointment.appointmentNumber} (queue position: ${queuePosition}).`,
        type: 'patient_checked_in',
        priority: 'important',
        module: 'queue',
        relatedRecordId: updatedAppointment.id,
        redirectUrl: '/admin/queue',
        metadata: { appointmentNumber: updatedAppointment.appointmentNumber, queuePosition },
      })
      // Notify assigned dentist
      const assignedDentistUserId = updatedAppointment.dentist?.user?.id
      if (assignedDentistUserId) {
        await createNotification({
          userId: assignedDentistUserId,
          title: 'Patient Checked In',
          message: `${patientName} has checked in for appointment #${updatedAppointment.appointmentNumber}.`,
          type: 'patient_checked_in',
          priority: 'important',
          module: 'queue',
          relatedRecordId: updatedAppointment.id,
          redirectUrl: buildAppointmentDeepLink(updatedAppointment.id, { forUserId: assignedDentistUserId, tab: 'today' }),
          metadata: { appointmentNumber: updatedAppointment.appointmentNumber },
        })
      }
    } catch (notifErr) {
      console.error('Check-in notification error:', notifErr)
    }

    return NextResponse.json({
      success: true,
      data: {
        appointment: {
          ...updatedAppointment,
          queuePosition,
          estimatedWaitTime
        }
      }
    })

  } catch (error: any) {
    console.error('Error verifying check-in:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to verify check-in' },
      { status: 500 }
    )
  }
}
