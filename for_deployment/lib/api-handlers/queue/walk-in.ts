

import { NextRequest, NextResponse } from "next/server"
import { getServerAuth, canManageAppointments } from "@/lib/auth"
import { prisma, nextSequenceNumber } from "@/lib/db"
import { z } from "zod"
import { createNotification, notifyRoles, ADMIN_STAFF_ROLES } from "@/lib/notifications"
import { sendAdminNewAppointmentEmail } from "@/lib/email-notifications"

const walkInSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  phone: z.string().min(10).max(15).optional(),
  email: z.string().email().optional(),
  reasonForVisit: z.string().min(1).max(500),
  isEmergency: z.boolean().default(false)
})

// POST /api/queue/walk-in - Add walk-in patient to queue
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canManageAppointments(session.user?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = walkInSchema.parse(body)

    // Check if patient already exists by email or phone
    let existingUser = null
    if (validatedData.email) {
      existingUser = await prisma.user?.findUnique({
        where: { email: validatedData.email }
      })
    }

    if (!existingUser && validatedData.phone) {
      existingUser = await prisma.user?.findFirst({
        where: { phone: validatedData.phone }
      })
    }

    let patient = null

    if (existingUser) {
      // Find existing patient record
      patient = await prisma.patient.findUnique({
        where: { userId: existingUser.id }
      })
    }

    // Create new user and patient if they don't exist
    if (!existingUser) {
      const tempPassword = Math.random().toString(36).substring(7) // Temporary password
      const bcrypt = require('bcryptjs')
      const passwordHash = await bcrypt.hash(tempPassword, 10)

      existingUser = await prisma.user?.create({
        data: {
          email: validatedData.email || `walkin_${Date.now()}@temp.local`,
          passwordHash,
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          phone: validatedData.phone,
          role: 'patient',
          isActive: true
        }
      })

      // Generate patient number
      const patientNumber = await nextSequenceNumber('patients', 'patient_number', `P-${new Date().getFullYear()}-`, 4)

      patient = await prisma.patient.create({
        data: {
          userId: existingUser.id,
          patientNumber,
          dateOfBirth: new Date('1990-01-01'), // Default DOB for walk-ins - can be updated later
          isActive: true
        }
      })
    }

    if (!patient) {
      return NextResponse.json({ error: "Failed to create patient record" }, { status: 500 })
    }

    // Generate appointment number
    const appointmentNumber = await nextSequenceNumber('appointments', 'appointment_number', `A-${new Date().getFullYear()}-`, 4)

    // Create walk-in appointment
    const appointment = await prisma.appointment.create({
      data: {
        appointmentNumber,
        patientId: patient.id,
        createdBy: session.user?.id,
        scheduledDatetime: new Date(), // Walk-in is immediate
        durationMinutes: 30, // Default duration
        appointmentType: 'walk_in',
        reasonForVisit: validatedData.reasonForVisit,
        status: 'checked_in', // Walk-ins are already checked in
        isEmergency: validatedData.isEmergency,
        checkedInAt: new Date(),
        notes: `Walk-in patient added by ${session.user?.name || session.user?.email}`
      },
      include: {
        patient: { include: { user: true } }
      }
    })

    // Add to notification queue (welcome notification for the patient)
    await prisma.notification.create({
      data: {
        userId: patient.userId,
        type: 'system_alert',
        title: 'Welcome to SwiftCare Dental',
        message: `You have been added to the walk-in queue. Appointment number: ${appointmentNumber}`,
        module: 'queue',
        relatedRecordId: appointment.id,
        redirectUrl: '/patient/appointments'
      }
    }).catch((err: any) => console.error('Failed to create welcome notification:', err))

    // ─── In-app notifications for staff/admin (fail-safe) ───
    try {
      const patientName = `${validatedData.firstName} ${validatedData.lastName}`.trim()
      if (validatedData.isEmergency) {
        await notifyRoles(ADMIN_STAFF_ROLES, {
          title: '🚨 Emergency Walk-in Patient',
          message: `${patientName} — ${validatedData.reasonForVisit.slice(0, 120)}`,
          type: 'emergency_appointment',
          priority: 'emergency',
          module: 'queue',
          relatedRecordId: appointment.id,
          redirectUrl: '/admin/queue',
          metadata: { appointmentNumber, isEmergency: true, walkIn: true },
        })
      } else {
        await notifyRoles(ADMIN_STAFF_ROLES, {
          title: 'Walk-in Patient Added',
          message: `${patientName} checked in: ${validatedData.reasonForVisit.slice(0, 120)}`,
          type: 'patient_checked_in',
          priority: 'important',
          module: 'queue',
          relatedRecordId: appointment.id,
          redirectUrl: '/admin/queue',
          metadata: { appointmentNumber, walkIn: true },
        })
      }
    } catch (notifErr) {
      console.error('Walk-in notification error:', notifErr)
    }

    // ─── Admin mailbox alert — every walk-in, fail-safe ───
    try {
      const patientUser = (appointment as any).patient?.user
      const patientFullName =
        (appointment as any).patient?.fullName ||
        `${validatedData.firstName} ${validatedData.lastName}`.trim() ||
        'Walk-in Patient'
      const source: 'walk_in' | 'emergency' = validatedData.isEmergency ? 'emergency' : 'walk_in'
      sendAdminNewAppointmentEmail({
        appointmentId: appointment.id,
        appointmentNumber: appointment.appointmentNumber,
        appointmentType: appointment.appointmentType,
        scheduledDatetime: new Date(appointment.scheduledDatetime),
        patientName: patientFullName,
        patientEmail: patientUser?.email || validatedData.email || undefined,
        patientPhone: (appointment as any).patient?.mobileNumber || validatedData.phone || undefined,
        notes: appointment.notes || appointment.reasonForVisit || undefined,
        status: appointment.status,
        source,
      }).catch((err) => console.error('[walk-in] Admin mailbox alert failed:', err))
    } catch (alertErr) {
      console.error('[walk-in] Admin mailbox alert wrapper failed:', alertErr)
    }

    return NextResponse.json({
      success: true,
      message: "Walk-in patient added to queue successfully",
      data: { 
        appointment,
        isNewPatient: !existingUser
      }
    })

  } catch (error) {
    console.error("Error adding walk-in patient:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: "Invalid data format",
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
