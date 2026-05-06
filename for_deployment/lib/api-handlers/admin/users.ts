
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import { getActionCategory } from '@/lib/auth'
import { prisma } from '@/lib/db'

async function getAuthUser() {
  try {
    const cookieStore = cookies()
    const sessionCookie = cookieStore.get('swiftcare-session')
    if (!sessionCookie) return null
    const jwtSecret = process.env.NEXTAUTH_SECRET || 'fallback-secret'
    const encodedSecret = new TextEncoder().encode(jwtSecret)
    const { payload } = await jwtVerify(sessionCookie.value, encodedSecret)
    return { userId: payload.userId as string, role: payload.role as string }
  } catch {
    return null
  }
}

// GET - List all users
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthUser()
    if (!auth || !['admin', 'super_admin'].includes(auth.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Get users error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}

// POST - Create new user
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthUser()
    if (!auth || !['admin', 'super_admin'].includes(auth.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { email, username, password, firstName, lastName, phone, role } = body

    if (!email || !password || !firstName || !lastName || !role) {
      return NextResponse.json({ error: 'Required fields: email, password, firstName, lastName, role' }, { status: 400 })
    }

    const validRoles = ['dentist', 'staff', 'receptionist', 'admin', 'super_admin']
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Only super_admin can create admin/super_admin
    if (['admin', 'super_admin'].includes(role) && auth.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only Super Admin can create admin accounts' }, { status: 403 })
    }

    // Check existing
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          ...(username ? [{ username }] : [])
        ]
      }
    })
    if (existing) {
      return NextResponse.json({ error: 'Email or username already exists' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: {
        email,
        username: username || null,
        passwordHash: hashedPassword,
        firstName,
        lastName,
        phone: phone || null,
        role: role as any,
        isActive: true,
        emailVerified: true,
      }
    })

    // Create related profile
    if (role === 'dentist') {
      await prisma.dentist.create({
        data: {
          user: { connect: { id: user.id } },
          licenseNumber: `LIC-${Date.now()}`,
          licenseState: 'NCR',
          specialization: 'General Dentistry',
          bio: `Dr. ${lastName}, ${firstName}`,
          consultationFee: 1500,
          yearsExperience: 1,
        }
      })
    } else if (['staff', 'receptionist'].includes(role)) {
      await prisma.staff.create({
        data: {
          user: { connect: { id: user.id } },
          employeeId: `EMP-${Date.now()}`,
          department: 'Front Desk',
          position: role,
          hireDate: new Date(),
        }
      })
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: auth.userId,
        action: 'create',
        entityType: 'User',
        entityId: user.id,
        category: 'ADMINISTRATIVE',
        description: `Created user ${lastName}, ${firstName} (${role})`,
        newValues: { email, role, firstName, lastName },
      }
    })

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
      }
    })
  } catch (error) {
    console.error('Create user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}

// PUT - Update user
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthUser()
    if (!auth || !['admin', 'super_admin'].includes(auth.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { id, email, username, firstName, lastName, phone, role, isActive, password } = body

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({ where: { id } })
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Prevent deactivating yourself
    if (id === auth.userId && isActive === false) {
      return NextResponse.json({ error: 'Cannot deactivate your own account' }, { status: 400 })
    }

    // Only super_admin can modify admin/super_admin roles
    if (['admin', 'super_admin'].includes(role) && auth.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only Super Admin can assign admin roles' }, { status: 403 })
    }

    const updateData: any = {}
    if (email !== undefined) updateData.email = email
    if (username !== undefined) updateData.username = username || null
    if (firstName !== undefined) updateData.firstName = firstName
    if (lastName !== undefined) updateData.lastName = lastName
    if (phone !== undefined) updateData.phone = phone || null
    if (role !== undefined) updateData.role = role
    if (isActive !== undefined) updateData.isActive = isActive
    if (password) updateData.passwordHash = await bcrypt.hash(password, 12)

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: auth.userId,
        action: 'update',
        entityType: 'User',
        entityId: user.id,
        category: 'ADMINISTRATIVE',
        description: `Updated user ${user.lastName}, ${user.firstName}${isActive === false ? ' (deactivated)' : ''}`,
        oldValues: { role: existingUser.role, isActive: existingUser.isActive },
        newValues: updateData,
      }
    })

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
      }
    })
  } catch (error) {
    console.error('Update user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}
