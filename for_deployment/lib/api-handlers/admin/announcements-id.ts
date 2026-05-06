import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth, isAdminRole } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  subtitle: z.string().max(300).optional().nullable(),
  content: z.string().min(1).optional(),
  calloutText: z.string().max(120).optional().nullable(),
  type: z.enum(['info', 'warning', 'success', 'urgent']).optional(),
  placement: z.array(z.string()).optional(),
  displayMode: z.enum(['banner', 'standard', 'text_only']).optional(),
  isActive: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  cloudStoragePath: z.string().optional().nullable(),
})

// GET /api/admin/announcements/:id
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuth()
    if (!session?.user?.id || !isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const a = await prisma.announcement.findUnique({ where: { id: params.id } })
    if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: a })
  } catch (err) {
    console.error('Error fetching announcement:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/admin/announcements/:id
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuth()
    if (!session?.user?.id || !isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const existing = await prisma.announcement.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await request.json()
    const data = updateSchema.parse(body)

    const updateData: any = {}
    if (data.title !== undefined) updateData.title = data.title
    if (data.subtitle !== undefined) updateData.subtitle = data.subtitle
    if (data.content !== undefined) updateData.content = data.content
    if (data.calloutText !== undefined) updateData.calloutText = data.calloutText
    if (data.type !== undefined) updateData.type = data.type
    if (data.placement !== undefined) updateData.placement = data.placement
    if (data.displayMode !== undefined) updateData.displayMode = data.displayMode
    if (data.isActive !== undefined) updateData.isActive = data.isActive
    if (data.isPinned !== undefined) updateData.isPinned = data.isPinned
    if (data.startDate !== undefined) updateData.startDate = data.startDate ? new Date(data.startDate) : null
    if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl
    if (data.cloudStoragePath !== undefined) updateData.cloudStoragePath = data.cloudStoragePath

    const updated = await prisma.announcement.update({ where: { id: params.id }, data: updateData })

    // Build before/after diff for audit
    const oldVals: any = {}
    const newVals: any = {}
    for (const key of Object.keys(updateData)) {
      const oldV = (existing as any)[key]
      const newV = (updated as any)[key]
      if (JSON.stringify(oldV) !== JSON.stringify(newV)) {
        oldVals[key] = oldV
        newVals[key] = newV
      }
    }
    if (Object.keys(oldVals).length > 0) {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          entityType: 'Announcement',
          entityId: params.id,
          action: 'update',
          category: 'ADMINISTRATIVE',
          description: `Updated announcement: "${updated.title}". Changed: ${Object.keys(oldVals).join(', ')}`,
          oldValues: oldVals,
          newValues: newVals,
        },
      })
    }

    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    console.error('Error updating announcement:', err)
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/admin/announcements/:id
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuth()
    if (!session?.user?.id || !isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const existing = await prisma.announcement.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.announcement.delete({ where: { id: params.id } })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: 'Announcement',
        entityId: params.id,
        action: 'delete',
        category: 'ADMINISTRATIVE',
        description: `Deleted announcement: "${existing.title}"`,
        oldValues: { title: existing.title, type: existing.type },
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error deleting announcement:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
