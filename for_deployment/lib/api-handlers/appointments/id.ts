

import { NextRequest, NextResponse } from "next/server"
import { getServerAuth } from "@/lib/auth"
import { canManageAppointments } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { sendAppointmentApprovalEmail, sendAppointmentRejectionEmail, sendAppointmentCancellationEmail, sendAppointmentRescheduleEmail, sendDentistAppointmentEmail } from "@/lib/email-notifications"
import { createNotification, notifyRoles, getDentistUserId, ADMIN_STAFF_ROLES, buildAppointmentDeepLink } from "@/lib/notifications"

// Helper: treat empty strings as undefined for optional fields
const updEmptyToUndef = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === '' || v === null ? undefined : v), schema)

// Helper: coerce numeric-like strings to numbers
const updNumberOrEmpty = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => {
    if (v === '' || v === null || v === undefined) return undefined
    if (typeof v === 'string') {
      const parsed = Number(v)
      return isNaN(parsed) ? v : parsed
    }
    return v
  }, schema)

const updateAppointmentSchema = z.object({
  dentistId: updEmptyToUndef(z.string().uuid().optional()),
  status: updEmptyToUndef(z.enum(['pending', 'pending_assignment', 'scheduled', 'confirmed', 'checked_in', 'waiting', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled', 'rejected']).optional()),
  scheduledDatetime: updEmptyToUndef(z.string().transform((str) => new Date(str)).optional()),
  durationMinutes: updNumberOrEmpty(z.number().min(15).max(240).optional()),
  appointmentType: updEmptyToUndef(z.enum(['consultation', 'cleaning', 'procedure', 'surgery', 'emergency', 'follow_up', 'x_ray', 'walk_in', 'other']).optional()),
  reasonForVisit: updEmptyToUndef(z.string().optional()),
  notes: updEmptyToUndef(z.string().optional()),
  isEmergency: z.boolean().optional(),
  estimatedCost: updNumberOrEmpty(z.number().min(0).optional()),
  cancellationReason: updEmptyToUndef(z.string().optional()),
  cancellationFee: updNumberOrEmpty(z.number().min(0).optional()),
  cancelledAt: updEmptyToUndef(z.string().transform((str) => new Date(str)).optional()),
  rejectionReason: updEmptyToUndef(z.string().optional())
})

// GET /api/appointments/[id] - Get single appointment
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: params.id },
      include: {
        patient: { include: { user: true } },
        dentist: { include: { user: true } },
        creator: true,
        appointmentTreatments: {
          include: {
            treatment: true
          }
        }
      }
    })

    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: { appointment }
    })

  } catch (error) {
    console.error("Error fetching appointment:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH /api/appointments/[id] - Update appointment
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permissions - staff can manage appointments, patients can only update their own
    const canUpdate = canManageAppointments(session.user?.role) || session.user?.role === 'patient'
    if (!canUpdate) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = updateAppointmentSchema.parse(body)

    // Get existing appointment to check ownership for patients
    const existingAppointment = await prisma.appointment.findUnique({
      where: { id: params.id },
      include: { patient: { include: { user: true } } }
    })

    if (!existingAppointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }

    // If user is a patient, ensure they can only update their own appointments
    if (session.user?.role === 'patient') {
      if (existingAppointment.patient.user?.id !== session.user?.id) {
        return NextResponse.json({ 
          error: "Patients can only update their own appointments" 
        }, { status: 403 })
      }
    }

    // Check for scheduling conflicts if datetime is being changed
    if (validatedData.scheduledDatetime || validatedData.dentistId) {
      const scheduledDatetime = validatedData.scheduledDatetime || existingAppointment.scheduledDatetime
      const dentistId = validatedData.dentistId || existingAppointment.dentistId

      if (dentistId) {
        const conflictingAppointment = await prisma.appointment.findFirst({
          where: {
            dentistId: dentistId,
            scheduledDatetime: scheduledDatetime,
            status: {
              notIn: ['cancelled', 'no_show', 'completed']
            },
            id: {
              not: params.id // Exclude current appointment
            }
          }
        })

        if (conflictingAppointment) {
          return NextResponse.json({
            error: "Time slot is already booked for this dentist"
          }, { status: 409 })
        }
      }
    }

    // Update the appointment
    const updateData: any = { 
      ...validatedData,
      // Add cancelledBy field if status is being changed to cancelled
      ...(validatedData.status === 'cancelled' && { cancelledBy: session.user?.id }),
      // Add rejection fields
      ...(validatedData.status === 'rejected' && { rejectedAt: new Date(), rejectionReason: validatedData.rejectionReason || 'No reason provided' }),
    }
    // Remove rejectionReason from top-level since it's set above
    if (validatedData.status !== 'rejected') {
      delete updateData.rejectionReason
    }

    const updatedAppointment = await prisma.appointment.update({
      where: { id: params.id },
      data: updateData,
      include: {
        patient: { include: { user: true } },
        dentist: { include: { user: true } },
        creator: true,
        appointmentTreatments: {
          include: {
            treatment: true
          }
        }
      }
    })

    // Log the update - only store serializable values
    try {
      await prisma.auditLog.create({
        data: {
          userId: session.user?.id,
          action: 'update',
          entityType: 'appointment',
          entityId: params.id,
          oldValues: {
            dentistId: existingAppointment.dentistId,
            status: existingAppointment.status,
            scheduledDatetime: existingAppointment.scheduledDatetime?.toISOString(),
            notes: existingAppointment.notes
          },
          newValues: {
            ...validatedData,
            scheduledDatetime: validatedData.scheduledDatetime?.toISOString()
          },
          ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1'
        }
      })
    } catch (auditError) {
      // Don't fail the main operation if audit logging fails
      console.error("Audit log error:", auditError)
    }

    // Send email notification when appointment is approved/confirmed
    const approvalStatuses = ['confirmed', 'scheduled']
    const previousStatus = existingAppointment.status
    const newStatus = validatedData.status

    // Determine patient email - support both linked user and direct patient email
    const patientUser = updatedAppointment.patient?.user
    const patientEmail = (updatedAppointment.patient as any)?.emailDirect || patientUser?.email
    const patientName = (updatedAppointment.patient as any)?.fullName || (patientUser ? `${patientUser.lastName}, ${patientUser.firstName}` : 'Patient')

    // Only send email if status changed TO an approval status (not if it was already approved)
    console.log(`[Notification] Status change: ${previousStatus} → ${newStatus}, patientEmail: ${patientEmail || 'NONE'}`)
    if (newStatus && approvalStatuses.includes(newStatus) && !approvalStatuses.includes(previousStatus)) {
      try {
        const dentistUser = updatedAppointment.dentist?.user

        if (patientEmail) {
          sendAppointmentApprovalEmail({
            appointmentId: updatedAppointment.id,
            appointmentNumber: updatedAppointment.appointmentNumber,
            appointmentType: updatedAppointment.appointmentType,
            scheduledDatetime: new Date(updatedAppointment.scheduledDatetime),
            durationMinutes: updatedAppointment.durationMinutes,
            patientName,
            patientEmail,
            dentistName: dentistUser ? `${dentistUser.lastName}, ${dentistUser.firstName}` : undefined,
            reasonForVisit: updatedAppointment.reasonForVisit || undefined
          }).catch(err => {
            console.error('Failed to send appointment approval email:', err)
          })
        }
        // In-app notification for the patient (if they have a user account)
        if (updatedAppointment.patient?.user?.id) {
          await createNotification({
            userId: updatedAppointment.patient.user.id,
            title: 'Appointment Confirmed ✓',
            message: `Your appointment #${updatedAppointment.appointmentNumber} on ${new Date(updatedAppointment.scheduledDatetime).toLocaleString()} has been confirmed.`,
            type: 'appointment_approved',
            priority: 'normal',
            module: 'appointments',
            relatedRecordId: updatedAppointment.id,
            redirectUrl: `/patient/appointments`,
            metadata: { appointmentNumber: updatedAppointment.appointmentNumber },
          })
        }
      } catch (emailError) {
        console.error("Email notification error:", emailError)
      }
    }

    // Send rejection email
    if (newStatus === 'rejected' && previousStatus !== 'rejected') {
      try {
        if (patientEmail) {
          sendAppointmentRejectionEmail({
            appointmentNumber: updatedAppointment.appointmentNumber,
            appointmentType: updatedAppointment.appointmentType,
            scheduledDatetime: new Date(updatedAppointment.scheduledDatetime),
            patientName,
            patientEmail,
            rejectionReason: validatedData.rejectionReason || 'No reason provided'
          }).catch(err => {
            console.error('Failed to send appointment rejection email:', err)
          })
        }
        // In-app notification for the patient (if they have a user account)
        if (updatedAppointment.patient?.user?.id) {
          await createNotification({
            userId: updatedAppointment.patient.user.id,
            title: 'Appointment Request Declined',
            message: `Your appointment #${updatedAppointment.appointmentNumber} on ${new Date(updatedAppointment.scheduledDatetime).toLocaleString()} could not be accommodated${validatedData.rejectionReason ? `: ${validatedData.rejectionReason}` : '.'}`,
            type: 'appointment_rejected',
            priority: 'high',
            module: 'appointments',
            relatedRecordId: updatedAppointment.id,
            redirectUrl: `/patient/appointments`,
            metadata: { appointmentNumber: updatedAppointment.appointmentNumber, reason: validatedData.rejectionReason },
          })
        }
      } catch (emailError) {
        console.error("Rejection email error:", emailError)
      }
    }

    // Send cancellation email + in-app notification
    if (newStatus === 'cancelled' && previousStatus !== 'cancelled') {
      try {
        if (patientEmail) {
          sendAppointmentCancellationEmail({
            appointmentNumber: updatedAppointment.appointmentNumber,
            appointmentType: updatedAppointment.appointmentType,
            scheduledDatetime: new Date(updatedAppointment.scheduledDatetime),
            patientName,
            patientEmail,
            cancellationReason: validatedData.cancellationReason || undefined
          }).catch(err => {
            console.error('Failed to send appointment cancellation email:', err)
          })
        }
        // Create in-app notification if patient has a user account
        if (updatedAppointment.patient?.user?.id) {
          await createNotification({
            userId: updatedAppointment.patient.user.id,
            title: 'Appointment Cancelled',
            message: `Your appointment #${updatedAppointment.appointmentNumber} scheduled for ${new Date(updatedAppointment.scheduledDatetime).toLocaleString()} has been cancelled${validatedData.cancellationReason ? `: ${validatedData.cancellationReason}` : '.'}`,
            type: 'appointment_cancelled',
            priority: 'high',
            module: 'appointments',
            relatedRecordId: updatedAppointment.id,
            redirectUrl: `/patient/appointments`,
            metadata: { appointmentNumber: updatedAppointment.appointmentNumber, reason: validatedData.cancellationReason },
          })
        }
        // Notify assigned dentist (in-app + email)
        const dentistUserIdForCancel = updatedAppointment.dentist?.user?.id
        if (dentistUserIdForCancel) {
          await createNotification({
            userId: dentistUserIdForCancel,
            title: 'Appointment Cancelled',
            message: `Appointment #${updatedAppointment.appointmentNumber} (${patientName}) on ${new Date(updatedAppointment.scheduledDatetime).toLocaleString()} was cancelled.`,
            type: 'appointment_cancelled',
            priority: 'high',
            module: 'appointments',
            relatedRecordId: updatedAppointment.id,
            redirectUrl: buildAppointmentDeepLink(updatedAppointment.id, { forUserId: dentistUserIdForCancel, tab: 'upcoming' }),
            metadata: { appointmentNumber: updatedAppointment.appointmentNumber },
          })
          const dentistUser = updatedAppointment.dentist?.user
          if (dentistUser?.email) {
            sendDentistAppointmentEmail({
              eventKind: 'cancelled',
              dentistEmail: dentistUser.email,
              dentistName: `${dentistUser.lastName || ''}, ${dentistUser.firstName || ''}`.trim(),
              appointmentNumber: updatedAppointment.appointmentNumber,
              appointmentType: updatedAppointment.appointmentType,
              scheduledDatetime: new Date(updatedAppointment.scheduledDatetime),
              patientName,
              reason: validatedData.cancellationReason || undefined,
              appointmentId: updatedAppointment.id,
              dentistUserId: dentistUser.id,
            }).catch(err => console.error('Failed to send dentist cancellation email:', err))
          }
        }
      } catch (emailError) {
        console.error("Cancellation email error:", emailError)
      }
    }

    // Send reschedule email + in-app notification when datetime changed (but not when first confirming)
    const datetimeChanged = validatedData.scheduledDatetime &&
      new Date(validatedData.scheduledDatetime).getTime() !== new Date(existingAppointment.scheduledDatetime).getTime()
    if (datetimeChanged && newStatus !== 'cancelled' && newStatus !== 'rejected') {
      try {
        if (patientEmail) {
          const dentistUser = updatedAppointment.dentist?.user
          sendAppointmentRescheduleEmail({
            appointmentNumber: updatedAppointment.appointmentNumber,
            appointmentType: updatedAppointment.appointmentType,
            oldDatetime: new Date(existingAppointment.scheduledDatetime),
            newDatetime: new Date(updatedAppointment.scheduledDatetime),
            durationMinutes: updatedAppointment.durationMinutes,
            patientName,
            patientEmail,
            dentistName: dentistUser ? `${dentistUser.lastName}, ${dentistUser.firstName}` : undefined,
          }).catch(err => {
            console.error('Failed to send appointment reschedule email:', err)
          })
        }
        if (updatedAppointment.patient?.user?.id) {
          await createNotification({
            userId: updatedAppointment.patient.user.id,
            title: 'Appointment Rescheduled',
            message: `Your appointment #${updatedAppointment.appointmentNumber} has been rescheduled from ${new Date(existingAppointment.scheduledDatetime).toLocaleString()} to ${new Date(updatedAppointment.scheduledDatetime).toLocaleString()}.`,
            type: 'appointment_rescheduled',
            priority: 'high',
            module: 'appointments',
            relatedRecordId: updatedAppointment.id,
            redirectUrl: `/patient/appointments`,
            metadata: {
              appointmentNumber: updatedAppointment.appointmentNumber,
              oldDatetime: new Date(existingAppointment.scheduledDatetime).toISOString(),
              newDatetime: new Date(updatedAppointment.scheduledDatetime).toISOString(),
            },
          })
        }
        // Notify assigned dentist (in-app + email)
        const dentistUserIdForResched = updatedAppointment.dentist?.user?.id
        if (dentistUserIdForResched) {
          await createNotification({
            userId: dentistUserIdForResched,
            title: 'Appointment Rescheduled',
            message: `Appointment #${updatedAppointment.appointmentNumber} (${patientName}) was rescheduled to ${new Date(updatedAppointment.scheduledDatetime).toLocaleString()}.`,
            type: 'appointment_rescheduled',
            priority: 'high',
            module: 'appointments',
            relatedRecordId: updatedAppointment.id,
            redirectUrl: buildAppointmentDeepLink(updatedAppointment.id, { forUserId: dentistUserIdForResched, tab: 'upcoming' }),
            metadata: { appointmentNumber: updatedAppointment.appointmentNumber },
          })
          const dentistUser = updatedAppointment.dentist?.user
          if (dentistUser?.email) {
            sendDentistAppointmentEmail({
              eventKind: 'rescheduled',
              dentistEmail: dentistUser.email,
              dentistName: `${dentistUser.lastName || ''}, ${dentistUser.firstName || ''}`.trim(),
              appointmentNumber: updatedAppointment.appointmentNumber,
              appointmentType: updatedAppointment.appointmentType,
              scheduledDatetime: new Date(updatedAppointment.scheduledDatetime),
              oldDatetime: new Date(existingAppointment.scheduledDatetime),
              patientName,
              appointmentId: updatedAppointment.id,
              dentistUserId: dentistUser.id,
            }).catch(err => console.error('Failed to send dentist reschedule email:', err))
          }
        }
      } catch (emailError) {
        console.error("Reschedule email error:", emailError)
      }
    }

    // ─── Dentist assignment notification (fires when dentist is newly assigned or changed) ───
    try {
      const newDentistId = validatedData.dentistId
      const previousDentistId = existingAppointment.dentistId
      const dentistChanged = newDentistId && newDentistId !== previousDentistId
      if (dentistChanged) {
        const assignedDentistUserId = updatedAppointment.dentist?.user?.id
        if (assignedDentistUserId) {
          const isEmergencyAppt = updatedAppointment.isEmergency === true
          await createNotification({
            userId: assignedDentistUserId,
            title: isEmergencyAppt ? '🚨 Emergency Appointment Assigned' : 'New Appointment Assigned',
            message: `${patientName} — ${updatedAppointment.appointmentType.replace(/_/g, ' ')} on ${new Date(updatedAppointment.scheduledDatetime).toLocaleString()}.`,
            type: isEmergencyAppt ? 'emergency_appointment' : 'dentist_assigned',
            priority: isEmergencyAppt ? 'emergency' : 'important',
            module: 'appointments',
            relatedRecordId: updatedAppointment.id,
            redirectUrl: buildAppointmentDeepLink(updatedAppointment.id, { forUserId: assignedDentistUserId, tab: 'upcoming' }),
            metadata: { appointmentNumber: updatedAppointment.appointmentNumber, isEmergency: isEmergencyAppt },
          })
          const dentistUser = updatedAppointment.dentist?.user
          if (dentistUser?.email) {
            sendDentistAppointmentEmail({
              eventKind: isEmergencyAppt ? 'emergency' : 'assigned',
              dentistEmail: dentistUser.email,
              dentistName: `${dentistUser.lastName || ''}, ${dentistUser.firstName || ''}`.trim(),
              appointmentNumber: updatedAppointment.appointmentNumber,
              appointmentType: updatedAppointment.appointmentType,
              scheduledDatetime: new Date(updatedAppointment.scheduledDatetime),
              patientName,
              appointmentId: updatedAppointment.id,
              dentistUserId: dentistUser.id,
            }).catch(err => console.error('Failed to send dentist assigned email:', err))
          }
        }
      }
    } catch (dentistErr) {
      console.error("Dentist assignment notification error:", dentistErr)
    }

    // ---------- Phase 2: Staff/admin broadcast for status transitions ----------
    try {
      const scheduledTimeDisplay = new Date(updatedAppointment.scheduledDatetime).toLocaleString('en-PH', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
      const apptRedirect = buildAppointmentDeepLink(updatedAppointment.id, { tab: 'upcoming' })
      const dentistUserIdPhase2 = updatedAppointment.dentist?.user?.id

      if (newStatus && newStatus !== previousStatus) {
        // Staff/admin broadcast for cancellation (patient/dentist already notified above)
        if (newStatus === 'cancelled') {
          await notifyRoles(ADMIN_STAFF_ROLES, {
            title: 'Appointment Cancelled',
            message: `Appointment #${updatedAppointment.appointmentNumber} for ${patientName} was cancelled (${scheduledTimeDisplay})${validatedData.cancellationReason ? `: ${validatedData.cancellationReason}` : '.'}`,
            type: 'appointment_cancelled',
            priority: 'important',
            module: 'appointments',
            relatedRecordId: updatedAppointment.id,
            redirectUrl: apptRedirect,
            dedupeKey: `appointment:${updatedAppointment.id}:cancelled`,
          }).catch((err) => console.error('[id PUT] notify staff (cancelled) failed:', err))
        }

        // Completed — notify staff/admin + dentist (patient via patientNotification below if enabled)
        if (newStatus === 'completed') {
          await notifyRoles(ADMIN_STAFF_ROLES, {
            title: 'Appointment Completed',
            message: `Appointment #${updatedAppointment.appointmentNumber} for ${patientName} was marked completed (${scheduledTimeDisplay}).`,
            type: 'appointment_completed',
            priority: 'normal',
            module: 'appointments',
            relatedRecordId: updatedAppointment.id,
            redirectUrl: apptRedirect,
            dedupeKey: `appointment:${updatedAppointment.id}:completed`,
          }).catch((err) => console.error('[id PUT] notify staff (completed) failed:', err))

          if (dentistUserIdPhase2) {
            await createNotification({
              userId: dentistUserIdPhase2,
              title: 'Appointment Marked Completed',
              message: `Appointment #${updatedAppointment.appointmentNumber} for ${patientName} has been completed.`,
              type: 'appointment_completed',
              priority: 'normal',
              module: 'appointments',
              relatedRecordId: updatedAppointment.id,
              redirectUrl: apptRedirect,
            }).catch((err) => console.error('[id PUT] notify dentist (completed) failed:', err))
          }

          if (updatedAppointment.patient?.user?.id) {
            await createNotification({
              userId: updatedAppointment.patient.user.id,
              title: 'Appointment Completed',
              message: `Your appointment #${updatedAppointment.appointmentNumber} on ${scheduledTimeDisplay} has been completed. Thank you!`,
              type: 'appointment_completed',
              priority: 'normal',
              module: 'appointments',
              relatedRecordId: updatedAppointment.id,
              redirectUrl: '/patient/appointments',
            }).catch((err) => console.error('[id PUT] notify patient (completed) failed:', err))
          }
        }

        // No-show — notify staff/admin + dentist
        if (newStatus === 'no_show') {
          await notifyRoles(ADMIN_STAFF_ROLES, {
            title: 'Patient No-Show',
            message: `${patientName} did not show up for appointment #${updatedAppointment.appointmentNumber} (${scheduledTimeDisplay}).`,
            type: 'appointment_no_show',
            priority: 'important',
            module: 'appointments',
            relatedRecordId: updatedAppointment.id,
            redirectUrl: apptRedirect,
            dedupeKey: `appointment:${updatedAppointment.id}:no_show`,
          }).catch((err) => console.error('[id PUT] notify staff (no-show) failed:', err))

          if (dentistUserIdPhase2) {
            await createNotification({
              userId: dentistUserIdPhase2,
              title: 'Patient No-Show',
              message: `${patientName} did not show up for the ${scheduledTimeDisplay} slot.`,
              type: 'appointment_no_show',
              priority: 'important',
              module: 'appointments',
              relatedRecordId: updatedAppointment.id,
              redirectUrl: apptRedirect,
            }).catch((err) => console.error('[id PUT] notify dentist (no-show) failed:', err))
          }
        }

        // In-progress — heads-up to staff
        if (newStatus === 'in_progress') {
          await notifyRoles(ADMIN_STAFF_ROLES, {
            title: 'Appointment Started',
            message: `Appointment #${updatedAppointment.appointmentNumber} for ${patientName} is now in progress.`,
            type: 'appointment_in_progress',
            priority: 'normal',
            module: 'appointments',
            relatedRecordId: updatedAppointment.id,
            redirectUrl: apptRedirect,
            dedupeKey: `appointment:${updatedAppointment.id}:in_progress`,
          }).catch((err) => console.error('[id PUT] notify staff (in_progress) failed:', err))
        }
      }
    } catch (statusNotifyErr) {
      console.error('[id PUT] status transition notification failed (non-fatal):', statusNotifyErr)
    }

    return NextResponse.json({
      success: true,
      message: "Appointment updated successfully",
      data: { appointment: updatedAppointment }
    })

  } catch (error) {
    console.error("Error updating appointment:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: "Invalid data format",
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/appointments/[id] - Cancel appointment
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permissions
    const canDelete = canManageAppointments(session.user?.role) || session.user?.role === 'patient'
    if (!canDelete) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    
    // Parse request body for cancellation reason
    const body = await request.json().catch(() => ({}))
    const cancellationReason = body.cancellationReason || 'Cancelled by user'

    // Get existing appointment to check ownership for patients
    const existingAppointment = await prisma.appointment.findUnique({
      where: { id: params.id },
      include: { patient: { include: { user: true } } }
    })

    if (!existingAppointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }

    // If user is a patient, ensure they can only cancel their own appointments
    if (session.user?.role === 'patient') {
      if (existingAppointment.patient.user?.id !== session.user?.id) {
        return NextResponse.json({ 
          error: "Patients can only cancel their own appointments" 
        }, { status: 403 })
      }
      
      // Check 24-hour cancellation policy for patients
      const appointmentTime = new Date(existingAppointment.scheduledDatetime)
      const currentTime = new Date()
      const hoursDifference = (appointmentTime.getTime() - currentTime.getTime()) / (1000 * 60 * 60)
      
      if (hoursDifference < 24) {
        return NextResponse.json({
          error: "Appointments can only be cancelled with at least 24 hours notice"
        }, { status: 400 })
      }
    }

    // Update appointment status to cancelled instead of hard delete
    const cancelledAppointment = await prisma.appointment.update({
      where: { id: params.id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledBy: session.user?.id,
        cancellationReason
      },
      include: {
        patient: { include: { user: true } },
        dentist: { include: { user: true } }
      }
    })

    // Log the cancellation
    await prisma.auditLog.create({
      data: {
        userId: session.user?.id,
        action: 'update',
        entityType: 'appointment',
        entityId: params.id,
        oldValues: existingAppointment,
        newValues: { status: 'cancelled' },
        ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1'
      }
    })

    // Send cancellation email to patient
    try {
      const patientUser = cancelledAppointment.patient?.user
      const patientEmail = (cancelledAppointment.patient as any)?.emailDirect || patientUser?.email
      const patientName = (cancelledAppointment.patient as any)?.fullName || (patientUser ? `${patientUser.lastName}, ${patientUser.firstName}` : 'Patient')

      if (patientEmail) {
        sendAppointmentCancellationEmail({
          appointmentNumber: cancelledAppointment.appointmentNumber,
          appointmentType: cancelledAppointment.appointmentType,
          scheduledDatetime: new Date(cancelledAppointment.scheduledDatetime),
          patientName,
          patientEmail,
          cancellationReason
        }).catch(err => console.error('Failed to send cancellation email:', err))
      }

      if (cancelledAppointment.patient?.user?.id) {
        await createNotification({
          userId: cancelledAppointment.patient.user.id,
          title: 'Appointment Cancelled',
          message: `Your appointment #${cancelledAppointment.appointmentNumber} scheduled for ${new Date(cancelledAppointment.scheduledDatetime).toLocaleString()} has been cancelled${cancellationReason ? `: ${cancellationReason}` : '.'}`,
          type: 'appointment_cancelled',
          priority: 'high',
          module: 'appointments',
          relatedRecordId: cancelledAppointment.id,
          redirectUrl: `/patient/appointments`,
          metadata: { appointmentNumber: cancelledAppointment.appointmentNumber, reason: cancellationReason },
        })
      }
      // Notify assigned dentist if present
      const delDentistUserId = cancelledAppointment.dentist?.user?.id
      if (delDentistUserId) {
        await createNotification({
          userId: delDentistUserId,
          title: 'Appointment Cancelled',
          message: `Appointment #${cancelledAppointment.appointmentNumber} (${patientName}) was cancelled.`,
          type: 'appointment_cancelled',
          priority: 'high',
          module: 'appointments',
          relatedRecordId: cancelledAppointment.id,
          redirectUrl: buildAppointmentDeepLink(cancelledAppointment.id, { forUserId: delDentistUserId, tab: 'upcoming' }),
          metadata: { appointmentNumber: cancelledAppointment.appointmentNumber },
        })
        const dentistUser = cancelledAppointment.dentist?.user
        if (dentistUser?.email) {
          sendDentistAppointmentEmail({
            eventKind: 'cancelled',
            dentistEmail: dentistUser.email,
            dentistName: `${dentistUser.lastName || ''}, ${dentistUser.firstName || ''}`.trim(),
            appointmentNumber: cancelledAppointment.appointmentNumber,
            appointmentType: cancelledAppointment.appointmentType,
            scheduledDatetime: new Date(cancelledAppointment.scheduledDatetime),
            patientName,
            reason: cancellationReason,
            appointmentId: cancelledAppointment.id,
            dentistUserId: dentistUser.id,
          }).catch(err => console.error('Failed to send dentist cancellation email:', err))
        }
      }

      // ---------- Phase 2: Staff/admin broadcast for DELETE-style cancellation ----------
      const scheduledTimeDisplay = new Date(cancelledAppointment.scheduledDatetime).toLocaleString('en-PH', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
      await notifyRoles(ADMIN_STAFF_ROLES, {
        title: 'Appointment Cancelled',
        message: `Appointment #${cancelledAppointment.appointmentNumber} for ${patientName} was cancelled (${scheduledTimeDisplay})${cancellationReason ? `: ${cancellationReason}` : '.'}`,
        type: 'appointment_cancelled',
        priority: 'important',
        module: 'appointments',
        relatedRecordId: cancelledAppointment.id,
        redirectUrl: buildAppointmentDeepLink(cancelledAppointment.id, { tab: 'upcoming' }),
        dedupeKey: `appointment:${cancelledAppointment.id}:cancelled`,
      }).catch((err) => console.error('[id DELETE] notify staff/admin failed:', err))
    } catch (notifErr) {
      console.error('Cancellation notification error:', notifErr)
    }

    return NextResponse.json({
      success: true,
      message: "Appointment cancelled successfully",
      data: { appointment: cancelledAppointment }
    })

  } catch (error) {
    console.error("Error cancelling appointment:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

