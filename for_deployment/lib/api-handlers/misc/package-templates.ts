import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  procedures: z.array(z.object({
    treatmentId: z.string().uuid(),
    overridePrice: z.number().min(0).optional(),
    sortOrder: z.number().optional()
  })).optional()
})

export async function GET() {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const templates = await prisma.packageTemplate.findMany({
      where: { isActive: true },
      include: {
        procedures: {
          include: { treatment: true },
          orderBy: { sortOrder: 'asc' }
        },
        createdBy: { select: { firstName: true, lastName: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ success: true, data: templates })
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!['admin', 'super_admin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const data = createSchema.parse(body)

    const template = await prisma.packageTemplate.create({
      data: {
        name: data.name,
        description: data.description || null,
        createdById: session.user.id,
        procedures: data.procedures?.length ? {
          create: data.procedures.map((p, i) => ({
            treatmentId: p.treatmentId,
            overridePrice: p.overridePrice ?? null,
            sortOrder: p.sortOrder ?? i
          }))
        } : undefined
      },
      include: {
        procedures: { include: { treatment: true }, orderBy: { sortOrder: 'asc' } },
        createdBy: { select: { firstName: true, lastName: true } }
      }
    })

    return NextResponse.json({ success: true, data: template }, { status: 201 })
  } catch (error) {
    console.error('Error creating template:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
