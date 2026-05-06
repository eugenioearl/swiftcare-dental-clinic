
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
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

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthUser()
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { currentPassword, newPassword, confirmPassword } = body

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: 'New passwords do not match' }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: auth.userId } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!isValid) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({
      where: { id: auth.userId },
      data: { passwordHash: hashedPassword }
    })

    // Log action
    try {
      await prisma.auditLog.create({
        data: {
          userId: auth.userId,
          action: 'password_change',
          entityType: 'User',
          entityId: auth.userId,
          description: 'Password changed successfully',
          category: 'ADMINISTRATIVE',
        }
      })
    } catch {
      // Audit log failure should not block password change
    }

    return NextResponse.json({ success: true, message: 'Password changed successfully' })

  } catch (error) {
    console.error('Change password error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}
