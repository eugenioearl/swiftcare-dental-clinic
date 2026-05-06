

import { NextRequest, NextResponse } from "next/server"
import { getServerAuth, canAccessPatientData, canManagePatients } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

// Medical fields that trigger dedicated audit entries when changed
const MEDICAL_FIELDS = ['allergies', 'currentMedications', 'medicalHistory', 'dentalAnxieties', 'pregnancyStatus', 'bloodPressureHistory', 'previousDentist', 'previousDentalRemarks', 'medicalSafetyNotes', 'remarks'] as const

const optStr = z.string().nullable().optional()
const updatePatientSchema = z.object({
  // User fields
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: optStr,
  
  // Patient fields  
  fullName: optStr,
  middleName: optStr,
  preferredName: optStr,
  dateOfBirth: z.string().nullable().transform((str) => str ? new Date(str) : null).optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).nullable().optional(),
  civilStatus: optStr,
  religion: optStr,
  address: optStr,
  city: optStr,
  province: optStr,
  state: optStr,
  zipCode: optStr,
  emergencyContactName: optStr,
  emergencyContactPhone: optStr,
  emergencyContactRelationship: optStr,
  medicalHistory: optStr,
  allergies: optStr,
  currentMedications: optStr,
  insuranceProvider: optStr,
  insurancePolicyNumber: optStr,
  insuranceGroupNumber: optStr,
  occupation: optStr,
  nationality: optStr,
  remarks: optStr,
  dentalAnxieties: optStr,
  previousDentist: optStr,
  previousDentalRemarks: optStr,
  pregnancyStatus: optStr,
  bloodPressureHistory: optStr,
  medicalSafetyNotes: optStr,
  preferredLanguage: optStr,
  communicationPreference: z.enum(['email', 'sms', 'phone', 'mail']).nullable().optional(),
  validIdType: optStr,
  validIdNumber: optStr,
  patientSignature: optStr,
  currentChartType: z.enum(['primary', 'mixed', 'permanent']).nullable().optional(),
  chartTypeNotes: optStr,
  isActive: z.boolean().optional(),
  // Social media & structured medical data
  socialMedia: z.any().optional(),
  allergiesList: z.any().optional(),
  conditionsList: z.any().optional(),
  medicationsList: z.any().optional(),
  // Metadata: which section is being updated (for audit trail)
  _updateSection: z.string().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: "At least one field must be provided for update"
})

