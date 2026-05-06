
import { NextRequest, NextResponse } from "next/server"
import { getServerAuth, canManageAppointments, isDentistRole } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import {
  sendAppointmentCancellationEmail,
  sendAppointmentApprovalEmail,
  sendAppointmentRejectionEmail,
} from "@/lib/email-notifications"
import { notifyRoles, createNotification, ADMIN_STAFF_ROLES, buildAppointmentDeepLink } from "@/lib/notifications"

const statusUpdateSchema = z.object({
  status: z.enum(['pending', 'pending_assignment', 'scheduled', 'confirmed', 'checked_in', 'waiting', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled', 'rejected']),
  notes: z.string().optional(),
  cancellationReason: z.string().optional()
})

// PUT/PATCH /api/appointments/[id]/status - Update appointment status
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { status, notes, cancellationReason } = statusUpdateSchema.parse(body)

    const appointment = await prisma.appointment.findUnique({
      where: { id: params.id },
      include: {
        patient: { include: { user: true } },
        dentist: { include: { user: true } }
      }
    })

    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }

    // Permission: admins/staff can manage any; dentists can manage appointments assigned to them
    const userId = (session.user as any)?.id as string | undefined
    const userRole = (session.user as any)?.role as string | undefined
    const isManager = canManageAppointments(userRole || '')
    const isDentist = isDentistRole(userRole || '')
    let isAssignedDentist = false
    if (isDentist && userId) {
      try {
        const d = await prisma.dentist.findUnique({ where: { userId } })
        if (d && appointment.dentistId && d.id === appointment.dentistId) {
          isAssignedDentist = true
        }
      } catch (e) {
        console.warn('[appointment-status] dentist lookup failed', e)
      }
    }
    // Clinical statuses allowed for the assigned dentist
    const dentistAllowedStatuses = new Set(['in_progress', 'completed', 'checked_in', 'waiting'])
    const dentistCanPerformAction = isAssignedDentist && dentistAllowedStatuses.has(status)
    if (!isManager && !dentistCanPerformAction) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Build update data based on status
    const updateData: any = {
      status,
      updatedAt: new Date()
    }

    if (notes) {
      updateData.notes = notes
    }

    // Handle status-specific updates
    switch (status) {
      case 'checked_in':
        updateData.checkedInAt = new Date()
        break
      case 'in_progress':
        updateData.startedAt = new Date()
        break
      case 'completed':
        updateData.completedAt = new Date()
        break
      case 'cancelled':
        updateData.cancelledAt = new Date()
        updateData.cancelledBy = session.user?.id
        if (cancellationReason) {
          updateData.cancellationReason = cancellationReason
        }
        break
      case 'no_show':
        updateData.noShowAt = new Date()
        break
    }

    const updatedAppointment = await prisma.appointment.update({
      where: { id: params.id },
      data: updateData,
      include: {
        patient: { include: { user: true } },
        dentist: { include: { user: true } },
        creator: true
      }
    })

    // Log status update
    await prisma.auditLog.create({
      data: {
        userId: session.user?.id,
        entityType: 'appointment',
        entityId: appointment.id,
        action: 'update',
        oldValues: { status: appointment.status },
        newValues: { status, notes, cancellationReason }
      }
    })

    // Capture original status BEFORE status-dependent logic so downstream transitions see it
    const prevStatus = appointment.status

    // Create notification for status changes (only if patient has a user account)
    if (appointment.patient?.userId) {
      const patientNotifyStatuses: Record<string, { type: string; priority: string; title: string }> = {
        confirmed: { type: 'appointment_confirmation', priority: 'normal', title: 'Appointment Confirmed' },
        cancelled: { type: 'appointment_cancelled', priority: 'high', title: 'Appointment Cancelled' },
        rescheduled: { type: 'appointment_rescheduled', priority: 'normal', title: 'Appointment Rescheduled' },
        completed: { type: 'appointment_completed', priority: 'normal', title: 'Appointment Completed' },
        no_show: { type: 'appointment_no_show', priority: 'normal', title: 'Missed Appointment' },
      }
      const cfg = patientNotifyStatuses[status as keyof typeof patientNotifyStatuses]
      if (cfg && status !== prevStatus) {
        await prisma.notification.create({
          data: {
            userId: appointment.patient.userId,
            title: cfg.title,
            message: status === 'no_show'
              ? `You missed your appointment #${appointment.appointmentNumber} on ${appointment.scheduledDatetime.toLocaleString()}. Please contact us to reschedule.`
              : status === 'completed'
                ? `Your appointment #${appointment.appointmentNumber} on ${appointment.scheduledDatetime.toLocaleString()} has been completed. Thank you!`
                : `Your appointment #${appointment.appointmentNumber} on ${appointment.scheduledDatetime.toLocaleString()} has been ${status}${cancellationReason ? `: ${cancellationReason}` : '.'}`,
            type: cfg.type as any,
            module: 'appointments',
            relatedRecordId: appointment.id,
            redirectUrl: `/patient/appointments`,
            status: 'sent',
            priority: cfg.priority as any,
            sentAt: new Date()
          }
        }).catch((err: any) => console.error('Failed to create notification:', err))
      }
    }

    // Resolve patient contact info (shared for emails below)
    const patientUser = appointment.patient?.user
    const patientEmail = (appointment.patient as any)?.emailDirect || patientUser?.email
    const patientName = (appointment.patient as any)?.fullName || (patientUser ? `${patientUser.lastName}, ${patientUser.firstName}` : 'Patient')
    const approvalStatuses = ['confirmed', 'scheduled']

    // Send approval email when status changed TO an approval status (not previously approved)
    if (status && approvalStatuses.includes(status) && !approvalStatuses.includes(prevStatus)) {
      try {
        if (patientEmail) {
          const dentistUser = updatedAppointment.dentist?.user
          sendAppointmentApprovalEmail({
            appointmentId: updatedAppointment.id,
            appointmentNumber: updatedAppointment.appointmentNumber,
            appointmentType: updatedAppointment.appointmentType,
            scheduledDatetime: new Date(updatedAppointment.scheduledDatetime),
            durationMinutes: updatedAppointment.durationMinutes,
            patientName,
            patientEmail,
            dentistName: dentistUser ? `${dentistUser.lastName}, ${dentistUser.firstName}` : undefined,
            reasonForVisit: updatedAppointment.reasonForVisit || undefined,
          }).catch(err => console.error('Failed to send approval email:', err))
        }
      } catch (notifErr) {
        console.error('Approval email error:', notifErr)
      }
    }

    // Send rejection email if applicable
    if (status === 'rejected' && prevStatus !== 'rejected') {
      try {
        if (patientEmail) {
          sendAppointmentRejectionEmail({
            appointmentNumber: appointment.appointmentNumber,
            appointmentType: appointment.appointmentType,
            scheduledDatetime: new Date(appointment.scheduledDatetime),
            patientName,
            patientEmail,
            rejectionReason: cancellationReason || 'No reason provided',
          }).catch(err => console.error('Failed to send rejection email:', err))
        }
      } catch (notifErr) {
        console.error('Rejection email error:', notifErr)
      }
    }

    // Send cancellation email if applicable
    if (status === 'cancelled' && prevStatus !== 'cancelled') {
      try {
        if (patientEmail) {
          sendAppointmentCancellationEmail({
            appointmentNumber: appointment.appointmentNumber,
            appointmentType: appointment.appointmentType,
            scheduledDatetime: new Date(appointment.scheduledDatetime),
            patientName,
            patientEmail,
            cancellationReason: cancellationReason
          }).catch(err => console.error('Failed to send cancellation email:', err))
        }
      } catch (notifErr) {
        console.error('Cancellation email error:', notifErr)
      }
    }

    // ---------- Phase 2 in-app notifications: broadcast status transitions to staff + dentist ----------
    try {
      const scheduledTimeDisplay = new Date(appointment.scheduledDatetime).toLocaleString('en-PH', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
      const dentistUser = updatedAppointment.dentist?.user
      const dentistUserId = dentistUser?.id || null
      const apptRedirect = buildAppointmentDeepLink(appointment.id, { tab: 'upcoming' })
      const statusChanged = status !== prevStatus

      if (statusChanged) {
        // Appointment completed — notify staff/admin + dentist
        if (status === 'completed') {
          await notifyRoles(ADMIN_STAFF_ROLES, {
            title: 'Appointment Completed',
            message: `Appointment #${appointment.appointmentNumber} for ${patientName} was marked completed (${scheduledTimeDisplay}).`,
            type: 'appointment_completed',
            priority: 'normal',
            module: 'appointments',
            relatedRecordId: appointment.id,
            redirectUrl: apptRedirect,
            dedupeKey: `appointment:${appointment.id}:completed`,
          }).catch((err) => console.error('[status] notify staff/admin (completed) failed:', err))

          if (dentistUserId) {
            await createNotification({
              userId: dentistUserId,
              title: 'Appointment Marked Completed',
              message: `You completed appointment #${appointment.appointmentNumber} for ${patientName}.`,
              type: 'appointment_completed',
              priority: 'normal',
              module: 'appointments',
              relatedRecordId: appointment.id,
              redirectUrl: apptRedirect,
            }).catch((err) => console.error('[status] notify dentist (completed) failed:', err))
          }
        }

        // Appointment cancelled — notify staff/admin (and patient already handled above)
        if (status === 'cancelled') {
          await notifyRoles(ADMIN_STAFF_ROLES, {
            title: 'Appointment Cancelled',
            message: `Appointment #${appointment.appointmentNumber} for ${patientName} was cancelled (${scheduledTimeDisplay})${cancellationReason ? `: ${cancellationReason}` : '.'}`,
            type: 'appointment_cancelled',
            priority: 'important',
            module: 'appointments',
            relatedRecordId: appointment.id,
            redirectUrl: apptRedirect,
            dedupeKey: `appointment:${appointment.id}:cancelled`,
          }).catch((err) => console.error('[status] notify staff/admin (cancelled) failed:', err))

          if (dentistUserId) {
            await createNotification({
              userId: dentistUserId,
              title: 'Appointment Cancelled',
              message: `Your scheduled appointment with ${patientName} on ${scheduledTimeDisplay} was cancelled.`,
              type: 'appointment_cancelled',
              priority: 'important',
              module: 'appointments',
              relatedRecordId: appointment.id,
              redirectUrl: apptRedirect,
            }).catch((err) => console.error('[status] notify dentist (cancelled) failed:', err))
          }
        }

        // No-show — notify staff/admin + dentist
        if (status === 'no_show') {
          await notifyRoles(ADMIN_STAFF_ROLES, {
            title: 'Patient No-Show',
            message: `${patientName} did not show up for appointment #${appointment.appointmentNumber} (${scheduledTimeDisplay}).`,
            type: 'appointment_no_show',
            priority: 'important',
            module: 'appointments',
            relatedRecordId: appointment.id,
            redirectUrl: apptRedirect,
            dedupeKey: `appointment:${appointment.id}:no_show`,
          }).catch((err) => console.error('[status] notify staff/admin (no-show) failed:', err))

          if (dentistUserId) {
            await createNotification({
              userId: dentistUserId,
              title: 'Patient No-Show',
              message: `${patientName} did not show up for the ${scheduledTimeDisplay} slot.`,
              type: 'appointment_no_show',
              priority: 'important',
              module: 'appointments',
              relatedRecordId: appointment.id,
              redirectUrl: apptRedirect,
            }).catch((err) => console.error('[status] notify dentist (no-show) failed:', err))
          }
        }

        // In-progress — quick heads-up to staff (not dentist — they triggered it)
        if (status === 'in_progress') {
          await notifyRoles(ADMIN_STAFF_ROLES, {
            title: 'Appointment Started',
            message: `Appointment #${appointment.appointmentNumber} for ${patientName} is now in progress.`,
            type: 'appointment_in_progress',
            priority: 'normal',
            module: 'appointments',
            relatedRecordId: appointment.id,
            redirectUrl: apptRedirect,
            dedupeKey: `appointment:${appointment.id}:in_progress`,
          }).catch((err) => console.error('[status] notify staff (in_progress) failed:', err))
        }
      }
    } catch (notifyErr) {
      console.error('[status] notification broadcast failed (non-fatal):', notifyErr)
    }

    return NextResponse.json({
      success: true,
      data: updatedAppointment
    })

  } catch (error) {
    console.error("Error updating appointment status:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: "Validation error",
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH handler - same as PUT (frontend uses PATCH)
export { PUT as PATCH }