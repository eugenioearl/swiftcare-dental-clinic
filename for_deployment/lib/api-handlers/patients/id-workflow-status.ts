import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getClinicTodayRange } from '@/lib/clinic-hours'

// GET /api/patients/[id]/workflow-status
// Get current workflow state for guided workflow buttons
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const patientId = params.id

    // Get today's appointments in clinic timezone (Manila)
    const { startOfDay, endOfDay } = getClinicTodayRange()

    const todaysAppointments = await prisma.appointment.findMany({
      where: {
        patientId,
        scheduledDatetime: { gte: startOfDay, lte: endOfDay }
      },
      include: {
        dentist: { include: { user: true } },
        appointmentTreatments: { include: { treatment: true } }
      },
      orderBy: { scheduledDatetime: 'asc' }
    })

    // Get active packages
    const activePackages = await prisma.treatmentPackage.findMany({
      where: {
        patientId,
        status: { in: ['active', 'in_progress'] }
      },
      include: {
        items: { include: { treatment: true }, orderBy: { sortOrder: 'asc' } }
      }
    })

    // Get unpaid balance
    const packagesWithBalance = await prisma.treatmentPackage.findMany({
      where: {
        patientId,
        balanceDue: { gt: 0 }
      }
    })
    const totalBalanceDue = packagesWithBalance.reduce((s, p) => s + Number(p.balanceDue), 0)

    // Check for unsigned consents on active packages
    const unsignedConsents = await prisma.consentForm.count({
      where: {
        patientId,
        status: { in: ['draft', 'sent', 'viewed'] },
        packageId: { in: activePackages.map(p => p.id) }
      }
    })
    const hasUnsignedConsents = unsignedConsents > 0

    // Determine workflow step
    let currentStep = 'no_appointment' as string
    let nextAction = 'Schedule an appointment' as string
    let activeAppointment = null as any

    if (todaysAppointments.length > 0) {
      const apt = todaysAppointments[0]
      activeAppointment = apt

      switch (apt.status) {
        case 'scheduled':
        case 'confirmed':
          currentStep = 'ready_to_checkin'
          nextAction = 'Check In Patient'
          break
        case 'checked_in':
          if (hasUnsignedConsents) {
            currentStep = 'pending_consent'
            nextAction = 'Get Consent Signed'
          } else {
            currentStep = 'checked_in'
            nextAction = 'Start Consultation / Treatment'
          }
          break
        case 'in_progress':
          if (hasUnsignedConsents) {
            currentStep = 'pending_consent'
            nextAction = 'Get Consent Signed'
          } else {
            currentStep = 'in_treatment'
            nextAction = 'Complete Treatment & Record Payment'
          }
          break
        case 'completed':
          if (totalBalanceDue > 0) {
            currentStep = 'pending_payment'
            nextAction = `Record Payment (₱${totalBalanceDue.toLocaleString()} due)`
          } else {
            currentStep = 'all_done'
            nextAction = 'All steps complete for today'
          }
          break
        default:
          currentStep = 'ready_to_checkin'
          nextAction = 'Check In Patient'
      }
    } else if (totalBalanceDue > 0) {
      currentStep = 'pending_payment'
      nextAction = `Record Payment (₱${totalBalanceDue.toLocaleString()} due)`
    }

    return NextResponse.json({
      currentStep,
      nextAction,
      activeAppointment,
      todaysAppointments,
      activePackages,
      totalBalanceDue,
      hasUnsignedConsents
    })
  } catch (error) {
    console.error('Error fetching workflow status:', error)
    return NextResponse.json({ error: 'Failed to fetch workflow status' }, { status: 500 })
  }
}
