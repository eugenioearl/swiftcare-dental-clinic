
import { NextRequest, NextResponse } from 'next/server'
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

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthUser()
    if (!auth || !['admin', 'super_admin'].includes(auth.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const category = searchParams.get('category')
    const action = searchParams.get('action')

    const where: any = {}
    if (category) where.category = category
    if (action) where.action = action

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: { firstName: true, lastName: true, email: true, role: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where })
    ])

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Audit log error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}