// GET /api/patients/[id] - Get specific patient
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canAccessPatientData(session.user?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = params

    // Role-based access control
    let whereClause: any = { id }
    if (session.user?.role === 'patient') {
      // Patients can only access their own data
      whereClause.userId = session.user?.id
    }

    const patient = await prisma.patient.findFirst({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            isActive: true,
            createdAt: true,
            updatedAt: true
          }
        },
        appointments: {
          select: {
            id: true,
            appointmentNumber: true,
            scheduledDatetime: true,
            status: true,
            appointmentType: true,
            reasonForVisit: true,
            notes: true,
            service: { select: { name: true } },
            dentist: {
              select: {
                id: true,
                user: {
                  select: {
                    firstName: true,
                    lastName: true
                  }
                }
              }
            }
          },
          orderBy: { scheduledDatetime: 'desc' },
        },
        billing: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            status: true,
            dueDate: true
          },
          where: {
            status: { not: 'paid' }
          },
          orderBy: { dueDate: 'asc' }
        }
      }
    })

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: patient
    })

  } catch (error) {
    console.error("Error fetching patient:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/patients/[id] - Update specific patient
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canManagePatients(session.user?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = params
    const body = await request.json()
    const validatedData = updatePatientSchema.parse(body)

    // Check if patient exists
    const existingPatient = await prisma.patient.findUnique({
      where: { id },
      include: { user: true }
    })

    if (!existingPatient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 })
    }

    // Prepare update data
    const userUpdates: any = {}
    const patientUpdates: any = {}

    // Separate user, patient, and metadata fields
    const { firstName, lastName, phone, _updateSection, ...patientFields } = validatedData
    const updateSection = _updateSection || 'general'
    const userName = session.user?.name || `${session.user?.email || 'System'}`

    if (firstName !== undefined) userUpdates.firstName = firstName
    if (lastName !== undefined) userUpdates.lastName = lastName
    if (phone !== undefined) userUpdates.phone = phone

    Object.assign(patientUpdates, patientFields)

    // Track who set the chart-type override and when
    const chartTypeChanged =
      patientFields.currentChartType !== undefined &&
      patientFields.currentChartType !== existingPatient.currentChartType
    if (patientFields.currentChartType !== undefined) {
      patientUpdates.chartTypeSetById = session.user?.id || null
      patientUpdates.chartTypeSetAt = new Date()
    }

    // Handle signature timestamp
    if (patientFields.patientSignature && !existingPatient.patientSignature) {
      patientUpdates.patientSignedAt = new Date()
    }

    // Always stamp last-touch metadata
    patientUpdates.lastUpdatedById = session.user?.id || null
    patientUpdates.lastUpdatedByName = userName
    patientUpdates.lastUpdatedSection = updateSection

    // If medical fields are being updated, stamp medical-specific audit
    const hasMedicalChange = MEDICAL_FIELDS.some(f => (patientFields as any)[f] !== undefined)
    if (hasMedicalChange) {
      patientUpdates.medicalLastUpdatedAt = new Date()
      patientUpdates.medicalLastUpdatedById = session.user?.id || null
      patientUpdates.medicalLastUpdatedByName = userName
    }

    // Update in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update user if there are user field changes
      if (Object.keys(userUpdates).length > 0 && existingPatient.userId) {
        await tx.user.update({
          where: { id: existingPatient.userId },
          data: userUpdates
        })
      }

      // Update patient
      const updatedPatient = await tx.patient.update({
        where: { id },
        data: patientUpdates,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              isActive: true,
              createdAt: true,
              updatedAt: true
            }
          }
        }
      })

      return updatedPatient
    })

    // Determine changed fields for audit
    const changedFields: Record<string, { old: any; new: any }> = {}
    for (const [key, newVal] of Object.entries(patientFields)) {
      if (key.startsWith('_')) continue
      const oldVal = (existingPatient as any)[key]
      if (oldVal !== newVal && !(oldVal == null && newVal === '')) {
        changedFields[key] = { old: oldVal, new: newVal }
      }
    }
    if (firstName !== undefined && firstName !== existingPatient.user?.firstName) changedFields['firstName'] = { old: existingPatient.user?.firstName, new: firstName }
    if (lastName !== undefined && lastName !== existingPatient.user?.lastName) changedFields['lastName'] = { old: existingPatient.user?.lastName, new: lastName }
    if (phone !== undefined && phone !== existingPatient.user?.phone) changedFields['phone'] = { old: existingPatient.user?.phone, new: phone }

    // Build a human-readable description of what changed
    const changedFieldNames = Object.keys(changedFields)
    const sectionLabel = updateSection === 'medical' ? 'Medical History' : updateSection === 'profile' ? 'Patient Info' : 'Patient Record'
    const description = changedFieldNames.length > 0
      ? `${sectionLabel} updated: ${changedFieldNames.join(', ')}`
      : `${sectionLabel} saved (no changes detected)`

    // Log patient update with full diff
    await prisma.auditLog.create({
      data: {
        userId: session.user?.id,
        entityType: 'Patient',
        entityId: id,
        action: 'update',
        category: hasMedicalChange ? 'CLINICAL' : 'OPERATIONAL',
        description,
        oldValues: Object.fromEntries(changedFieldNames.map(k => [k, changedFields[k].old])),
        newValues: Object.fromEntries(changedFieldNames.map(k => [k, changedFields[k].new])),
      }
    }).catch(e => console.error('Audit log error:', e))

    // Dedicated audit entries for critical medical changes
    if (hasMedicalChange) {
      for (const field of MEDICAL_FIELDS) {
        const f = field as string
        if (changedFields[f]) {
          await prisma.auditLog.create({
            data: {
              userId: session.user?.id,
              entityType: 'Patient',
              entityId: id,
              action: 'update',
              category: 'CLINICAL',
              description: `${f.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())} updated`,
              oldValues: { [f]: changedFields[f].old } as any,
              newValues: { [f]: changedFields[f].new } as any,
            }
          }).catch(() => null)
        }
      }
    }

    // Dedicated audit entry for chart type override
    if (chartTypeChanged) {
      await prisma.auditLog.create({
        data: {
          userId: session.user?.id,
          action: 'update',
          entityType: 'Patient',
          entityId: id,
          category: 'CLINICAL',
          description: `Dental chart type changed to "${patientFields.currentChartType}"`,
          oldValues: { currentChartType: existingPatient.currentChartType } as any,
          newValues: { currentChartType: patientFields.currentChartType } as any,
        },
      }).catch(() => null)
    }

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error("Error updating patient:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: "Validation error",
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/patients/[id] - Delete (deactivate) specific patient
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canManagePatients(session.user?.role)) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 })
    }

    const { id } = params
    const { searchParams } = new URL(request.url)
    const force = searchParams.get('force') === 'true'

    // Check if patient exists
    const existingPatient = await prisma.patient.findUnique({
      where: { id },
      include: {
        appointments: {
          where: {
            status: { in: ['pending', 'pending_assignment', 'scheduled', 'confirmed', 'checked_in', 'waiting', 'in_progress'] }
          }
        }
      }
    })

    if (!existingPatient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 })
    }

    // If there are in-progress appointments and force is not set, block the delete.
    const inProgressAppts = existingPatient.appointments.filter(a => a.status === 'in_progress')
    if (inProgressAppts.length > 0 && !force) {
      return NextResponse.json({
        error: "Cannot delete patient with an in-progress treatment. Please complete or cancel it first.",
        code: 'HAS_IN_PROGRESS',
        inProgressCount: inProgressAppts.length
      }, { status: 409 })
    }

    // Soft delete - deactivate user + patient AND cancel all pending/future appointments
    // so they don't block future re-registration or show up in scheduling views.
    await prisma.$transaction(async (tx) => {
      if (existingPatient.userId) {
        await tx.user.update({
          where: { id: existingPatient.userId },
          data: { isActive: false }
        })
      }

      await tx.patient.update({
        where: { id },
        data: { isActive: false }
      })

      // Cancel all non-terminal appointments so the patient can re-register fresh.
      if (existingPatient.appointments.length > 0) {
        await tx.appointment.updateMany({
          where: {
            patientId: id,
            status: { in: ['pending', 'pending_assignment', 'scheduled', 'confirmed', 'checked_in', 'waiting', 'in_progress'] }
          },
          data: {
            status: 'cancelled',
            cancellationReason: 'Patient record removed',
            cancelledAt: new Date()
          }
        })
      }
    })

    // Log patient deletion
    await prisma.auditLog.create({
      data: {
        userId: session.user?.id,
        entityType: 'patient',
        entityId: id,
        action: 'delete',
        oldValues: {
          patientNumber: existingPatient.patientNumber,
          isActive: true
        },
        newValues: {
          isActive: false
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: "Patient deactivated successfully"
    })

  } catch (error) {
    console.error("Error deleting patient:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

