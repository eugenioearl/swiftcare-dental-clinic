import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth, isAdminRole } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

function buildImageUrl(path: string | null | undefined): string | null {
  if (!path) return null
  return `/api/image-proxy?path=${encodeURIComponent(path)}`
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().max(300).optional().nullable(),
  content: z.string().min(1),
  calloutText: z.string().max(120).optional().nullable(),
  type: z.enum(['info', 'warning', 'success', 'urgent']).default('info'),
  placement: z.array(z.string()).default([]),
  displayMode: z.enum(['banner', 'standard', 'text_only']).default('standard'),
  isActive: z.boolean().default(true),
  isPinned: z.boolean().default(false),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  cloudStoragePath: z.string().optional().nullable(),
})

// GET /api/admin/announcements
export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user?.id || !isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const announcements = await prisma.announcement.findMany({
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    })

    // Use stable image-proxy URLs that never expire
    const withFreshUrls = announcements.map((a: any) => {
      if (a.cloudStoragePath) {
        return { ...a, imageUrl: buildImageUrl(a.cloudStoragePath) }
      }
      return a
    })

    return NextResponse.json({ success: true, data: withFreshUrls })
  } catch (err) {
    console.error('Error fetching announcements:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/announcements
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user?.id || !isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const body = await request.json()
    const data = createSchema.parse(body)

    const announcement = await prisma.announcement.create({
      data: {
        title: data.title,
        subtitle: data.subtitle || null,
        content: data.content,
        calloutText: data.calloutText || null,
        type: data.type,
        placement: data.placement,
        displayMode: data.displayMode,
        isActive: data.isActive,
        isPinned: data.isPinned,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        imageUrl: data.imageUrl || null,
        cloudStoragePath: data.cloudStoragePath || null,
        createdById: session.user.id,
        createdByName: session.user.name || session.user.email,
      } as any,
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: 'Announcement',
        entityId: announcement.id,
        action: 'create',
        category: 'ADMINISTRATIVE',
        description: `Created announcement: "${data.title}"`,
        newValues: { title: data.title, type: data.type, placement: data.placement, isActive: data.isActive },
      },
    })

    return NextResponse.json({ success: true, data: announcement }, { status: 201 })
  } catch (err) {
    console.error('Error creating announcement:', err)
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
