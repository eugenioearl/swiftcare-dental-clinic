
import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma, nextSequenceNumber } from "@/lib/db"
import { z } from "zod"

const signupSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelationship: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = signupSchema.parse(body)

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409 }
      )
    }

    // Hash password
    const passwordHash = await bcrypt.hash(validatedData.password, 12)

    // Create user and patient record in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email: validatedData.email,
          passwordHash,
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          phone: validatedData.phone,
          role: 'patient',
          isActive: true,
          emailVerified: false
        }
      })

      // Generate patient number
      const currentYear = new Date().getFullYear()
      const patientNumber = await nextSequenceNumber('patients', 'patient_number', `P-${currentYear}-`, 4)

      // Create patient record
      const patient = await tx.patient.create({
        data: {
          userId: user.id,
          patientNumber,
          dateOfBirth: validatedData.dateOfBirth ? new Date(validatedData.dateOfBirth) : new Date('1990-01-01'),
          gender: validatedData.gender,
          address: validatedData.address,
          city: validatedData.city,
          state: validatedData.state,
          zipCode: validatedData.zipCode,
          emergencyContactName: validatedData.emergencyContactName,
          emergencyContactPhone: validatedData.emergencyContactPhone,
          emergencyContactRelationship: validatedData.emergencyContactRelationship,
          isActive: true
        }
      })

      // Log user creation
      await tx.auditLog.create({
        data: {
          userId: user.id,
          entityType: 'user',
          entityId: user.id,
          action: 'create',
          newValues: {
            email: user.email,
            role: user.role,
            patientNumber: patient.patientNumber
          }
        }
      })

      return { user, patient }
    })

    return NextResponse.json({
      success: true,
      message: "Account created successfully",
      data: {
        userId: result.user.id,
        patientNumber: result.patient.patientNumber
      }
    }, { status: 201 })

  } catch (error) {
    console.error("Signup error:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: "Validation error",
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      error: "Internal server error"
    }, { status: 500 })
  }
}
