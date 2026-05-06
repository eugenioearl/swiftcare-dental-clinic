

import { NextRequest, NextResponse } from "next/server"
import { getServerAuth, canManageUsers } from "@/lib/auth"
import { prisma, nextSequenceNumber } from "@/lib/db"
import { z } from "zod"
import { hash } from "bcryptjs"

const createUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().optional(),
  password: z.string().min(6),
  role: z.enum(['patient', 'dentist', 'staff', 'receptionist', 'manager', 'admin']),
  
  // Dentist-specific fields (if role is dentist)
  licenseNumber: z.string().optional(),
  licenseState: z.string().optional(),
  licenseExpiryDate: z.string().transform((str) => new Date(str)).optional(),
  specialization: z.string().optional(),
  bio: z.string().optional(),
  consultationFee: z.number().min(0).optional(),
  yearsExperience: z.number().min(0).optional(),
  education: z.string().optional(),
  certifications: z.string().optional(),
  languagesSpoken: z.array(z.string()).optional(),
  
  // Staff-specific fields (if role is staff/receptionist/manager)
  department: z.string().optional(),
  position: z.string().optional(),
  hireDate: z.string().transform((str) => new Date(str)).optional(),
  hourlyRate: z.number().min(0).optional(),
  supervisorId: z.string().optional()
})

// GET /api/users - List users
export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canManageUsers(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const role = searchParams.get('role')
    const search = searchParams.get('search')
    const isActive = searchParams.get('isActive')

    let whereClause: any = {}

    // Apply filters
    if (role) {
      whereClause.role = role
    }

    if (search) {
      whereClause.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (isActive !== null) {
      whereClause.isActive = isActive === 'true'
    }

    const total = await prisma.user.count({ where: whereClause })
    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        emailVerified: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        dentist: {
          select: {
            id: true,
            licenseNumber: true,
            specialization: true,
            isAvailable: true
          }
        },
        staff: {
          select: {
            id: true,
            employeeId: true,
            department: true,
            position: true,
            hireDate: true
          }
        },
        patient: {
          select: {
            id: true,
            patientNumber: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    })

    return NextResponse.json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/users - Create new user (staff/dentist)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canManageUsers(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createUserSchema.parse(body)

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email }
    })

    if (existingUser) {
      return NextResponse.json({
        error: "User with this email already exists"
      }, { status: 409 })
    }

    // Hash password
    const passwordHash = await hash(validatedData.password, 12)

    // Create user with role-specific data in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create base user
      const user = await tx.user.create({
        data: {
          email: validatedData.email,
          passwordHash,
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          phone: validatedData.phone,
          role: validatedData.role,
          isActive: true
        }
      })

      let roleSpecificData = null

      // Create role-specific records
      if (validatedData.role === 'dentist') {
        if (!validatedData.licenseNumber || !validatedData.licenseState) {
          throw new Error("License number and state are required for dentist role")
        }

        roleSpecificData = await tx.dentist.create({
          data: {
            userId: user.id,
            licenseNumber: validatedData.licenseNumber,
            licenseState: validatedData.licenseState,
            licenseExpiryDate: validatedData.licenseExpiryDate,
            specialization: validatedData.specialization,
            bio: validatedData.bio,
            consultationFee: validatedData.consultationFee || 0,
            yearsExperience: validatedData.yearsExperience || 0,
            education: validatedData.education,
            certifications: validatedData.certifications,
            languagesSpoken: validatedData.languagesSpoken || ['English']
          }
        })
      } else if (['staff', 'receptionist', 'manager'].includes(validatedData.role)) {
        // Generate employee ID
        const employeeId = await nextSequenceNumber('staff', 'employee_id', 'EMP-', 4)

        roleSpecificData = await tx.staff.create({
          data: {
            userId: user.id,
            employeeId,
            department: validatedData.department,
            position: validatedData.position || validatedData.role,
            hireDate: validatedData.hireDate || new Date(),
            hourlyRate: validatedData.hourlyRate,
            supervisorId: validatedData.supervisorId
          }
        })
      }

      return { user, roleSpecificData }
    })

    // Log user creation
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: 'user',
        entityId: result.user.id,
        action: 'create',
        newValues: {
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          role: result.user.role
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: result.user
    }, { status: 201 })

  } catch (error) {
    console.error("Error creating user:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: "Validation error",
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

