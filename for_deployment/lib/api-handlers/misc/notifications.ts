import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth, canSendMessages } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const createNotificationSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1).max(200),
  message: z.string().min(1),
  type: z.enum([
    'appointment_reminder',
    'appointment_confirmation',
    'appointment_cancelled',
    'payment_due',
    'payment_received',
    'treatment_plan',
    'system_alert',
    'marketing',
    'new_appointment_request',
    'appointment_approved',
    'appointment_rejected',
    'appointment_rescheduled',
    'dentist_assigned',
    'emergency_appointment',
    'patient_checked_in',
    'appointment_completed',
    'appointment_no_show',
    'appointment_in_progress',
    'invoice_created',
    'treatment_plan_approved',
  ]),
  priority: z.enum(['low', 'normal', 'important', 'high', 'urgent', 'emergency']).default('normal'),
  module: z.string().max(50).optional(),
  relatedRecordId: z.string().max(100).optional(),
  redirectUrl: z.string().max(500).optional(),
  sendEmail: z.boolean().default(false),
  sendSms: z.boolean().default(false),
  scheduledAt: z.string().transform((str) => new Date(str)).optional(),
})

// Numeric priority ranking used when we need to prioritize emergency first.
const PRIORITY_RANK: Record<string, number> = {
  emergency: 100,
  urgent: 80,
  high: 60,
  important: 50,
  normal: 30,
  low: 10,
}

// GET /api/notifications - List notifications for the current user with filters.
// Query params:
//   - read = 'unread' | 'read' (filter by read state)
//   - module = appointments | patients | documents | clinical | billing | queue | system
//   - priority = normal | important | urgent | emergency
//   - q = search query (matches title/message)
//   - unreadCount = '1'  -> returns only { unreadCount } (lightweight poll)
//   - page, limit (pagination)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id as string
    const searchParams = request.nextUrl.searchParams

    // Lightweight poll endpoint: returns only unread count for the current user.
    if (searchParams.get('unreadCount') === '1') {
      const unreadCount = await prisma.notification.count({
        where: { userId, readAt: null, archivedAt: null },
      })
      return NextResponse.json({ success: true, data: { unreadCount } })
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const readFilter = searchParams.get('read') // 'unread' | 'read' | null
    const moduleFilter = searchParams.get('module')
    const priorityFilter = searchParams.get('priority')
    const q = searchParams.get('q')?.trim() || ''
    const includeArchived = searchParams.get('includeArchived') === '1'

    const where: any = { userId }
    if (!includeArchived) where.archivedAt = null
    if (readFilter === 'unread') where.readAt = null
    else if (readFilter === 'read') where.readAt = { not: null }
    if (moduleFilter) where.module = moduleFilter
    if (priorityFilter) where.priority = priorityFilter
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { message: { contains: q, mode: 'insensitive' } },
      ]
    }

    const [total, unreadCount, notifications] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, readAt: null, archivedAt: null } }),
      prisma.notification.findMany({
        where,
        orderBy: [
          { priority: 'desc' }, // enum string order is not numeric; app-side re-sort pins emergency
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    // Re-sort client-side priority: emergency > urgent > high > important > normal > low,
    // then most recent first. Emergency notifications are always pinned to the top.
    const sorted = [...notifications].sort((a: any, b: any) => {
      const ap = PRIORITY_RANK[a.priority] || 0
      const bp = PRIORITY_RANK[b.priority] || 0
      if (bp !== ap) return bp - ap
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    return NextResponse.json({
      success: true,
      data: {
        notifications: sorted,
        unreadCount,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/notifications - Create a notification (staff-only manual send).
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canSendMessages(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validated = createNotificationSchema.parse(body)

    const targetUser = await prisma.user.findUnique({
      where: { id: validated.userId },
      select: { id: true, firstName: true, lastName: true, email: true },
    })
    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
    }

    const notification = await prisma.notification.create({
      data: {
        userId: validated.userId,
        title: validated.title,
        message: validated.message,
        type: validated.type as any,
        priority: validated.priority as any,
        module: validated.module || null,
        relatedRecordId: validated.relatedRecordId || null,
        redirectUrl: validated.redirectUrl || null,
        status: validated.scheduledAt ? 'pending' : 'sent',
        scheduledAt: validated.scheduledAt,
        sentAt: validated.scheduledAt ? null : new Date(),
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: 'notification',
        entityId: notification.id,
        action: 'create',
        newValues: {
          targetUserId: notification.userId,
          title: notification.title,
          type: notification.type,
          priority: notification.priority,
        },
      },
    }).catch((err) => console.error('notification audit log failed:', err))

    return NextResponse.json({ success: true, data: notification }, { status: 201 })
  } catch (error) {
    console.error('Error creating notification:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/notifications - bulk operations (mark all as read / archive all read).
// Body: { action: 'mark_all_read' | 'archive_all_read' | 'archive' | 'delete', ids?: string[] }
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id as string
    const body = await request.json().catch(() => ({}))
    const action = body?.action as string

    if (action === 'mark_all_read') {
      const res = await prisma.notification.updateMany({
        where: { userId, readAt: null, archivedAt: null },
        data: { readAt: new Date() },
      })
      return NextResponse.json({ success: true, data: { updated: res.count } })
    }

    if (action === 'archive_all_read') {
      const res = await prisma.notification.updateMany({
        where: { userId, readAt: { not: null }, archivedAt: null },
        data: { archivedAt: new Date() },
      })
      return NextResponse.json({ success: true, data: { archived: res.count } })
    }

    if (action === 'archive' && Array.isArray(body.ids)) {
      const res = await prisma.notification.updateMany({
        where: { userId, id: { in: body.ids as string[] } },
        data: { archivedAt: new Date() },
      })
      return NextResponse.json({ success: true, data: { archived: res.count } })
    }

    if (action === 'delete' && Array.isArray(body.ids)) {
      const res = await prisma.notification.deleteMany({
        where: { userId, id: { in: body.ids as string[] } },
      })
      return NextResponse.json({ success: true, data: { deleted: res.count } })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('Error in bulk notification operation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
