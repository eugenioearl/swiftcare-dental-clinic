
import { NextRequest, NextResponse } from "next/server"
import { getServerAuth, canManageStaff } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { hash } from "bcryptjs"

const createStaffSchema = z.object({
  // User fields
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().optional(),
  password: z.string().min(6),
  role: z.enum(['dentist', 'staff', 'receptionist', 'manager']),
  
  // Staff fields (common)
  employeeId: z.string().optional(),
  department: z.string().min(1).max(200),
  position: z.string().min(1).max(200),
  hireDate: z.string().transform((str) => new Date(str)),
  hourlyRate: z.number().optional(),
  
  // Dentist specific fields (when role is dentist)
  licenseNumber: z.string().optional(),
  licenseState: z.string().optional(),
  licenseExpiryDate: z.string().optional().transform((str) => str ? new Date(str) : undefined),
  specialization: z.string().optional(),
  bio: z.string().optional(),
  education: z.string().optional(),
  certifications: z.string().optional(),
  yearsExperience: z.number().optional(),
  consultationFee: z.number().optional(),
  
  // Staff specific fields (when role is staff/receptionist)
  supervisorId: z.string().optional()
})

// GET /api/staff - List staff
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
    const department = searchParams.get('department')
    const role = searchParams.get('role')
    const isActive = searchParams.get('isActive')

    // Check permissions - only admin, super_admin, manager can view all staff
    if (!['admin', 'super_admin', 'manager', 'dentist'].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    let whereClause: any = {
      role: {
        in: ['dentist', 'staff', 'receptionist', 'manager']
      }
    }

    // Apply filters
    if (search) {
      whereClause.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (role && role !== 'all') {
      whereClause.role = role
    }

    if (isActive !== null && isActive !== 'all') {
      whereClause.isActive = isActive === 'true'
    }

    // Get staff with different includes based on role
    const staff = await prisma.user.findMany({
      where: whereClause,
      include: {
        dentist: true,
        staff: true
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    })

    const total = await prisma.user.count({ where: whereClause })

    // Format the response to include staff/dentist specific information
    const formattedStaff = staff.map(user => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      // Include specific role data
      ...(user.dentist && {
        dentist: user.dentist,
        department: 'Clinical',
        position: 'Dentist'
      }),
      ...(user.staff && {
        staff: user.staff,
        department: user.staff.department,
        position: user.staff.position
      })
    }))

    return NextResponse.json({
      success: true,
      data: {
        staff: formattedStaff,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error) {
    console.error("Error fetching staff:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/staff - Create new staff member
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canManageStaff(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createStaffSchema.parse(body)

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

    // Generate employee ID if not provided
    let employeeId = validatedData.employeeId
    if (!employeeId) {
      const currentYear = new Date().getFullYear()
      const staffCount = await prisma.user.count({
        where: {
          role: { in: ['dentist', 'staff', 'receptionist', 'manager'] }
        }
      })
      
      const prefix = validatedData.role === 'dentist' ? 'DOC' : 
                   validatedData.role === 'manager' ? 'MGR' : 'EMP'
      employeeId = `${prefix}-${currentYear}-${String(staffCount + 1).padStart(3, '0')}`
    }

    // Create user and role-specific record in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user
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

      let staffRecord = null

      if (validatedData.role === 'dentist') {
        // Create dentist record
        staffRecord = await tx.dentist.create({
          data: {
            userId: user.id,
            licenseNumber: validatedData.licenseNumber || '',
            licenseState: validatedData.licenseState || '',
            licenseExpiryDate: validatedData.licenseExpiryDate,
            specialization: validatedData.specialization,
            bio: validatedData.bio,
            education: validatedData.education,
            certifications: validatedData.certifications,
            yearsExperience: validatedData.yearsExperience || 0,
            consultationFee: validatedData.consultationFee || 0
          }
        })
      } else {
        // Create staff record
        staffRecord = await tx.staff.create({
          data: {
            userId: user.id,
            employeeId: employeeId!,
            department: validatedData.department,
            position: validatedData.position,
            hireDate: validatedData.hireDate,
            hourlyRate: validatedData.hourlyRate,
            supervisorId: validatedData.supervisorId
          }
        })
      }

      return { user, staffRecord }
    })

    // Log staff creation
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: 'user',
        entityId: result.user.id,
        action: 'create',
        newValues: {
          role: result.user.role,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          employeeId: employeeId
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        user: result.user,
        [validatedData.role]: result.staffRecord
      }
    }, { status: 201 })

  } catch (error) {
    console.error("Error creating staff:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: "Validation error",
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
