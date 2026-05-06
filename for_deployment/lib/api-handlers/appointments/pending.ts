
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerAuth } from '@/lib/auth'
import { getClinicTodayRange } from '@/lib/clinic-hours'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuth()
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get patient ID from the logged-in user
    const patient = await prisma.patient.findFirst({
      where: { userId: session.user.id }
    })

    if (!patient) {
      return NextResponse.json(
        { success: false, error: 'Patient record not found' },
        { status: 404 }
      )
    }

    // Get today's date range in clinic timezone (Manila)
    const { startOfDay, endOfDay } = getClinicTodayRange()

    // Fetch pending appointments for today
    const appointments = await prisma.appointment.findMany({
      where: {
        patientId: patient.id,
        scheduledDatetime: {
          gte: startOfDay,
          lte: endOfDay
        },
        status: {
          in: ['scheduled', 'confirmed']
        }
      },
      include: {
        patient: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        dentist: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      },
      orderBy: {
        scheduledDatetime: 'asc'
      }
    })

    return NextResponse.json({
      success: true,
      data: { appointments }
    })

  } catch (error) {
    console.error('Error fetching pending appointments:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch pending appointments' },
      { status: 500 }
    )
  }
}
