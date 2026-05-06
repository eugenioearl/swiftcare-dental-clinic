import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  procedures: z.array(z.object({
    treatmentId: z.string().uuid(),
    overridePrice: z.number().min(0).nullable().optional(),
    sortOrder: z.number().optional()
  })).optional()
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const template = await prisma.packageTemplate.findUnique({
      where: { id: params.id },
      include: {
        procedures: { include: { treatment: true }, orderBy: { sortOrder: 'asc' } },
        createdBy: { select: { firstName: true, lastName: true } }
      }
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: template })
  } catch (error) {
    console.error('Error fetching template:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!['admin', 'super_admin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const data = updateSchema.parse(body)

    const existing = await prisma.packageTemplate.findUnique({ where: { id: params.id } })
    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Update template and replace procedures if provided
    const updateData: any = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.isActive !== undefined) updateData.isActive = data.isActive

    if (data.procedures !== undefined) {
      // Delete existing and recreate
      await prisma.packageTemplateProcedure.deleteMany({ where: { templateId: params.id } })
      if (data.procedures.length > 0) {
        await prisma.packageTemplateProcedure.createMany({
          data: data.procedures.map((p, i) => ({
            templateId: params.id,
            treatmentId: p.treatmentId,
            overridePrice: p.overridePrice ?? null,
            sortOrder: p.sortOrder ?? i
          }))
        })
      }
    }

    const template = await prisma.packageTemplate.update({
      where: { id: params.id },
      data: updateData,
      include: {
        procedures: { include: { treatment: true }, orderBy: { sortOrder: 'asc' } },
        createdBy: { select: { firstName: true, lastName: true } }
      }
    })

    return NextResponse.json({ success: true, data: template })
  } catch (error) {
    console.error('Error updating template:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!['admin', 'super_admin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.packageTemplate.update({
      where: { id: params.id },
      data: { isActive: false }
    })

    return NextResponse.json({ success: true, message: 'Template deactivated' })
  } catch (error) {
    console.error('Error deleting template:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
