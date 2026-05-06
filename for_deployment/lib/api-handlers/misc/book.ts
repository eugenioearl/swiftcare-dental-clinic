import { NextRequest, NextResponse } from 'next/server'
import { prisma, nextSequenceNumber } from '@/lib/db'
import { z } from 'zod'
import { getBookingSettings, effectiveMaxPerSlot } from '@/lib/booking-settings'
import { notifyRoles, ADMIN_STAFF_ROLES, buildAppointmentDeepLink } from '@/lib/notifications'
import { sendAdminNewAppointmentEmail } from '@/lib/email-notifications'

const bookingSchema = z.object({
  // Existing patient quick-book fields
  existingPatientId: z.string().uuid().optional(),
  bookingFlow: z.enum(['new', 'existing']).optional().default('new'),
  // New patient fields — name now split into parts
  firstName: z.string().optional(),
  middleName: z.string().optional(),
  lastName: z.string().optional(),
  // Legacy: allow clients to still send fullName (will be reassembled from parts if not provided)
  fullName: z.string().optional(),
  mobileNumber: z.string().min(10, 'Valid mobile number is required').optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  facebookName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
  medicalConditions: z.array(z.string()).optional(),
  dentalProblems: z.array(z.string()).optional(),
  allergies: z.string().optional(),
  currentMedications: z.string().optional(),
  dentalAnxiety: z.string().optional(),
  isPregnant: z.boolean().optional(),
  lastDentalVisit: z.string().optional(),
  preferredDate: z.string().min(1, 'Preferred date is required'),
  preferredTime: z.string().optional().default(''),
  appointmentType: z.enum(['scheduled', 'walk_in']).optional().default('scheduled'),
  serviceId: z.string().optional(),
  serviceName: z.string().optional(),
  customService: z.string().optional(),
  isEmergency: z.boolean().optional(),
  notes: z.string().optional(),
  source: z.string().optional(),
  campaign: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = bookingSchema.parse(body)

    // ─── EXISTING PATIENT QUICK-BOOK FLOW ───
    const isExistingFlow = data.bookingFlow === 'existing' && data.existingPatientId
    let patient: any = null
    let matchStatus = 'new_patient'

    if (isExistingFlow) {
      // Direct lookup — patient already verified via /api/book/verify-patient
      patient = await prisma.patient.findFirst({
        where: { id: data.existingPatientId, isActive: true },
      })
      if (!patient) {
        return NextResponse.json(
          { success: false, error: 'Patient not found. Please verify again.' },
          { status: 404 }
        )
      }
      matchStatus = 'existing_patient_quick_book'
    } else {
      // ─── NEW PATIENT FLOW ───
      // Required: firstName, lastName, mobileNumber, dateOfBirth, address
      const firstNameClean = (data.firstName || '').trim()
      const middleNameClean = (data.middleName || '').trim()
      const lastNameClean = (data.lastName || '').trim()

      // Backwards-compat: if client still sent fullName but no first/last, try to split.
      // Uses the first whitespace-delimited token as firstName, the last as lastName.
      let resolvedFirst = firstNameClean
      let resolvedMiddle = middleNameClean
      let resolvedLast = lastNameClean
      if ((!resolvedFirst || !resolvedLast) && data.fullName && data.fullName.trim().length >= 2) {
        const parts = data.fullName.trim().split(/\s+/)
        if (parts.length === 1) {
          resolvedFirst = resolvedFirst || parts[0]
        } else if (parts.length === 2) {
          resolvedFirst = resolvedFirst || parts[0]
          resolvedLast = resolvedLast || parts[1]
        } else if (parts.length >= 3) {
          resolvedFirst = resolvedFirst || parts[0]
          resolvedLast = resolvedLast || parts[parts.length - 1]
          resolvedMiddle = resolvedMiddle || parts.slice(1, -1).join(' ')
        }
      }

      if (!resolvedFirst || resolvedFirst.length < 1) {
        return NextResponse.json({ error: 'First name is required' }, { status: 400 })
      }
      if (!resolvedLast || resolvedLast.length < 1) {
        return NextResponse.json({ error: 'Last name is required' }, { status: 400 })
      }
      if (!data.mobileNumber || data.mobileNumber.replace(/[^0-9]/g, '').length < 10) {
        return NextResponse.json({ error: 'Valid mobile number is required' }, { status: 400 })
      }
      if (!data.dateOfBirth || !data.dateOfBirth.trim()) {
        return NextResponse.json({ error: 'Date of birth is required' }, { status: 400 })
      }
      if (!data.address || data.address.trim().length < 1) {
        return NextResponse.json({ error: 'Address is required' }, { status: 400 })
      }

      // Compose fullName from parts (always derived, even if client sent one)
      const composedFullName = [resolvedFirst, resolvedMiddle, resolvedLast]
        .map(s => s.trim())
        .filter(Boolean)
        .join(' ')

      // Clean mobile number
      const cleanMobile = data.mobileNumber!.replace(/[^0-9+]/g, '')
      const cleanEmail = data.email && data.email.trim() !== '' ? data.email.trim().toLowerCase() : null

      // PATIENT MATCHING LOGIC
      // Duplicate mobile numbers are allowed (families share phones), so we NEVER
      // auto-match by mobile number alone. The "new" booking flow always creates
      // a new patient record. Existing patients must use the "existing" flow via
      // /api/book/verify-patient to be linked to their record explicitly.
      patient = null
      matchStatus = 'new_patient'

      // Build medical history from conditions
      const medicalHistory = data.medicalConditions?.length
        ? data.medicalConditions.join(', ')
        : undefined

      // Build remarks from dental problems + last visit + pregnancy + anxiety
      const remarksParts: string[] = []
      if (data.dentalProblems?.length) remarksParts.push(`Dental problems: ${data.dentalProblems.join(', ')}`)
      if (data.lastDentalVisit) remarksParts.push(`Last dental visit: ${data.lastDentalVisit.replace(/_/g, ' ')}`)
      if (data.isPregnant) remarksParts.push('Currently pregnant/nursing')
      if (data.dentalAnxiety) remarksParts.push(`Dental anxiety: ${data.dentalAnxiety}`)
      if (data.facebookName) remarksParts.push(`Facebook: ${data.facebookName}`)
      const remarks = remarksParts.length > 0 ? remarksParts.join(' | ') : undefined

      // Always create a new patient record for the "new" booking flow.
      const patientNumber = await nextSequenceNumber('patients', 'patient_number', `P-${new Date().getFullYear()}-`, 4)

      patient = await prisma.patient.create({
        data: {
          patientNumber,
          fullName: composedFullName,
          firstName: resolvedFirst,
          middleName: resolvedMiddle || undefined,
          lastName: resolvedLast,
          mobileNumber: cleanMobile,
          emailDirect: cleanEmail,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth + 'T00:00:00Z') : undefined,
          address: data.address || undefined,
          medicalHistory: medicalHistory || undefined,
          allergies: data.allergies || undefined,
          currentMedications: data.currentMedications || undefined,
          dentalAnxieties: data.dentalAnxiety || undefined,
          pregnancyStatus: data.isPregnant ? 'pregnant_nursing' : undefined,
          remarks: remarks || undefined,
          source: data.source || 'direct',
          campaign: data.campaign || null,
        }
      })
    }

    // Determine appointment type — prefer service.defaultAppointmentType
    let appointmentType: string = 'consultation'
    let customAppointmentType: string | null = null
    let linkedService: any = null

    if (data.serviceId) {
      linkedService = await prisma.clinicService.findUnique({ where: { id: data.serviceId } })
      if (linkedService) {
        appointmentType = linkedService.defaultAppointmentType || 'consultation'
        customAppointmentType = linkedService.displayName || linkedService.name
      }
    } else if (data.customService) {
      appointmentType = 'other'
      customAppointmentType = data.customService
    }

    // Build reason for visit (including dental problems)
    const reasonParts: string[] = []
    if (data.customService || data.serviceName || customAppointmentType) {
      reasonParts.push(data.customService || data.serviceName || customAppointmentType || '')
    }
    if (data.dentalProblems?.length) {
      reasonParts.push(`Concerns: ${data.dentalProblems.join(', ')}`)
    }

    // Build scheduled datetime
    const isWalkIn = data.appointmentType === 'walk_in'
    let scheduledDatetime: Date
    if (isWalkIn || !data.preferredTime) {
      // Walk-in: set to 9:00 AM PHT on selected date (dentist will assign actual time)
      scheduledDatetime = new Date(`${data.preferredDate}T09:00:00.000+08:00`)
    } else {
      scheduledDatetime = new Date(`${data.preferredDate}T${data.preferredTime}:00.000+08:00`)
    }

    // Override appointmentType if walk-in
    if (isWalkIn) {
      appointmentType = 'walk_in'
    }

    // Enforce admin-configurable double-booking cap (skip for walk-ins, which
    // all funnel into a single placeholder 9:00 AM slot and are assigned later).
    if (!isWalkIn) {
      try {
        const bookingSettings = await getBookingSettings(scheduledDatetime)
        const MAX_PER_SLOT = effectiveMaxPerSlot(bookingSettings)
        const bookingsAtSlot = await prisma.appointment.count({
          where: {
            scheduledDatetime,
            status: { notIn: ['cancelled', 'no_show', 'completed'] },
          },
        })
        if (bookingsAtSlot >= MAX_PER_SLOT) {
          const msg = bookingSettings.doubleBookingEnabled
            ? `This time slot is fully booked (${MAX_PER_SLOT}/${MAX_PER_SLOT}). Please choose another time.`
            : `This time slot is already booked. Please choose another time.`
          return NextResponse.json({ success: false, error: msg }, { status: 409 })
        }
      } catch (err) {
        console.error('Double-booking cap check failed:', err)
      }
    }

    // Generate appointment number
    const appointmentNumber = await nextSequenceNumber('appointments', 'appointment_number', `A-${new Date().getFullYear()}-`, 4)

    // Create appointment
    const appointment = await prisma.appointment.create({
      data: {
        appointmentNumber,
        patientId: patient.id,
        scheduledDatetime,
        durationMinutes: linkedService?.duration || 30,
        status: isWalkIn ? 'waiting' : 'pending',
        appointmentType: appointmentType as any,
        customAppointmentType,
        reasonForVisit: reasonParts.join(' | ') || null,
        notes: data.notes || null,
        isEmergency: data.isEmergency || false,
        source: data.source || 'direct',
        campaign: data.campaign || null,
        patientMatchStatus: matchStatus,
        serviceId: linkedService?.id || null,
        estimatedCost: linkedService?.estimatedPrice || null,
      },
      include: { patient: true }
    })

    // Auto-link the service's default AppointmentTreatment entries for downstream
    // dental chart / procedures flows. Non-blocking if linkage fails.
    if (linkedService && Array.isArray(linkedService.linkedTreatmentIds) && linkedService.linkedTreatmentIds.length > 0) {
      try {
        const tIds = linkedService.linkedTreatmentIds as string[]
        // Only attach the first treatment as the primary planned treatment
        // (others remain available via the service linkage for the workspace picker).
        const primary = await prisma.treatment.findUnique({ where: { id: tIds[0] } })
        if (primary) {
          await prisma.appointmentTreatment.create({
            data: {
              appointmentId: appointment.id,
              treatmentId: primary.id,
              quantity: 1,
              unitCost: primary.baseCost,
              totalCost: primary.baseCost,
              status: 'planned'
            }
          })
        }
      } catch (e) {
        console.warn('[book] failed to auto-link service treatment:', e)
      }
    }

    // ─── Fire in-app notifications to staff/admin (fail-safe, non-blocking) ───
    try {
      const patientName =
        patient.fullName ||
        [patient.firstName, patient.lastName].filter(Boolean).join(' ') ||
        data.fullName ||
        'A patient'
      const whenStr = appointment.scheduledDatetime.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
      const serviceLabel = customAppointmentType || linkedService?.name || appointmentType

      if (data.isEmergency) {
        await notifyRoles(ADMIN_STAFF_ROLES, {
          title: '🚨 Emergency Appointment Request',
          message: `${patientName} requested an EMERGENCY ${serviceLabel} on ${whenStr}.`,
          type: 'emergency_appointment',
          priority: 'emergency',
          module: 'appointments',
          relatedRecordId: appointment.id,
          redirectUrl: buildAppointmentDeepLink(appointment.id, { tab: 'today' }),
          metadata: { appointmentNumber: appointment.appointmentNumber, isEmergency: true },
        })
      } else {
        await notifyRoles(ADMIN_STAFF_ROLES, {
          title: 'New Appointment Request',
          message: `${patientName} requested ${serviceLabel} on ${whenStr}.`,
          type: 'new_appointment_request',
          priority: 'normal',
          module: 'appointments',
          relatedRecordId: appointment.id,
          redirectUrl: buildAppointmentDeepLink(appointment.id, { tab: 'upcoming' }),
          metadata: { appointmentNumber: appointment.appointmentNumber },
        })
      }
    } catch (err) {
      console.warn('[book] failed to notify staff:', err)
    }

    // ─── Admin mailbox alert — every new booking, fail-safe ───
    try {
      const patientFullName =
        patient.fullName ||
        [patient.firstName, patient.lastName].filter(Boolean).join(' ') ||
        data.fullName ||
        'Patient'
      const source: 'walk_in' | 'patient_booking' | 'staff_booking' | 'admin_booking' | 'emergency' =
        data.isEmergency ? 'emergency' : isWalkIn ? 'walk_in' : 'patient_booking'
      sendAdminNewAppointmentEmail({
        appointmentId: appointment.id,
        appointmentNumber: appointment.appointmentNumber,
        appointmentType: appointment.appointmentType,
        scheduledDatetime: new Date(appointment.scheduledDatetime),
        patientName: patientFullName,
        patientEmail: (patient as any).emailDirect || data.email || undefined,
        patientPhone: (patient as any).mobileNumber || data.mobileNumber || undefined,
        notes: appointment.notes || appointment.reasonForVisit || undefined,
        status: appointment.status,
        source,
      }).catch((err) => console.error('[book] Admin mailbox alert failed:', err))
    } catch (alertErr) {
      console.error('[book] Admin mailbox alert wrapper failed:', alertErr)
    }

    return NextResponse.json({
      success: true,
      message: 'Appointment request submitted successfully!',
      data: {
        appointmentNumber: appointment.appointmentNumber,
        scheduledDatetime: appointment.scheduledDatetime,
        patientName: patient.fullName || [patient.firstName, patient.lastName].filter(Boolean).join(' ') || data.fullName || 'Patient',
        status: 'pending',
        bookingFlow: isExistingFlow ? 'existing' : 'new',
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating booking:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Please check your information',
        details: error.errors.map(e => e.message)
      }, { status: 400 })
    }

    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
