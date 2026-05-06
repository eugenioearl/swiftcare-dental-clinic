
import { NextRequest, NextResponse } from "next/server"
import { getServerAuth, canManageAppointments } from "@/lib/auth"
import { prisma, nextSequenceNumber } from "@/lib/db"
import { z } from "zod"
import { sendAppointmentApprovalEmail, sendDentistAppointmentEmail, sendAdminNewAppointmentEmail } from "@/lib/email-notifications"
import { createNotification, notifyRoles, ADMIN_STAFF_ROLES, buildAppointmentDeepLink } from "@/lib/notifications"
import { getBookingSettings, effectiveMaxPerSlot } from "@/lib/booking-settings"
import { getClinicTodayRange } from "@/lib/clinic-hours"

// Define required forms for different appointment types
interface RequiredForm {
  type: string
  title: string
  documentType: 'intake_form' | 'consent_form' | 'other'
  priority: 'high' | 'normal' | 'low'
}

function getRequiredForms(appointmentType: string, isEmergency: boolean): RequiredForm[] {
  const baseForms: RequiredForm[] = [
    {
      type: 'patient-intake',
      title: 'Patient Intake Form',
      documentType: 'intake_form',
      priority: 'high'
    },
    {
      type: 'medical-history',
      title: 'Medical History Form',
      documentType: 'intake_form',
      priority: 'high'
    },
    {
      type: 'general-consent',
      title: 'General Treatment Consent',
      documentType: 'consent_form',
      priority: 'high'
    }
  ]

  const additionalForms: RequiredForm[] = []

  // Add forms based on appointment type
  switch (appointmentType) {
    case 'x_ray':
      additionalForms.push({
        type: 'xray-consent',
        title: 'X-Ray Consent Form',
        documentType: 'consent_form',
        priority: 'high'
      })
      break
      
    case 'surgery':
    case 'procedure':
      additionalForms.push(
        {
          type: 'anesthesia-consent',
          title: 'Anesthesia Consent Form',
          documentType: 'consent_form',
          priority: 'high'
        },
        {
          type: 'financial-agreement',
          title: 'Financial Agreement',
          documentType: 'consent_form',
          priority: 'normal'
        }
      )
      break
      
    case 'emergency':
      // Emergency appointments require immediate consent only
      if (isEmergency) {
        return [
          {
            type: 'emergency-consent',
            title: 'Emergency Treatment Consent',
            documentType: 'consent_form',
            priority: 'high'
          }
        ]
      }
      break
      
    default:
      // Standard appointments require all base forms
      break
  }

  return [...baseForms, ...additionalForms]
}

// Helper: treat empty strings as undefined for optional fields coming from forms
const aptEmptyToUndef = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === '' || v === null ? undefined : v), schema)

// Helper: coerce numeric-like strings to numbers (for estimatedCost etc.)
const aptNumberOrEmpty = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => {
    if (v === '' || v === null || v === undefined) return undefined
    if (typeof v === 'string') {
      const parsed = Number(v)
      return isNaN(parsed) ? v : parsed
    }
    return v
  }, schema)

const appointmentSchema = z.object({
  patientId: z.string().uuid(),
  dentistId: aptEmptyToUndef(z.string().uuid().optional()), // Optional for patient bookings
  scheduledDatetime: z.string().transform((str) => {
    const date = new Date(str)
    const now = new Date()
    
    // Only check if it's significantly in the past (allow 5 min buffer for walk-ins)
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000)
    if (date < fiveMinAgo) {
      throw new Error('Cannot book appointments in the past')
    }
    
    // Note: Business hours validation is handled by the available-slots API
    // which properly accounts for timezone differences. Server-side validation
    // would fail due to UTC conversion (e.g., 3:30 PM Singapore = 7:30 AM UTC)
    
    return date
  }),
  durationMinutes: aptNumberOrEmpty(z.number().min(15).max(240).default(30)),
  appointmentType: z.enum(['consultation', 'cleaning', 'procedure', 'surgery', 'emergency', 'follow_up', 'x_ray', 'walk_in']),
  reasonForVisit: aptEmptyToUndef(z.string().max(1000).optional()), // Allow more than 34 chars for reason
  notes: aptEmptyToUndef(z.string().max(500).optional()), // Limit notes to 500 chars
  isEmergency: z.boolean().default(false),
  estimatedCost: aptNumberOrEmpty(z.number().min(0).optional()),
  procedures: z.array(z.string().uuid()).max(5).optional(), // Limit procedures to prevent "more than X" errors
  status: aptEmptyToUndef(z.enum(['pending', 'pending_assignment', 'scheduled', 'confirmed', 'checked_in', 'waiting']).optional()),
  serviceId: aptEmptyToUndef(z.string().uuid().optional()), // Official clinic service link
})

