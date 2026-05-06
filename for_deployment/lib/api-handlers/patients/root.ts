
import { NextRequest, NextResponse } from "next/server"
import { getServerAuth, canAccessPatientData, canManagePatients } from "@/lib/auth"
import { prisma, nextSequenceNumber } from "@/lib/db"
import { z } from "zod"
import { hash } from "bcryptjs"

// Helper: treat empty strings as undefined for optional fields coming from forms
const emptyToUndef = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === '' || v === null ? undefined : v), schema)

const createPatientSchema = z.object({
  // User fields (optional — staff can create patient without user account)
  email: emptyToUndef(z.string().email().optional()),
  firstName: emptyToUndef(z.string().min(1).max(100).optional()),
  lastName: emptyToUndef(z.string().min(1).max(100).optional()),
  phone: emptyToUndef(z.string().optional()),
  password: emptyToUndef(z.string().min(6).optional()),

  // Direct patient fields
  fullName: emptyToUndef(z.string().min(1).max(200).optional()),
  mobileNumber: emptyToUndef(z.string().optional()),
  emailDirect: emptyToUndef(z.string().optional()),

  // Patient fields
  dateOfBirth: emptyToUndef(
    z.string().refine((s) => !isNaN(Date.parse(s)), { message: 'Invalid date' }).transform((str) => new Date(str)).optional()
  ),
  gender: emptyToUndef(z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional()),
  address: emptyToUndef(z.string().optional()),
  city: emptyToUndef(z.string().optional()),
  state: emptyToUndef(z.string().optional()),
  zipCode: emptyToUndef(z.string().optional()),
  emergencyContactName: emptyToUndef(z.string().optional()),
  emergencyContactPhone: emptyToUndef(z.string().optional()),
  emergencyContactRelationship: emptyToUndef(z.string().optional()),
  medicalHistory: emptyToUndef(z.string().optional()),
  allergies: emptyToUndef(z.string().optional()),
  currentMedications: emptyToUndef(z.string().optional()),
  insuranceProvider: emptyToUndef(z.string().optional()),
  insurancePolicyNumber: emptyToUndef(z.string().optional()),
  insuranceGroupNumber: emptyToUndef(z.string().optional()),
  preferredLanguage: emptyToUndef(z.string().default('English')),
  communicationPreference: emptyToUndef(z.enum(['email', 'sms', 'phone', 'mail']).default('email'))
})

// GET /api/patients - List patients
export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const search = searchParams.get('search')
    const isActive = searchParams.get('isActive')
    const includeInactive = searchParams.get('includeInactive') === 'true'

    // Check permissions
    if (!canAccessPatientData(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    let whereClause: any = {}

    // Role-based filtering
    if (session.user.role === 'patient') {
      // Patients can only see their own data
      whereClause.userId = session.user.id
    }
    // Admin, manager, receptionist, and dentist can see all patients (simplified)

    // Apply filters
    if (search) {
      whereClause.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
        { user: { lastName: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { emailDirect: { contains: search, mode: 'insensitive' } },
        { mobileNumber: { contains: search, mode: 'insensitive' } },
        { patientNumber: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Exclude soft-deleted / inactive patients by default.
    // Pass ?includeInactive=true to show everyone, or ?isActive=false to show only inactive.
    if (isActive !== null) {
      whereClause.isActive = isActive === 'true'
    } else if (!includeInactive) {
      whereClause.isActive = true
    }

    const total = await prisma.patient.count({ where: whereClause })
    const patients = await prisma.patient.findMany({
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
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    })

    // Attach stable proxied profile picture URLs (never expires)
    const patientsWithPictures = patients.map((p: any) => {
      if (!p.profilePictureCloudPath) return p
      return {
        ...p,
        profilePictureUrl: `/api/image-proxy?path=${encodeURIComponent(p.profilePictureCloudPath)}`,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        patients: patientsWithPictures,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error) {
    console.error("Error fetching patients:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/patients - Create new patient
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canManagePatients(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createPatientSchema.parse(body)

    // Determine the patient's display name
    const computedFullName = validatedData.fullName || 
      [validatedData.firstName, validatedData.lastName].filter(Boolean).join(' ') || 
      'Unknown Patient'

    // Need at least a name
    if (!computedFullName || computedFullName === 'Unknown Patient') {
      return NextResponse.json({ error: "Patient name is required (fullName or firstName + lastName)" }, { status: 400 })
    }

    // Generate patient number
    const currentYear = new Date().getFullYear()
    const patientNumber = await nextSequenceNumber('patients', 'patient_number', `P-${currentYear}-`, 4)

    const hasUserAccount = validatedData.email && validatedData.password

    // Create patient (with or without user account) in a transaction
    const result = await prisma.$transaction(async (tx) => {
      let userId: string | undefined = undefined

      if (hasUserAccount) {
        // Check if email already exists
        const existingUser = await tx.user.findUnique({
          where: { email: validatedData.email! }
        })
        if (existingUser) {
          throw new Error('EMAIL_EXISTS')
        }

        const passwordHash = await hash(validatedData.password!, 12)
        const user = await tx.user.create({
          data: {
            email: validatedData.email!,
            passwordHash,
            firstName: validatedData.firstName || computedFullName.split(' ')[0],
            lastName: validatedData.lastName || computedFullName.split(' ').slice(1).join(' '),
            phone: validatedData.phone || validatedData.mobileNumber,
            role: 'patient',
            isActive: true
          }
        })
        userId = user.id
      }

      // Create patient record
      const patient = await tx.patient.create({
        data: {
          ...(userId ? { userId } : {}),
          patientNumber,
          fullName: computedFullName,
          mobileNumber: validatedData.mobileNumber || validatedData.phone,
          emailDirect: validatedData.emailDirect || validatedData.email,
          dateOfBirth: validatedData.dateOfBirth || undefined,
          gender: validatedData.gender,
          address: validatedData.address,
          city: validatedData.city,
          state: validatedData.state,
          zipCode: validatedData.zipCode,
          emergencyContactName: validatedData.emergencyContactName,
          emergencyContactPhone: validatedData.emergencyContactPhone,
          emergencyContactRelationship: validatedData.emergencyContactRelationship,
          medicalHistory: validatedData.medicalHistory,
          allergies: validatedData.allergies,
          currentMedications: validatedData.currentMedications,
          insuranceProvider: validatedData.insuranceProvider,
          insurancePolicyNumber: validatedData.insurancePolicyNumber,
          insuranceGroupNumber: validatedData.insuranceGroupNumber,
          preferredLanguage: validatedData.preferredLanguage,
          communicationPreference: validatedData.communicationPreference
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              isActive: true,
              createdAt: true
            }
          }
        }
      })

      return { patient }
    })

    // Log patient creation
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: 'patient',
        entityId: result.patient.id,
        action: 'create',
        newValues: {
          patientNumber: result.patient.patientNumber,
          fullName: result.patient.fullName,
          email: result.patient.user?.email || result.patient.emailDirect
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        patient: result.patient
      }
    }, { status: 201 })

  } catch (error: any) {
    console.error("Error creating patient:", error)
    
    if (error?.message === 'EMAIL_EXISTS') {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 409 })
    }
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: "Validation error",
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
