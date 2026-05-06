
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Get today's date
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Fetch recent check-ins for today
    const appointments = await prisma.appointment.findMany({
      where: {
        status: 'checked_in',
        checkedInAt: {
          gte: today,
          lt: tomorrow
        }
      },
      include: {
        patient: {
          include: {
            user: true
          }
        },
        dentist: {
          include: {
            user: true
          }
        }
      },
      orderBy: {
        checkedInAt: 'desc'
      },
      take: 10
    })

    return NextResponse.json({
      success: true,
      data: { appointments }
    })

  } catch (error: any) {
    console.error('Error fetching recent check-ins:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch recent check-ins' },
      { status: 500 }
    )
  }
}