// GET /api/appointments - List appointments with filtering
export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const patientId = searchParams.get('patientId')
    const dentistId = searchParams.get('dentistId')
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const search = searchParams.get('search')
    const date = searchParams.get('date')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const includeUnassigned = searchParams.get('includeUnassigned') === 'true'

    // Build where clause based on user role and permissions
    let whereClause: any = {}

    // Role-based filtering
    if (session.user?.role === 'patient') {
      // Patients can only see their own appointments
      const patient = await prisma.patient.findUnique({
        where: { userId: session.user?.id }
      })
      if (!patient) {
        return NextResponse.json({ error: "Patient record not found" }, { status: 404 })
      }
      whereClause.patientId = patient.id
    } else if (session.user?.role === 'dentist' && !includeUnassigned) {
      // Dentists can see their own appointments, unless they want to see unassigned ones
      const dentist = await prisma.dentist.findUnique({
        where: { userId: session.user?.id }
      })
      if (!dentist) {
        return NextResponse.json({ error: "Dentist record not found" }, { status: 404 })
      }
      whereClause.dentistId = dentist.id
    }
    // Admin, manager, and receptionist can see all appointments
    // Dentists with includeUnassigned=true can also see all appointments

    // Apply filters
    if (patientId) whereClause.patientId = patientId
    if (dentistId) whereClause.dentistId = dentistId
    if (status) {
      // Support comma-separated status values (e.g. "confirmed,scheduled")
      if (status.includes(',')) {
        whereClause.status = { in: status.split(',').map(s => s.trim()) }
      } else {
        whereClause.status = status
      }
    }
    if (type) whereClause.appointmentType = type

    // Always exclude appointments of soft-deleted (inactive) patients.
    // This ensures that patients who have been removed from the system
    // do not continue to appear in appointment lists.
    whereClause.patient = { isActive: true }

    // Search by patient name (merge with existing patient filter)
    if (search) {
      whereClause.patient = {
        isActive: true,
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { emailDirect: { contains: search, mode: 'insensitive' } },
          { mobileNumber: { contains: search, mode: 'insensitive' } },
          { patientNumber: { contains: search, mode: 'insensitive' } },
          {
            user: {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
              ]
            }
          }
        ]
      }
    }

    // Date filtering — use clinic timezone (Manila) for "today"/"tomorrow"
    if (date) {
      const { startOfDay: clinicStart, endOfDay: clinicEnd } = getClinicTodayRange()

      if (date === 'today') {
        whereClause.scheduledDatetime = {
          gte: clinicStart,
          lte: clinicEnd
        }
      } else if (date === 'tomorrow') {
        const tomorrowStart = new Date(clinicStart.getTime() + 86400000)
        const tomorrowEnd = new Date(clinicEnd.getTime() + 86400000)
        whereClause.scheduledDatetime = {
          gte: tomorrowStart,
          lte: tomorrowEnd
        }
      } else if (date === 'this_week') {
        const dayOfWeek = clinicStart.getDay()
        const startOfWeek = new Date(clinicStart.getTime() - dayOfWeek * 86400000)
        const endOfWeek = new Date(startOfWeek.getTime() + 7 * 86400000)
        whereClause.scheduledDatetime = { gte: startOfWeek, lt: endOfWeek }
      } else if (date === 'next_week') {
        const dayOfWeek = clinicStart.getDay()
        const startOfNextWeek = new Date(clinicStart.getTime() + (7 - dayOfWeek) * 86400000)
        const endOfNextWeek = new Date(startOfNextWeek.getTime() + 7 * 86400000)
        whereClause.scheduledDatetime = { gte: startOfNextWeek, lt: endOfNextWeek }
      } else if (date === 'this_month') {
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
        whereClause.scheduledDatetime = { gte: startOfMonth, lt: startOfNextMonth }
      } else {
        // Specific date string — interpret as Manila date
        const startOfDay = new Date(`${date}T00:00:00.000+08:00`)
        const endOfDayTarget = new Date(`${date}T23:59:59.999+08:00`)
        whereClause.scheduledDatetime = {
          gte: startOfDay,
          lte: endOfDayTarget
        }
      }
    } else if (dateFrom || dateTo || startDate || endDate) {
      whereClause.scheduledDatetime = {}
      if (dateFrom || startDate) {
        whereClause.scheduledDatetime.gte = new Date(dateFrom || startDate!)
      }
      if (dateTo || endDate) {
        whereClause.scheduledDatetime.lte = new Date(dateTo || endDate!)
      }
    }

    const total = await prisma.appointment.count({ where: whereClause })
    const appointments = await prisma.appointment.findMany({
      where: whereClause,
      include: {
        patient: {
          include: { user: true }
        },
        dentist: {
          include: { user: true }
        },
        creator: true,
        appointmentTreatments: {
          include: { treatment: true }
        },
        service: {
          select: {
            id: true,
            name: true,
            displayName: true,
            estimatedPrice: true,
            priceDisplay: true,
            category: true,
          }
        }
      },
      orderBy: { scheduledDatetime: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    })

    // =========================================================================
    // AUTO-NO-SHOW LOGIC (formerly: auto-cancel — see PATIENT_FLOW_ARCHITECTURE.md)
    // =========================================================================
    // RULES:
    // 1. NEVER auto-cancel walk-ins (type = walk_in) — they are opportunity patients
    // 2. NEVER auto-cancel active patients: checked_in, in_progress, waiting
    //    (patient may be literally in the chair being treated!)
    // 3. Only mark as NO_SHOW (not cancelled) scheduled appointments whose
    //    scheduled time has passed by at least 2 hours AND patient never checked in
    // 4. Walk-ins remain in their current state regardless of time passage —
    //    they can only be moved out of the system via MANUAL action
    //    (Mark Left Without Treatment, Cancel, or Complete)
    // =========================================================================
    const now = new Date()
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000
    // Terminal states — never touch these
    const terminalStatuses = ['completed', 'cancelled', 'no_show', 'rejected']
    // Active states — patient is currently being served / just checked in — NEVER auto-transition
    const activeStatuses = ['checked_in', 'in_progress', 'waiting']

    const pastAppointmentsToMarkNoShow = appointments.filter(apt => {
      // Skip walk-ins — they are opportunity patients, not scheduled appointments
      if (apt.appointmentType === 'walk_in') return false
      // Skip terminal states
      if (terminalStatuses.includes(apt.status)) return false
      // Skip active states — patient is in the building
      if (activeStatuses.includes(apt.status)) return false
      // Only mark no-show if >2 hours past scheduled time
      const scheduledTime = new Date(apt.scheduledDatetime).getTime()
      return (now.getTime() - scheduledTime) > TWO_HOURS_MS
    })

    if (pastAppointmentsToMarkNoShow.length > 0) {
      const noShowIds = pastAppointmentsToMarkNoShow.map(apt => apt.id)

      // Mark these appointments as no_show (NOT cancelled) — reflects reality: patient didn't arrive
      await prisma.appointment.updateMany({
        where: { id: { in: noShowIds } },
        data: {
          status: 'no_show',
          noShowAt: now,
          notes: 'Auto-marked no-show: scheduled time passed by >2h without check-in'
        }
      })

      // Update the appointments array to reflect the status change
      appointments.forEach(apt => {
        if (noShowIds.includes(apt.id)) {
          apt.status = 'no_show'
          apt.noShowAt = now
          apt.notes = 'Auto-marked no-show: scheduled time passed by >2h without check-in'
        }
      })

      console.log(`Auto-marked ${pastAppointmentsToMarkNoShow.length} appointments as no_show (>2h past scheduled, no check-in)`)
    }

    return NextResponse.json({
      success: true,
      data: {
        appointments,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error) {
    console.error("Error fetching appointments:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/appointments - Create new appointment
export async function POST(request: NextRequest) {
  try {
    console.log('POST /api/appointments - Starting appointment creation')
    
    const session = await getServerAuth()
    console.log('Session check result:', session ? 'Valid session' : 'No session')
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Allow patients to create their own appointments, staff can create any appointment
    const userRole = session.user?.role
    const canCreateAppointment = canManageAppointments(userRole) || userRole === 'patient'
    console.log(`User role: ${userRole}, Can create appointment: ${canCreateAppointment}`)
    
    if (!canCreateAppointment) {
      console.log('Forbidden: User role not allowed to create appointments')
      return NextResponse.json({ error: "Forbidden - Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    console.log('Request body received:', JSON.stringify(body, null, 2))
    
    const validatedData = appointmentSchema.parse(body)
    console.log('Data validation successful')

    // If user is a patient, ensure they can only create appointments for themselves
    if (session.user?.role === 'patient') {
      const patientRecord = await prisma.patient.findFirst({
        where: { userId: session.user?.id }
      })
      
      if (!patientRecord || patientRecord.id !== validatedData.patientId) {
        return NextResponse.json({ 
          error: "Patients can only create appointments for themselves" 
        }, { status: 403 })
      }
    }

    // Staff members can create appointments for any patient - verify patient exists
    if (session.user?.role !== 'patient') {
      const patientExists = await prisma.patient.findUnique({
        where: { id: validatedData.patientId }
      })
      
      if (!patientExists) {
        return NextResponse.json({ 
          error: "Patient not found" 
        }, { status: 404 })
      }
    }

    // Generate appointment number
    const currentYear = new Date().getFullYear()
    const appointmentNumber = await nextSequenceNumber('appointments', 'appointment_number', `A-${currentYear}-`, 4)

    // Check for scheduling conflicts (only if dentist is assigned)
    if (validatedData.dentistId) {
      const conflictingAppointment = await prisma.appointment.findFirst({
        where: {
          dentistId: validatedData.dentistId,
          scheduledDatetime: validatedData.scheduledDatetime,
          status: {
            notIn: ['cancelled', 'no_show', 'completed']
          }
        }
      })

      if (conflictingAppointment) {
        return NextResponse.json({
          error: "Time slot is already booked for this dentist"
        }, { status: 409 })
      }
    }

    // Enforce admin-configurable double-booking cap.
    // Count all non-cancelled appointments at the exact same datetime.
    try {
      const bookingSettings = await getBookingSettings(validatedData.scheduledDatetime)
      const MAX_PER_SLOT = effectiveMaxPerSlot(bookingSettings)
      const bookingsAtSlot = await prisma.appointment.count({
        where: {
          scheduledDatetime: validatedData.scheduledDatetime,
          status: { notIn: ['cancelled', 'no_show', 'completed'] },
        },
      })
      if (bookingsAtSlot >= MAX_PER_SLOT) {
        const msg = bookingSettings.doubleBookingEnabled
          ? `This time slot is fully booked (${MAX_PER_SLOT}/${MAX_PER_SLOT}). Please choose another time.`
          : `This time slot is already booked. Double-booking is currently disabled.`
        return NextResponse.json({ error: msg }, { status: 409 })
      }
    } catch (err) {
      console.error('Double-booking cap check failed:', err)
    }

    // Resolve linked official service (if provided) so we can hydrate defaults
    let linkedService: any = null
    if (validatedData.serviceId) {
      linkedService = await prisma.clinicService.findUnique({
        where: { id: validatedData.serviceId },
        select: {
          id: true,
          name: true,
          isActive: true,
          defaultAppointmentType: true,
          estimatedPrice: true,
          duration: true,
          linkedTreatmentIds: true,
        },
      })
      if (!linkedService || !linkedService.isActive) {
        return NextResponse.json({ error: "Selected service is not available" }, { status: 400 })
      }
    }

    // Hydrate type/cost/duration from linked service when caller didn't override
    const appointmentTypeFinal = (linkedService?.defaultAppointmentType as any) || validatedData.appointmentType
    const durationFinal = validatedData.durationMinutes || linkedService?.duration || 30
    const estimatedCostFinal: number | undefined =
      (typeof validatedData.estimatedCost === 'number' ? validatedData.estimatedCost : undefined)
      ?? (linkedService?.estimatedPrice != null ? Number(linkedService.estimatedPrice) : undefined)

    // Create appointment and appointment treatments in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.create({
        data: {
          appointmentNumber,
          patientId: validatedData.patientId,
          dentistId: validatedData.dentistId,
          createdBy: session.user?.id,
          scheduledDatetime: validatedData.scheduledDatetime,
          durationMinutes: durationFinal,
          appointmentType: appointmentTypeFinal,
          reasonForVisit: validatedData.reasonForVisit,
          notes: validatedData.notes,
          isEmergency: validatedData.isEmergency,
          estimatedCost: estimatedCostFinal,
          serviceId: validatedData.serviceId,
          // All new appointments require explicit approval by staff.
          // If staff explicitly supplies a status, honor it; otherwise default to a pending state.
          // - dentist assigned -> `pending` (just needs approval)
          // - dentist unassigned -> `pending_assignment` (needs dentist + approval)
          status: validatedData.status || (validatedData.dentistId ? 'pending' : 'pending_assignment')
        },
        include: {
          patient: { include: { user: true } },
          dentist: { include: { user: true } },
          creator: true,
          service: {
            select: {
              id: true,
              name: true,
              displayName: true,
              estimatedPrice: true,
              priceDisplay: true,
              category: true,
            }
          }
        }
      })

      // Create appointment treatments if procedures are selected
      let selectedTreatmentIds = validatedData.procedures || []

      // If no procedures supplied but service has linked treatments, auto-seed the first one
      if (selectedTreatmentIds.length === 0 && linkedService?.linkedTreatmentIds) {
        try {
          const ids = (linkedService.linkedTreatmentIds as any) as string[]
          if (Array.isArray(ids) && ids.length > 0) {
            selectedTreatmentIds = [ids[0]]
          }
        } catch {}
      }

      if (selectedTreatmentIds.length > 0) {
        const treatments = await tx.treatment.findMany({
          where: { id: { in: selectedTreatmentIds } }
        })

        const appointmentTreatments = treatments.map(treatment => ({
          appointmentId: appointment.id,
          treatmentId: treatment.id,
          quantity: 1,
          unitCost: treatment.baseCost,
          totalCost: treatment.baseCost,
          status: 'planned' as const
        }))

        await tx.appointmentTreatment.createMany({
          data: appointmentTreatments
        })
      }

      // Auto-create required forms based on appointment type
      const requiredForms = getRequiredForms(validatedData.appointmentType, validatedData.isEmergency)
      
      for (const formType of requiredForms) {
        const existingForm = await tx.patientDocument.findFirst({
          where: {
            patientId: validatedData.patientId,
            category: formType.type,
            mimeType: 'application/json'
          }
        })

        if (!existingForm) {
          const formMetadata = {
            status: 'draft',
            formType: formType.type,
            appointmentId: appointment.id,
            appointmentNumber: appointment.appointmentNumber,
            isRequired: true,
            priority: formType.priority || 'normal'
          }

          await tx.patientDocument.create({
            data: {
              patientId: validatedData.patientId,
              filename: `${formType.type}-form.json`,
              originalName: formType.title,
              documentType: formType.documentType,
              description: JSON.stringify(formMetadata),
              cloudStoragePath: `/forms/${formType.type}/${appointment.id}.json`,
              fileSize: 0,
              mimeType: 'application/json',
              category: formType.type,
              uploadedBy: session.user?.id,
              tags: [formType.type, 'draft', 'required', `appointment:${appointment.id}`]
            }
          })

          console.log(`Auto-created required form: ${formType.title} for appointment ${appointment.appointmentNumber}`)
        }
      }

      return appointment
    })

    const appointment = result

    // Log appointment creation
    await prisma.auditLog.create({
      data: {
        userId: session.user?.id,
        entityType: 'appointment',
        entityId: appointment.id,
        action: 'create',
        newValues: {
          appointmentNumber: appointment.appointmentNumber,
          patientId: appointment.patientId,
          dentistId: appointment.dentistId,
          scheduledDatetime: appointment.scheduledDatetime.toISOString()
        }
      }
    })

    // ─── Admin mailbox alert — EVERY new appointment, fail-safe ───
    try {
      const patientUser = appointment.patient?.user
      const dentistUser = appointment.dentist?.user
      const userRole = session.user?.role || ''
      const isEmergencyAppt = appointment.isEmergency === true
      const source: 'walk_in' | 'patient_booking' | 'staff_booking' | 'admin_booking' | 'emergency' =
        isEmergencyAppt
          ? 'emergency'
          : userRole === 'patient'
            ? 'patient_booking'
            : ['admin', 'super_admin', 'manager'].includes(userRole)
              ? 'admin_booking'
              : 'staff_booking'

      sendAdminNewAppointmentEmail({
        appointmentId: appointment.id,
        appointmentNumber: appointment.appointmentNumber,
        appointmentType: appointment.appointmentType,
        scheduledDatetime: new Date(appointment.scheduledDatetime),
        patientName:
          (appointment.patient as any)?.fullName ||
          (patientUser ? `${patientUser.lastName || ''}, ${patientUser.firstName || ''}`.trim() : 'Patient'),
        patientEmail: patientUser?.email || (appointment.patient as any)?.emailDirect || undefined,
        patientPhone: (appointment.patient as any)?.mobileNumber || patientUser?.phone || undefined,
        dentistName: dentistUser ? `${dentistUser.lastName || ''}, ${dentistUser.firstName || ''}`.trim() : undefined,
        notes: appointment.notes || appointment.reasonForVisit || undefined,
        status: appointment.status,
        source,
      }).catch((err) => console.error('Admin mailbox alert failed:', err))
    } catch (alertErr) {
      console.error('Admin mailbox alert wrapper failed:', alertErr)
    }

    // Send confirmation email if appointment is created with scheduled/confirmed status
    if (appointment.status === 'scheduled' || appointment.status === 'confirmed') {
      try {
        const patientUser = appointment.patient.user
        const dentistUser = appointment.dentist?.user

        if (patientUser?.email) {
          // Send email asynchronously (don't await to avoid blocking response)
          sendAppointmentApprovalEmail({
            appointmentId: appointment.id,
            appointmentNumber: appointment.appointmentNumber,
            appointmentType: appointment.appointmentType,
            scheduledDatetime: new Date(appointment.scheduledDatetime),
            durationMinutes: appointment.durationMinutes,
            patientName: `${patientUser?.lastName || ""}, ${patientUser?.firstName || ""}`,
            patientEmail: patientUser?.email,
            dentistName: dentistUser ? `${dentistUser.lastName}, ${dentistUser.firstName}` : undefined,
            reasonForVisit: appointment.reasonForVisit || undefined
          }).catch(err => {
            console.error('Failed to send appointment confirmation email:', err)
          })
        }
      } catch (emailError) {
        // Don't fail the main operation if email fails
        console.error("Email notification error:", emailError)
      }
    }

    // ─── In-app notifications (fail-safe, non-blocking) ───
    try {
      const patientUser = appointment.patient?.user
      const dentistUser = appointment.dentist?.user
      const patientName =
        (appointment.patient as any)?.fullName ||
        (patientUser ? `${patientUser.lastName || ''}, ${patientUser.firstName || ''}`.trim() : 'Patient')
      const whenStr = new Date(appointment.scheduledDatetime).toLocaleString()
      const isEmergencyAppt = appointment.isEmergency === true

      // (a) Emergency broadcast to admin+staff
      if (isEmergencyAppt) {
        await notifyRoles(ADMIN_STAFF_ROLES, {
          title: '🚨 Emergency Appointment Created',
          message: `${patientName} — ${appointment.appointmentType.replace(/_/g, ' ')} on ${whenStr}.`,
          type: 'emergency_appointment',
          priority: 'emergency',
          module: 'appointments',
          relatedRecordId: appointment.id,
          redirectUrl: buildAppointmentDeepLink(appointment.id, { tab: 'today' }),
          metadata: { appointmentNumber: appointment.appointmentNumber, isEmergency: true },
        })
      } else if (appointment.status === 'pending' || appointment.status === 'pending_assignment') {
        // (b) New pending appointment — notify admin/staff (unless same user created it)
        await notifyRoles(ADMIN_STAFF_ROLES, {
          title: 'New Appointment Created',
          message: `${patientName} — ${appointment.appointmentType.replace(/_/g, ' ')} on ${whenStr}.`,
          type: 'new_appointment_request',
          priority: 'normal',
          module: 'appointments',
          relatedRecordId: appointment.id,
          redirectUrl: buildAppointmentDeepLink(appointment.id, { tab: 'upcoming' }),
          metadata: { appointmentNumber: appointment.appointmentNumber },
        })
      }

      // (c) Dentist assignment notification (in-app + email)
      if (appointment.dentist?.user?.id) {
        const assignedDentistUserId = appointment.dentist.user.id
        await createNotification({
          userId: assignedDentistUserId,
          title: isEmergencyAppt ? '🚨 Emergency Appointment Assigned' : 'New Appointment Assigned',
          message: `${patientName} — ${appointment.appointmentType.replace(/_/g, ' ')} on ${whenStr}.`,
          type: isEmergencyAppt ? 'emergency_appointment' : 'dentist_assigned',
          priority: isEmergencyAppt ? 'emergency' : 'important',
          module: 'appointments',
          relatedRecordId: appointment.id,
          redirectUrl: buildAppointmentDeepLink(appointment.id, { forUserId: assignedDentistUserId, tab: 'upcoming' }),
          metadata: { appointmentNumber: appointment.appointmentNumber, isEmergency: isEmergencyAppt },
        })
        if (dentistUser?.email) {
          sendDentistAppointmentEmail({
            eventKind: isEmergencyAppt ? 'emergency' : 'assigned',
            dentistEmail: dentistUser.email,
            dentistName: `${dentistUser.lastName || ''}, ${dentistUser.firstName || ''}`.trim(),
            appointmentNumber: appointment.appointmentNumber,
            appointmentType: appointment.appointmentType,
            scheduledDatetime: new Date(appointment.scheduledDatetime),
            patientName,
            appointmentId: appointment.id,
            dentistUserId: assignedDentistUserId,
          }).catch(err => console.error('Failed to send dentist email:', err))
        }
      }

      // (d) Patient in-app confirmation if staff created with confirmed/scheduled status
      if ((appointment.status === 'scheduled' || appointment.status === 'confirmed') && patientUser?.id) {
        await createNotification({
          userId: patientUser.id,
          title: 'Appointment Confirmed ✓',
          message: `Your appointment #${appointment.appointmentNumber} on ${whenStr} has been confirmed.`,
          type: 'appointment_approved',
          priority: 'normal',
          module: 'appointments',
          relatedRecordId: appointment.id,
          redirectUrl: `/patient/appointments`,
          metadata: { appointmentNumber: appointment.appointmentNumber },
        })
      }
    } catch (notifErr) {
      console.error('Appointment creation notification error:', notifErr)
    }

    return NextResponse.json({
      success: true,
      data: appointment
    }, { status: 201 })

  } catch (error) {
    console.error("Error creating appointment:", error)
    
    if (error instanceof z.ZodError) {
      console.log('Validation error details:', error.errors)
      return NextResponse.json({
        error: "Validation error - Please check your input data",
        details: error.errors
      }, { status: 400 })
    }

    // Handle Prisma errors
    if (error && typeof error === 'object' && 'code' in error) {
      console.log('Database error code:', (error as any).code)
      if ((error as any).code === 'P2002') {
        return NextResponse.json({
          error: "A similar appointment already exists"
        }, { status: 409 })
      }
    }

    // Handle general errors with message
    if (error instanceof Error) {
      console.log('Error message:', error.message)
      return NextResponse.json({
        error: `Appointment booking failed: ${error.message}`
      }, { status: 500 })
    }

    return NextResponse.json({ 
      error: "Internal server error - Unable to create appointment" 
    }, { status: 500 })
  }
}