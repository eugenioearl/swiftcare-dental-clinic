
import { NextRequest, NextResponse } from "next/server"
import { getServerAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"

// GET /api/dentists - List dentists
export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const isAvailable = searchParams.get('isAvailable')
    const isAcceptingNewPatients = searchParams.get('isAcceptingNewPatients')
    const specialization = searchParams.get('specialization')

    let whereClause: any = {}

    if (isAvailable !== null) {
      whereClause.isAvailable = isAvailable === 'true'
    }

    if (isAcceptingNewPatients !== null) {
      whereClause.isAcceptingNewPatients = isAcceptingNewPatients === 'true'
    }

    if (specialization) {
      whereClause.specialization = { contains: specialization, mode: 'insensitive' }
    }

    const dentists = await prisma.dentist.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            isActive: true
          }
        },
        schedules: {
          where: {
            scheduleDate: {
              gte: new Date(),
              lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Next 30 days
            }
          },
          orderBy: { scheduleDate: 'asc' }
        }
      },
      orderBy: [
        { isAvailable: 'desc' },
        { user: { firstName: 'asc' } }
      ]
    })

    return NextResponse.json({
      success: true,
      data: { dentists }
    })

  } catch (error) {
    console.error("Error fetching dentists:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
