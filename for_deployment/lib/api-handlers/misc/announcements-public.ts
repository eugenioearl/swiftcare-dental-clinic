import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/announcements?placement=dashboard
// Public endpoint — returns only active, in-date announcements for a given placement
export async function GET(request: NextRequest) {
  try {
    const placement = request.nextUrl.searchParams.get('placement') || ''
    const now = new Date()

    const announcements = await prisma.announcement.findMany({
      where: {
        isActive: true,
        OR: [
          { startDate: null, endDate: null },
          { startDate: { lte: now }, endDate: null },
          { startDate: null, endDate: { gte: now } },
          { startDate: { lte: now }, endDate: { gte: now } },
        ],
      },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        subtitle: true,
        content: true,
        calloutText: true,
        type: true,
        placement: true,
        displayMode: true,
        isPinned: true,
        startDate: true,
        endDate: true,
        imageUrl: true,
        cloudStoragePath: true,
        createdAt: true,
      },
    })

    // Filter by placement client-side since Prisma can't query inside JSON arrays easily
    const filtered = placement
      ? announcements.filter((a) => {
          const pl = Array.isArray(a.placement) ? a.placement : []
          return (pl as string[]).includes(placement)
        })
      : announcements

    // Use stable image-proxy URLs that never expire (unlike raw signed S3 URLs).
    const withFreshUrls = filtered.map((a) => {
      let imageUrl = a.imageUrl
      if (a.cloudStoragePath) {
        imageUrl = `/api/image-proxy?path=${encodeURIComponent(a.cloudStoragePath)}`
      }
      const { cloudStoragePath, ...rest } = a as any
      return { ...rest, imageUrl }
    })

    return NextResponse.json({ success: true, data: withFreshUrls })
  } catch (err) {
    console.error('Error fetching public announcements:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
