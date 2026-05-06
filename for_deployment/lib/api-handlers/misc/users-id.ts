

import { NextRequest, NextResponse } from "next/server"
import { getServerAuth, canManageUsers } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

const updateUserSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().optional(),
  role: z.enum(['patient', 'dentist', 'staff', 'receptionist', 'manager', 'admin']).optional(),
  isActive: z.boolean().optional(),
  
  // Dentist-specific fields
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
  isAvailable: z.boolean().optional(),
  isAcceptingNewPatients: z.boolean().optional(),
  
  // Staff-specific fields
  position: z.string().optional(),
  department: z.string().optional(),
  hourlyRate: z.number().min(0).optional(),
  supervisorId: z.string().optional()
}).refine(data => Object.keys(data).length > 0, {
  message: "At least one field must be provided for update"
})

// GET /api/users/[id] - Get specific user
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = params

    // Users can view their own profile, managers+ can view all
    if (session.user.id !== id && !canManageUsers(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const user = await prisma.user.findUnique({
      where: { id },
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
            licenseState: true,
            licenseExpiryDate: true,
            specialization: true,
            bio: true,
            consultationFee: true,
            yearsExperience: true,
            education: true,
            certifications: true,
            languagesSpoken: true,
            isAvailable: true,
            isAcceptingNewPatients: true,
            appointments: {
              select: {
                id: true,
                appointmentNumber: true,
                scheduledDatetime: true,
                status: true
              },
              where: {
                scheduledDatetime: { gte: new Date() }
              },
              orderBy: { scheduledDatetime: 'asc' },
              take: 10
            }
          }
        },
        staff: {
          select: {
            id: true,
            employeeId: true,
            department: true,
            position: true,
            hireDate: true,
            hourlyRate: true,
            supervisorId: true
          }
        },
        patient: {
          select: {
            id: true,
            patientNumber: true,
            dateOfBirth: true,
            address: true,
            city: true,
            state: true,
            appointments: {
              select: {
                id: true,
                appointmentNumber: true,
                scheduledDatetime: true,
                status: true
              },
              orderBy: { scheduledDatetime: 'desc' },
              take: 5
            }
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Remove sensitive fields for non-managers when viewing other users
    if (session.user.id !== id && !['admin', 'manager'].includes(session.user.role)) {
      if (user.staff) {
        delete (user.staff as any).hourlyRate
      }
    }

    return NextResponse.json({
      success: true,
      data: user
    })

  } catch (error) {
    console.error("Error fetching user:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/users/[id] - Update specific user
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = params
    const body = await request.json()
    const validatedData = updateUserSchema.parse(body)

    // Users can update their own profile (limited fields), managers+ can update all
    const canUpdateAll = canManageUsers(session.user.role)
    const isOwnProfile = session.user.id === id

    if (!canUpdateAll && !isOwnProfile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
      include: {
        dentist: true,
        staff: true
      }
    })

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Restrict fields for own profile updates
    if (!canUpdateAll && isOwnProfile) {
      const allowedFields = ['firstName', 'lastName', 'phone', 'bio', 'languagesSpoken']
      const restrictedFields = Object.keys(validatedData).filter(field => !allowedFields.includes(field))
      
      if (restrictedFields.length > 0) {
        return NextResponse.json({
          error: `You can only update the following fields: ${allowedFields.join(', ')}`
        }, { status: 403 })
      }
    }

    // Separate user, dentist, and staff fields
    const { 
      firstName, lastName, phone, role, isActive,
      // Dentist fields
      licenseNumber, licenseState, licenseExpiryDate, specialization, bio,
      consultationFee, yearsExperience, education, certifications, 
      languagesSpoken, isAvailable, isAcceptingNewPatients,
      // Staff fields
      position, department, hourlyRate, supervisorId,
      ...otherFields
    } = validatedData

    const userUpdates: any = {}
    if (firstName !== undefined) userUpdates.firstName = firstName
    if (lastName !== undefined) userUpdates.lastName = lastName
    if (phone !== undefined) userUpdates.phone = phone
    if (role !== undefined && canUpdateAll) userUpdates.role = role
    if (isActive !== undefined && canUpdateAll) userUpdates.isActive = isActive

    const result = await prisma.$transaction(async (tx) => {
      // Update user
      let updatedUser = existingUser
      if (Object.keys(userUpdates).length > 0) {
        updatedUser = await tx.user.update({
          where: { id },
          data: userUpdates,
          include: {
            dentist: true,
            staff: true
          }
        })
      }

      // Update dentist-specific fields
      if (existingUser.dentist && (
        licenseNumber !== undefined || licenseState !== undefined || 
        licenseExpiryDate !== undefined || specialization !== undefined ||
        bio !== undefined || consultationFee !== undefined ||
        yearsExperience !== undefined || education !== undefined ||
        certifications !== undefined || languagesSpoken !== undefined ||
        isAvailable !== undefined || isAcceptingNewPatients !== undefined
      )) {
        const dentistUpdates: any = {}
        if (licenseNumber !== undefined) dentistUpdates.licenseNumber = licenseNumber
        if (licenseState !== undefined) dentistUpdates.licenseState = licenseState
        if (licenseExpiryDate !== undefined) dentistUpdates.licenseExpiryDate = licenseExpiryDate
        if (specialization !== undefined) dentistUpdates.specialization = specialization
        if (bio !== undefined) dentistUpdates.bio = bio
        if (consultationFee !== undefined) dentistUpdates.consultationFee = consultationFee
        if (yearsExperience !== undefined) dentistUpdates.yearsExperience = yearsExperience
        if (education !== undefined) dentistUpdates.education = education
        if (certifications !== undefined) dentistUpdates.certifications = certifications
        if (languagesSpoken !== undefined) dentistUpdates.languagesSpoken = languagesSpoken
        if (isAvailable !== undefined) dentistUpdates.isAvailable = isAvailable
        if (isAcceptingNewPatients !== undefined) dentistUpdates.isAcceptingNewPatients = isAcceptingNewPatients

        await tx.dentist.update({
          where: { userId: id },
          data: dentistUpdates
        })
      }

      // Update staff-specific fields
      if (existingUser.staff && (
        position !== undefined || department !== undefined ||
        hourlyRate !== undefined || supervisorId !== undefined
      )) {
        const staffUpdates: any = {}
        if (position !== undefined) staffUpdates.position = position
        if (department !== undefined) staffUpdates.department = department
        if (hourlyRate !== undefined && canUpdateAll) staffUpdates.hourlyRate = hourlyRate
        if (supervisorId !== undefined && canUpdateAll) staffUpdates.supervisorId = supervisorId

        await tx.staff.update({
          where: { userId: id },
          data: staffUpdates
        })
      }

      return updatedUser
    })

    // Log user update
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: 'user',
        entityId: id,
        action: 'update',
        oldValues: {
          firstName: existingUser.firstName,
          lastName: existingUser.lastName,
          role: existingUser.role,
          isActive: existingUser.isActive
        },
        newValues: validatedData
      }
    })

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error("Error updating user:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: "Validation error",
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/users/[id] - Delete (deactivate) specific user
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canManageUsers(session.user.role) || session.user.role !== 'admin') {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 })
    }

    const { id } = params

    // Can't delete yourself
    if (session.user.id === id) {
      return NextResponse.json({
        error: "You cannot delete your own account"
      }, { status: 409 })
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
      include: {
        appointmentsCreated: {
          where: {
            status: { in: ['scheduled', 'confirmed', 'checked_in', 'in_progress'] }
          }
        },
        dentist: {
          include: {
            appointments: {
              where: {
                status: { in: ['scheduled', 'confirmed', 'checked_in', 'in_progress'] }
              }
            }
          }
        }
      }
    })

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check for active appointments as dentist
    if (existingUser.dentist?.appointments && existingUser.dentist.appointments.length > 0) {
      return NextResponse.json({
        error: "Cannot delete dentist with active appointments. Please reassign or complete all appointments first."
      }, { status: 409 })
    }

    // Soft delete - deactivate user and related records
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { isActive: false }
      })

      // Deactivate dentist if exists
      if (existingUser.dentist) {
        await tx.dentist.update({
          where: { userId: id },
          data: { isAvailable: false }
        })
      }

      // Note: We don't deactivate patients or staff records directly
      // as they may need to remain accessible for historical purposes
    })

    // Log user deletion
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: 'user',
        entityId: id,
        action: 'delete',
        oldValues: {
          email: existingUser.email,
          firstName: existingUser.firstName,
          lastName: existingUser.lastName,
          role: existingUser.role,
          isActive: true
        },
        newValues: {
          isActive: false
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: "User deactivated successfully"
    })

  } catch (error) {
    console.error("Error deleting user:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

