
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerAuth } from '@/lib/auth'
import crypto from 'crypto'
import { getClinicTodayRange } from '@/lib/clinic-hours'

// Global token store (in production, use Redis or database)
const tokenStore = new Map<string, {
  appointmentId: string
  patientId: string
  expiresAt: Date
}>()

// Clean up expired tokens periodically
setInterval(() => {
  const now = new Date()
  for (const [token, data] of tokenStore.entries()) {
    if (data.expiresAt < now) {
      tokenStore.delete(token)
    }
  }
}, 60000) // Clean every minute

export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuth()
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { appointmentId } = body

    if (!appointmentId) {
      return NextResponse.json(
        { success: false, error: 'Appointment ID is required' },
        { status: 400 }
      )
    }

    // Verify the appointment belongs to the user and is valid for check-in
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        patient: {
          userId: session.user.id
        },
        status: {
          in: ['scheduled', 'confirmed']
        }
      },
      include: {
        patient: true
      }
    })

    if (!appointment) {
      return NextResponse.json(
        { success: false, error: 'Appointment not found or not eligible for check-in' },
        { status: 404 }
      )
    }

    // Check if appointment is today (Manila timezone)
    const appointmentDate = new Date(appointment.scheduledDatetime)
    const { startOfDay, endOfDay } = getClinicTodayRange()

    if (appointmentDate < startOfDay || appointmentDate > endOfDay) {
      return NextResponse.json(
        { success: false, error: 'Can only generate check-in tokens for today\'s appointments' },
        { status: 400 }
      )
    }

    // Generate a unique token
    const token = crypto.randomBytes(32).toString('hex')
    
    // Store token with 30 minute expiration
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + 30)
    
    tokenStore.set(token, {
      appointmentId: appointment.id,
      patientId: appointment.patient.id,
      expiresAt
    })

    return NextResponse.json({
      success: true,
      data: {
        token,
        expiresAt: expiresAt.toISOString(),
        appointmentNumber: appointment.appointmentNumber
      }
    })

  } catch (error) {
    console.error('Error generating check-in token:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate check-in token' },
      { status: 500 }
    )
  }
}

// Endpoint to verify and consume a check-in token
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      )
    }

    const tokenData = tokenStore.get(token)

    if (!tokenData) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 404 }
      )
    }

    // Check if token is expired
    if (tokenData.expiresAt < new Date()) {
      tokenStore.delete(token)
      return NextResponse.json(
        { success: false, error: 'Token has expired' },
        { status: 410 }
      )
    }

    // Get appointment details
    const appointment = await prisma.appointment.findUnique({
      where: { id: tokenData.appointmentId },
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
      }
    })

    if (!appointment) {
      tokenStore.delete(token)
      return NextResponse.json(
        { success: false, error: 'Appointment not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        appointment,
        valid: true
      }
    })

  } catch (error) {
    console.error('Error verifying check-in token:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to verify token' },
      { status: 500 }
    )
  }
}

// Export the token store for use in other routes
export { tokenStore }
