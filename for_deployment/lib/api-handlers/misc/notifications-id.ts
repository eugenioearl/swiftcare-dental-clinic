import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth, canSendMessages } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const updateNotificationSchema = z.object({
  status: z.enum(['pending', 'sent', 'delivered', 'failed', 'cancelled']).optional(),
  readAt: z.string().transform((str) => new Date(str)).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
})

// GET /api/notifications/[id] - Fetch a single notification (own-only unless staff).
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = params
    const where: any = { id }
    // Only staff/admin may read other users' notifications.
    if (!canSendMessages(session.user.role)) {
      where.userId = session.user.id
    }

    const notification = await prisma.notification.findFirst({ where })
    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: notification })
  } catch (error) {
    console.error('Error fetching notification:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/notifications/[id] - Mark as read / update status.
// Users may ONLY mark their own notifications as read. Anything else requires staff.
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = params
    const body = await request.json().catch(() => ({}))

    // Fast path: mark-as-read. Any logged-in user can do this for their OWN notif.
    if (body?.markAsRead === true) {
      const own = await prisma.notification.findFirst({
        where: { id, userId: session.user.id as string },
        select: { id: true, status: true, readAt: true },
      })
      if (!own) {
        return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
      }
      // Idempotent: do nothing if already read.
      if (!own.readAt) {
        await prisma.notification.update({
          where: { id },
          data: {
            readAt: new Date(),
            clickedAt: body?.clicked ? new Date() : undefined,
            status: own.status === 'pending' ? 'delivered' : own.status,
          },
        })
      }
      return NextResponse.json({ success: true })
    }

    // Fast path: archive (own only).
    if (body?.archive === true) {
      const own = await prisma.notification.findFirst({
        where: { id, userId: session.user.id as string },
        select: { id: true },
      })
      if (!own) {
        return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
      }
      await prisma.notification.update({
        where: { id },
        data: { archivedAt: new Date() },
      })
      return NextResponse.json({ success: true })
    }

    // Anything else requires staff permission.
    if (!canSendMessages(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const validated = updateNotificationSchema.parse(body)
    const existing = await prisma.notification.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }
    const updated = await prisma.notification.update({
      where: { id },
      data: validated,
    })
    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error updating notification:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/notifications/[id] - Delete a notification.
// Users may delete their own; staff may delete any.
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = params
    const where: any = { id }
    if (!canSendMessages(session.user.role)) {
      where.userId = session.user.id
    }
    const existing = await prisma.notification.findFirst({ where })
    if (!existing) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }
    await prisma.notification.delete({ where: { id } })
    return NextResponse.json({ success: true, message: 'Notification deleted successfully' })
  } catch (error) {
    console.error('Error deleting notification:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
