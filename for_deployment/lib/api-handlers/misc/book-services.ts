import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/book/services - Public endpoint for booking services
export async function GET() {
  try {
    const services = await prisma.clinicService.findMany({
      where: { isActive: true, websiteVisible: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        displayName: true,
        description: true,
        duration: true,
        category: true,
        tagalog: true,
        estimatedPrice: true,
        priceMin: true,
        priceMax: true,
        priceDisplay: true,
        showPrice: true,
        imageUrl: true,
      },
    })

    // If imageUrl is a cloudStoragePath (not a direct /public URL), resolve to image-proxy
    const mapped = services.map((s) => {
      let resolvedImageUrl = s.imageUrl
      if (resolvedImageUrl && !resolvedImageUrl.startsWith('/') && !resolvedImageUrl.startsWith('http')) {
        resolvedImageUrl = `/api/image-proxy?path=${encodeURIComponent(resolvedImageUrl)}`
      }
      return {
        ...s,
        imageUrl: resolvedImageUrl,
        // If showPrice is false, omit pricing fields from the public payload
        ...(s.showPrice === false
          ? {
              estimatedPrice: null,
              priceMin: null,
              priceMax: null,
              priceDisplay: null,
            }
          : {}),
      }
    })

    return NextResponse.json({ success: true, data: mapped })
  } catch (error) {
    console.error('Error fetching services:', error)
    return NextResponse.json({ error: 'Failed to load services' }, { status: 500 })
  }
}
