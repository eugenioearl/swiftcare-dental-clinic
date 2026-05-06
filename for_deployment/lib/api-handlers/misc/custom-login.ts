
import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || 'fallback-secret')

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body
    const identifier = email?.trim() // can be email or username

    if (!identifier || !password) {
      return NextResponse.json({ error: 'Username/email and password are required' }, { status: 400 })
    }

    // Find user by email OR username
    const isEmail = identifier.includes('@')
    const user = await prisma.user.findFirst({
      where: isEmail
        ? { email: identifier }
        : { username: identifier },
      include: {
        patient: true,
        dentist: true,
        staff: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    if (!user.isActive) {
      return NextResponse.json({ error: 'Account is deactivated. Contact admin.' }, { status: 401 })
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash)
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    })

    // Create JWT token
    const token = await new SignJWT({
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      name: `${user.lastName}, ${user.firstName}`,
      isActive: user.isActive
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(secret)

    const userData = {
      id: user.id,
      email: user.email,
      username: user.username,
      name: `${user.lastName}, ${user.firstName}`,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive
    }

    const response = NextResponse.json({
      success: true,
      user: userData,
      redirectTo: getDashboardUrl(user.role)
    })

    const isProduction = process.env.NODE_ENV === 'production'
    const isSecure = isProduction && process.env.NEXTAUTH_URL?.startsWith('https://')
    const sameSiteSetting = 'lax' as const
    
    const cookieOptions = {
      httpOnly: true,
      secure: !!isSecure,
      sameSite: sameSiteSetting,
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/'
    }
    
    response.cookies.set('swiftcare-session', token, cookieOptions)

    response.cookies.set('swiftcare-user', JSON.stringify({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      name: `${user.lastName}, ${user.firstName}`
    }), {
      httpOnly: false,
      secure: !!isSecure,
      sameSite: sameSiteSetting,
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/'
    })

    return response

  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}

function getDashboardUrl(role: string | null | undefined): string {
  if (!role) return '/admin/dashboard'
  const r = role.toLowerCase().trim()
  switch (r) {
    case 'dentist':
      return '/dentist/dashboard'
    case 'staff':
    case 'receptionist':
      return '/staff/dashboard'
    case 'admin':
    case 'super_admin':
    case 'manager':
      return '/admin/dashboard'
    default:
      return '/admin/dashboard'
  }
}
